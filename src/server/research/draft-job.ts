import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { ConfiguredModel } from "@/server/ai/providers";
import { costUsd } from "@/server/ai/pricing";
import type { ArticleDraft } from "@/server/content/article-file";
import { loadArticle } from "@/server/content/load-article";
import { formatDateRow } from "@/server/history/date-row";
import { PermanentJobError, type JobHandler } from "@/server/jobs/types";
import type { GenerateTextRequest } from "@/server/providers/contracts";
import { slugify } from "@/server/sources/wikidata/mapper";
import {
  buildDraftPrompt,
  draftJsonSchema,
  groundDraft,
  type EvidenceSource,
  type ModelDraft,
} from "./grounding";

const MAX_CLAIM_EXCERPTS = 60;
const DRAFT_OUTPUT_TOKENS = 16_000;

const SOURCE_TYPE: Record<string, ArticleDraft["sources"][number]["type"]> = {
  STRUCTURED_DATA: "DATASET",
  ENCYCLOPEDIA: "ENCYCLOPEDIA",
  BOOK: "BOOK",
  ARCHIVE_ITEM: "ARCHIVE_DOCUMENT",
};

const TEMPLATE: Record<string, ArticleDraft["template"]> = {
  KINGDOM: "KINGDOM",
  EMPIRE: "KINGDOM",
  HISTORICAL_STATE: "KINGDOM",
  DYNASTY: "KINGDOM",
  COUNTRY: "COUNTRY",
  TERRITORY: "COUNTRY",
  PERSON: "BIOGRAPHY",
  CIVILIZATION: "CIVILIZATION",
  EVENT: "EVENT",
};

/**
 * The evidence a draft may use: accepted sources with retrieved text. Wikipedia sections become
 * excerpts by heading; Wikidata statements about the subject become excerpts by property.
 * Accepted books without retrieved text are bibliography only and can never be cited for a fact.
 */
export async function collectEvidence(db: PrismaClient, projectId: string) {
  const project = await db.contentProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { primaryEntity: true },
  });
  if (!project.primaryEntity)
    throw new PermanentJobError("Research has not identified the subject yet.");
  const accepted = await db.researchSource.findMany({
    where: { projectId, status: "ACCEPTED" },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });

  const evidence: (EvidenceSource & { researchSourceId: string })[] = [];
  const bibliography: typeof accepted = [];
  for (const rs of accepted) {
    const key = `s${evidence.length + 1}`;
    if (rs.kind === "STRUCTURED_DATA") {
      const claims = await db.historicalClaim.findMany({
        where: {
          entityId: project.primaryEntity.id,
          origin: "IMPORT",
          verification: { not: "REJECTED" },
        },
        include: { date: true },
        orderBy: { createdAt: "asc" },
        take: MAX_CLAIM_EXCERPTS,
      });
      const seen = new Map<string, number>();
      const excerpts = claims.map((c) => {
        const base = c.property ?? "statement";
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        const label = formatDateRow(c.date);
        return {
          locator: n === 1 ? base : `${base}#${n}`,
          text: label ? `${c.statement} (${label})` : c.statement,
          ...(c.date ? { years: [c.date.year] } : {}),
        };
      });
      if (excerpts.length > 0) {
        evidence.push({
          key,
          title: rs.title,
          kind: rs.kind,
          tier: rs.tier,
          url: rs.url,
          excerpts,
          researchSourceId: rs.id,
        });
      }
    } else if (Array.isArray(rs.excerpts) && rs.excerpts.length > 0) {
      const seen = new Map<string, number>();
      const excerpts = (rs.excerpts as { heading: string; text: string }[]).map((e) => {
        const n = (seen.get(e.heading) ?? 0) + 1;
        seen.set(e.heading, n);
        return { locator: n === 1 ? e.heading : `${e.heading} (${n})`, text: e.text };
      });
      evidence.push({
        key,
        title: rs.title,
        kind: rs.kind,
        tier: rs.tier,
        url: rs.url,
        excerpts,
        researchSourceId: rs.id,
      });
    } else {
      bibliography.push(rs);
    }
  }
  return { project, subject: project.primaryEntity, evidence, bibliography, accepted };
}

/** The exact request the model will receive (also used for the cost estimate). */
export async function buildDraftRequest(db: PrismaClient, projectId: string) {
  const collected = await collectEvidence(db, projectId);
  if (collected.evidence.length === 0) {
    throw new PermanentJobError("No accepted source has text to draft from.");
  }
  const { system, user } = buildDraftPrompt(
    collected.project.topic,
    `${collected.subject.name} (${collected.subject.kind.toLowerCase().replace(/_/g, " ")})`,
    collected.evidence,
  );
  const request: GenerateTextRequest = {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxOutputTokens: DRAFT_OUTPUT_TOKENS,
    jsonSchema: draftJsonSchema as unknown as Record<string, unknown>,
  };
  return { request, ...collected };
}

function parseModelDraft(text: string): ModelDraft {
  const json = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new PermanentJobError("The model's answer was not valid JSON; nothing was saved.");
  }
  const d = data as Partial<ModelDraft>;
  if (
    !d ||
    typeof d.title !== "string" ||
    !Array.isArray(d.sections) ||
    !Array.isArray(d.keyDates)
  ) {
    throw new PermanentJobError(
      "The model's answer did not have the expected structure; nothing was saved.",
    );
  }
  return d as ModelDraft;
}

async function uniqueSlug(db: PrismaClient, title: string) {
  const base = slugify(title, "draft").slice(0, 70);
  let slug = base;
  for (let n = 2; await db.article.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  return slug;
}

/**
 * The AI article draft step. The draft is grounded, checked and saved as an unreviewed AI draft
 * in the editorial workflow: it cannot be published until an editor reviews it.
 */
export function createDraftHandler(getModel: () => ConfiguredModel): JobHandler {
  return async (ctx) => {
    const { db } = ctx;
    if (!ctx.projectId) throw new PermanentJobError("Draft jobs belong to a project.");
    const job = await db.productionJob.findUniqueOrThrow({ where: { id: ctx.jobId } });
    const estimate = Number(job.costEstimateUsd ?? 0);
    if (estimate > 0 && !job.approvedAt)
      throw new PermanentJobError("The cost of this draft was not approved.");

    await ctx.progress(5, "Collecting the approved evidence");
    const { request, project, subject, evidence, bibliography, accepted } = await buildDraftRequest(
      db,
      ctx.projectId,
    );
    if (!project.sourceSetApprovedAt)
      throw new PermanentJobError("The source set is no longer approved.");
    const { provider, price } = getModel();
    // The prompt must not have grown beyond what was approved.
    const now = provider.estimateCost(request).amount;
    if (estimate > 0 && now > estimate * 1.05) {
      throw new PermanentJobError(
        `The estimate rose from $${estimate.toFixed(4)} to $${now.toFixed(4)} since approval; request a new draft.`,
      );
    }
    if (await ctx.isCancelled()) return { output: { cancelled: true } };

    await ctx.progress(15, `Writing the draft with ${provider.id}`);
    const result = await provider.generate(request);
    const spent = result.usage
      ? costUsd(price, result.usage.inputTokens, result.usage.outputTokens)
      : estimate;
    await ctx.recordCost(spent);

    await ctx.progress(80, "Checking every sentence against the evidence");
    const draft = parseModelDraft(result.text);
    const grounded = groundDraft(draft, evidence);
    if (grounded.sections.length === 0) {
      throw new PermanentJobError(
        `None of the draft's ${grounded.report.removedSentences.length} sentences cited the evidence correctly; no article was created.`,
      );
    }

    const sections: ArticleDraft["sections"] = grounded.sections.map((s) => ({
      kind: s.kind as ArticleDraft["sections"][number]["kind"],
      heading: s.kind === "INTRODUCTION" ? undefined : s.heading || undefined,
      body: s.body,
    }));
    if (bibliography.length > 0) {
      sections.push({
        kind: "FURTHER_READING",
        heading: "Further reading",
        body: bibliography
          .map(
            (b) =>
              `*${b.title}*${b.authors.length ? `, ${b.authors.join(", ")}` : ""}${b.publishedYear ? ` (${b.publishedYear})` : ""}.`,
          )
          .join("\n\n"),
      });
    }

    const article: ArticleDraft = {
      slug: await uniqueSlug(db, draft.title || project.topic),
      title: (draft.title || project.topic).slice(0, 200),
      subtitle: draft.subtitle || undefined,
      summary:
        draft.summary
          ?.replace(/\[@[^\]]+\]/g, "")
          .trim()
          .slice(0, 400) || undefined,
      template: TEMPLATE[subject.kind] ?? "GENERAL",
      primaryEntity: { entityId: subject.id },
      authoring: "ai_draft",
      sources: evidence.map((e) => {
        const rs = accepted.find((a) => a.id === e.researchSourceId)!;
        return {
          key: e.key,
          type: SOURCE_TYPE[rs.kind] ?? "OTHER",
          title: rs.title,
          authors: rs.authors,
          publishedYear: rs.publishedYear ?? undefined,
          url: rs.url,
          accessedAt: rs.retrievedAt.toISOString().slice(0, 10),
          licenseNote: rs.licenseNote ?? undefined,
          reliabilityNote:
            rs.tier === "TERTIARY"
              ? "Tertiary source (a summary of other works); used for orientation and checked against the record."
              : undefined,
        };
      }),
      sections,
      keyDates: grounded.keyDates.map((kd) => ({
        statement: kd.statement,
        type: "FACT" as const,
        certainty: kd.approximate ? ("PROBABLE" as const) : ("DOCUMENTED" as const),
        date: {
          year: kd.year,
          month:
            kd.precision === "month" || kd.precision === "day" ? kd.month || undefined : undefined,
          day: kd.precision === "day" ? kd.day || undefined : undefined,
          precision: kd.precision,
          approximate: kd.approximate || undefined,
        },
        cite: [{ source: kd.source, locator: kd.locator }],
      })),
      entities: [],
      media: [],
    };

    const loaded = await loadArticle(db, article, null, { mode: "lenient", createOnly: true });
    // Link the reviewed sources to the bibliographic records the article now cites.
    for (const e of evidence) {
      const source = await db.source.findFirst({ where: { url: e.url } });
      if (source)
        await db.researchSource.update({
          where: { id: e.researchSourceId },
          data: { sourceId: source.id },
        });
    }
    await db.contentProject.update({
      where: { id: project.id },
      data: { articleId: loaded.articleId, status: "AWAITING_REVIEW" },
    });

    return {
      output: {
        articleId: loaded.articleId,
        slug: article.slug,
        model: result.model,
        usage: result.usage ?? null,
        costUsd: Number(spent.toFixed(6)),
        grounding: grounded.report,
        loaderWarnings: loaded.warnings,
      },
    };
  };
}
