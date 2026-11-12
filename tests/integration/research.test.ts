import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { ModelRefusalError, type ConfiguredModel } from "@/server/ai/providers";
import { publishArticle } from "@/server/content/publish";
import { getDb } from "@/server/db/client";
import { enqueueJob, getQueue } from "@/server/jobs/queue";
import { runJob } from "@/server/jobs/runner";
import { approveJobCost, cancelJob, createJob, retryJob } from "@/server/jobs/service";
import { PermanentJobError, type JobHandler } from "@/server/jobs/types";
import { recoverJobs, startWorker } from "@/server/jobs/worker";
import { collectEvidence, createDraftHandler } from "@/server/research/draft-job";
import {
  approveSourceSet,
  createProject,
  reopenSourceSet,
  requestArticleDraft,
  reviewResearchSource,
} from "@/server/research/projects";
import { createResearchHandler, type ResearchReport } from "@/server/research/research-job";
import type { SourceHttpClient } from "@/server/sources/http";
import type { WikidataClient } from "@/server/sources/wikidata/client";
import type { WbEntity } from "@/server/sources/wikidata/types";

/**
 * The research engine against the real test database and a real Redis (database 1).
 * External services are replaced by recorded responses (tests/fixtures/research, captured from
 * the live APIs); the language model is a test double whose answers are written here.
 */

const fixture = (path: string) => JSON.parse(readFileSync(`tests/fixtures/${path}`, "utf8"));

const wikidata: WikidataClient = {
  async getEntity(qid) {
    return (fixture(`wikidata/${qid}.json`) as { entities: Record<string, WbEntity> }).entities[
      qid
    ]!;
  },
  async getLabels() {
    return new Map();
  },
  async sparql() {
    return [];
  },
};

const requested: string[] = [];
const http: SourceHttpClient = {
  async getJson<T>(url: string): Promise<T> {
    requested.push(url);
    if (url.includes("wbsearchentities")) return fixture("research/wbsearch-buganda.json");
    if (url.includes("wikipedia.org/w/api.php"))
      return fixture("research/wikipedia-buganda-extract.json");
    if (url.includes("openlibrary.org/search.json"))
      return fixture("research/openlibrary-buganda.json");
    throw new Error(`Unexpected request in test: ${url}`);
  },
  async getBytes() {
    throw new Error("No downloads in tests");
  },
};

const researchHandler = createResearchHandler({ http, wikidata, locEnabled: false });

let db: PrismaClient;
const admin = {
  id: "research-admin",
  email: "admin@research.invalid",
  role: "ADMINISTRATOR" as const,
};
const researcher = {
  id: "research-researcher",
  email: "r@research.invalid",
  role: "RESEARCHER" as const,
};
const editor = { id: "research-editor", email: "e@research.invalid", role: "EDITOR" as const };
let projectId: string;

beforeAll(async () => {
  db = getDb();
  await db.user.createMany({
    data: [
      { id: admin.id, name: "Ada Admin", email: admin.email, role: "ADMINISTRATOR" },
      { id: researcher.id, name: "Rae Researcher", email: researcher.email, role: "RESEARCHER" },
      { id: editor.id, name: "Eli Editor", email: editor.email, role: "EDITOR" },
    ],
  });
  await getQueue()?.obliterate({ force: true });
});

afterAll(async () => {
  await getQueue()?.obliterate({ force: true });
  await getQueue()?.close();
});

const latestJob = (type: "RESEARCH" | "ARTICLE_DRAFT") =>
  db.productionJob.findFirstOrThrow({ where: { projectId, type }, orderBy: { createdAt: "desc" } });

describe("Generate History Project: research", () => {
  it("only administrators start projects, and budgets stay within limits", async () => {
    await expect(
      createProject(db, researcher, { topic: "Buganda", subjectQid: "", budgetUsd: 0 }),
    ).rejects.toThrow(/Only administrators/);
    await expect(
      createProject(db, admin, { topic: "Buganda", subjectQid: "1036", budgetUsd: 0 }),
    ).rejects.toThrow(/must look like Q1036/);
    await expect(
      createProject(db, admin, { topic: "Buganda", subjectQid: "", budgetUsd: -1 }),
    ).rejects.toThrow(/between \$0 and \$1,000/);
  });

  it("creates the project and queues research in Redis", async () => {
    const { project, queued } = await createProject(db, admin, {
      topic: "The Complete History of the Buganda Kingdom",
      subjectQid: "",
      budgetUsd: 0,
    });
    projectId = project.id;
    expect(queued).toBe(true);
    const job = await latestJob("RESEARCH");
    expect(job).toMatchObject({ status: "QUEUED", requestedById: admin.id });
    expect(await getQueue()!.getJob(job.id)).toBeTruthy();
    expect(await db.auditLog.count({ where: { action: "project.created" } })).toBe(1);
  });

  it("finds the subject, imports it, gathers candidate sources and writes a report", async () => {
    const job = await latestJob("RESEARCH");
    expect(await runJob(db, job.id, { RESEARCH: researchHandler })).toBe("succeeded");
    const done = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(done).toMatchObject({ status: "SUCCEEDED", progress: 100, attempts: 1 });
    const report = (done.output as unknown as { report: ResearchReport }).report;
    expect(report.subject).toMatchObject({
      qid: "Q473748",
      name: "Buganda",
      kind: "HISTORICAL_STATE",
      matchedBy: "search",
    });
    expect(report.subject.alternatives.length).toBeGreaterThan(0);
    // The search used the subject, not the whole title.
    expect(requested.find((u) => u.includes("wbsearchentities"))).toContain(
      "search=Buganda%20Kingdom",
    );

    const sources = await db.researchSource.findMany({ where: { projectId } });
    const byProvider = (p: string) => sources.filter((s) => s.provider === p);
    expect(byProvider("wikidata")).toHaveLength(1);
    expect(byProvider("wikipedia")[0]).toMatchObject({ kind: "ENCYCLOPEDIA", tier: "TERTIARY" });
    expect((byProvider("wikipedia")[0]!.excerpts as unknown[]).length).toBeGreaterThan(5);
    expect(byProvider("openlibrary").length).toBeGreaterThan(0);
    expect(sources.every((s) => s.status === "CANDIDATE")).toBe(true);
    const project = await db.contentProject.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.primaryEntityId).toBeTruthy();
  });

  it("requires a person to review and approve the source set, then locks it", async () => {
    await expect(approveSourceSet(db, researcher, projectId)).rejects.toThrow(
      /Accept at least one source/,
    );
    const sources = await db.researchSource.findMany({ where: { projectId } });
    const wikipedia = sources.find((s) => s.provider === "wikipedia")!;
    const wikidataSource = sources.find((s) => s.provider === "wikidata")!;
    const book = sources.find((s) => s.provider === "openlibrary")!;
    const other = sources.filter((s) => s.provider === "openlibrary")[1];

    await reviewResearchSource(db, researcher, wikipedia.id, "ACCEPTED", "");
    await reviewResearchSource(db, researcher, wikidataSource.id, "ACCEPTED", "");
    await reviewResearchSource(
      db,
      researcher,
      book.id,
      "ACCEPTED",
      "Standard history; obtain a copy.",
    );
    if (other) {
      await expect(reviewResearchSource(db, researcher, other.id, "REJECTED", "")).rejects.toThrow(
        /why/,
      );
      await reviewResearchSource(db, researcher, other.id, "REJECTED", "Off topic");
    }
    // The database refuses a decision without a reviewer timestamp.
    await expect(
      db.$executeRaw`UPDATE "research_sources" SET "status" = 'ACCEPTED', "reviewedAt" = NULL WHERE "id" = ${book.id}`,
    ).rejects.toThrow(/research_sources_decision_reviewed/);

    await approveSourceSet(db, researcher, projectId);
    await expect(
      reviewResearchSource(db, researcher, book.id, "REJECTED", "changed my mind"),
    ).rejects.toThrow(/locked/);
    await reopenSourceSet(db, researcher, projectId);
    await approveSourceSet(db, researcher, projectId);
  });

  it("builds evidence only from accepted sources with text; books are bibliography", async () => {
    const { evidence, bibliography } = await collectEvidence(db, projectId);
    expect(evidence.map((e) => e.kind).sort()).toEqual(["ENCYCLOPEDIA", "STRUCTURED_DATA"]);
    expect(evidence.every((e) => e.excerpts.length > 0)).toBe(true);
    expect(bibliography).toHaveLength(1);
  });
});

describe("spending and the AI draft", () => {
  it("refuses a draft request when no language model is configured", async () => {
    await expect(requestArticleDraft(db, researcher, projectId)).rejects.toThrow(
      /No language model is configured/,
    );
  });

  it("holds a paid job for approval within the project budget and the monthly ceiling", async () => {
    const { job, queued } = await createJob(db, researcher, {
      projectId,
      type: "ARTICLE_DRAFT",
      costEstimateUsd: 0.5,
      maxAttempts: 1,
    });
    expect(job.status).toBe("AWAITING_APPROVAL");
    expect(queued).toBe(false);
    expect(await runJob(db, job.id, {})).toBe("skipped");

    await expect(
      approveJobCost(db, researcher, job.id, { monthlyCeilingUsd: 100 }),
    ).rejects.toThrow(/Only administrators/);
    await expect(approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 100 })).rejects.toThrow(
      /Over the project budget/,
    );
    await db.contentProject.update({
      where: { id: projectId },
      data: { budgetUsd: new Prisma.Decimal(5) },
    });
    await expect(approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 0 })).rejects.toThrow(
      /monthly spending ceiling/,
    );
    await approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 10 });
    expect(await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "QUEUED",
      approvedById: admin.id,
    });
    expect(await db.auditLog.count({ where: { action: "spend.approved" } })).toBe(1);
  });

  /** A language-model test double: returns the given text and token usage. */
  function model(
    text: string | (() => never),
    usage = { inputTokens: 20_000, outputTokens: 3_000 },
  ): () => ConfiguredModel {
    return () => ({
      price: { input: 4, output: 20, basis: "test price" },
      provider: {
        id: "test:double",
        estimateCost: () => ({ currency: "USD", amount: 0.4, basis: "test" }),
        async generate() {
          if (typeof text === "function") return text();
          return { text, model: "test-double", usage };
        },
      },
    });
  }

  it("drafts only what the evidence supports, records the cost, and needs editorial review", async () => {
    const { evidence } = await collectEvidence(db, projectId);
    const wd = evidence.find((e) => e.kind === "STRUCTURED_DATA")!;
    const wp = evidence.find((e) => e.kind === "ENCYCLOPEDIA")!;
    const dated = wd.excerpts.find((e) => e.years?.length)!;
    const intro = wp.excerpts[0]!;
    const answer = {
      title: "Buganda",
      subtitle: "A kingdom on Lake Victoria",
      summary: "Buganda is a Bantu kingdom within Uganda.",
      sections: [
        {
          kind: "INTRODUCTION",
          heading: "",
          body: `Buganda is a Bantu kingdom in present-day Uganda [@${wp.key}|${intro.locator}]. It was the greatest power in Africa. Its record includes a founding date [@${wd.key}|${dated.locator}].`,
        },
      ],
      keyDates: [
        {
          statement: "Earliest date in the record",
          year: dated.years![0],
          month: 0,
          day: 0,
          precision: "year",
          approximate: false,
          source: wd.key,
          locator: dated.locator,
        },
        {
          statement: "Made up",
          year: 1234,
          month: 0,
          day: 0,
          precision: "year",
          approximate: false,
          source: wp.key,
          locator: intro.locator,
        },
      ],
    };
    const job = await latestJob("ARTICLE_DRAFT");
    expect(
      await runJob(db, job.id, {
        ARTICLE_DRAFT: createDraftHandler(model(JSON.stringify(answer))),
      }),
    ).toBe("succeeded");

    const done = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    // 20,000 × $4 + 3,000 × $20 per million = $0.14
    expect(Number(done.actualCostUsd)).toBeCloseTo(0.14, 6);
    const project = await db.contentProject.findUniqueOrThrow({ where: { id: projectId } });
    expect(Number(project.spentUsd)).toBeCloseTo(0.14, 6);
    expect(project.status).toBe("AWAITING_REVIEW");

    const output = done.output as {
      articleId: string;
      grounding: { removedSentences: { sentence: string }[]; removedKeyDates: unknown[] };
    };
    expect(output.grounding.removedSentences.map((r) => r.sentence)).toEqual([
      "It was the greatest power in Africa.",
    ]);
    expect(output.grounding.removedKeyDates).toHaveLength(1);

    const article = await db.article.findUniqueOrThrow({
      where: { id: output.articleId },
      include: { sections: true, claims: true, citations: { include: { source: true } } },
    });
    expect(article).toMatchObject({
      status: "DRAFT",
      containsUnreviewedAi: true,
      id: project.articleId,
    });
    expect(article.sections.find((s) => s.kind === "INTRODUCTION")!.body).not.toContain(
      "greatest power",
    );
    expect(article.sections.find((s) => s.kind === "FURTHER_READING")).toBeTruthy();
    expect(article.claims).toHaveLength(1);
    expect(article.claims[0]).toMatchObject({ origin: "AI_DRAFT", verification: "UNVERIFIED" });
    expect(new Set(article.citations.map((c) => c.source.url))).toEqual(new Set([wd.url, wp.url]));
    // An AI draft goes through the same workflow as any other.
    await expect(publishArticle(db, editor, article.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(requestArticleDraft(db, researcher, projectId)).rejects.toThrow(
      /already has an article draft/,
    );
  });

  it("records the cost of a failed paid call, and does not retry refusals or bad output", async () => {
    await db.contentProject.update({ where: { id: projectId }, data: { articleId: null } });
    const { job } = await createJob(db, researcher, {
      projectId,
      type: "ARTICLE_DRAFT",
      costEstimateUsd: 0.4,
      maxAttempts: 2,
    });
    await approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 10 });
    expect(await runJob(db, job.id, { ARTICLE_DRAFT: createDraftHandler(model("not json")) })).toBe(
      "failed",
    );
    const failed = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(failed.error).toMatch(/not valid JSON; nothing was saved/);
    expect(Number(failed.actualCostUsd)).toBeCloseTo(0.14, 6);

    // Retrying a paid job needs a new approval; a refusal fails at once.
    const retry = await retryJob(db, researcher, job.id);
    expect(retry.needsApproval).toBe(true);
    await approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 10 });
    const refusing = model(() => {
      throw new ModelRefusalError("The model declined this request.");
    });
    expect(await runJob(db, job.id, { ARTICLE_DRAFT: createDraftHandler(refusing) })).toBe(
      "failed",
    );
    expect((await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).attempts).toBe(1);
  });
});

describe("job runner and queue", () => {
  const stub = (impl: JobHandler) => ({ RESEARCH: impl });

  it("retries transient failures until attempts run out, then fails with the reason", async () => {
    const { job } = await createJob(db, researcher, {
      projectId,
      type: "RESEARCH",
      maxAttempts: 2,
    });
    const flaky = stub(async () => {
      throw new Error("Request to www.wikidata.org failed (429) after 3 attempt(s).");
    });
    expect(await runJob(db, job.id, flaky)).toBe("retry");
    expect(await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "QUEUED",
      attempts: 1,
    });
    expect(await runJob(db, job.id, flaky)).toBe("failed");
    expect(await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "FAILED",
      attempts: 2,
      error: expect.stringContaining("429"),
    });
    const permanent = stub(async () => {
      throw new PermanentJobError("Bad input.");
    });
    await retryJob(db, researcher, job.id);
    expect(await runJob(db, job.id, permanent)).toBe("failed");
  });

  it("skips cancelled jobs and stops a running job at its next check", async () => {
    const { job } = await createJob(db, researcher, { projectId, type: "RESEARCH" });
    await cancelJob(db, researcher, job.id);
    expect(
      await runJob(
        db,
        job.id,
        stub(async () => ({ output: {} })),
      ),
    ).toBe("skipped");

    await retryJob(db, researcher, job.id);
    const outcome = await runJob(
      db,
      job.id,
      stub(async (ctx) => {
        await db.productionJob.update({ where: { id: ctx.jobId }, data: { status: "CANCELLED" } });
        return { output: { cancelled: await ctx.isCancelled() } };
      }),
    );
    expect(outcome).toBe("cancelled");
    expect((await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      "CANCELLED",
    );
  });

  it("runs queued jobs through a real BullMQ worker, and recovers interrupted ones", async () => {
    const { job } = await createJob(db, researcher, { projectId, type: "RESEARCH" });
    await db.productionJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });
    expect(await recoverJobs(db)).toBeGreaterThanOrEqual(1);
    expect((await db.productionJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      "QUEUED",
    );

    const worker = startWorker(
      db,
      stub(async (ctx) => {
        await ctx.progress(50, "halfway");
        return { output: { ran: true } };
      }),
      1,
    );
    try {
      await enqueueJob(job.id, 1);
      const deadline = Date.now() + 10_000;
      let row = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
      while (row.status !== "SUCCEEDED" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        row = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
      }
      expect(row).toMatchObject({ status: "SUCCEEDED", progress: 100, output: { ran: true } });
    } finally {
      await worker.close();
    }
  });
});
