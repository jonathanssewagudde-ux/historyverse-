import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { buildArticleView, listPublishedArticles } from "@/server/content/article-view";
import { ArticleLoadError, loadArticle, parseArticleFile } from "@/server/content/load-article";
import { PublishError, publishArticle, unpublishArticle } from "@/server/content/publish";
import { approveResearch, requestChanges, submitForReview } from "@/server/content/workflow";
import { getDb } from "@/server/db/client";

/**
 * The real Buganda article file, loaded into the test database and published, exactly as an
 * editor would. Entities and media are created as minimal stand-ins for imported records.
 */
const bugandaFile = JSON.parse(readFileSync("data/articles/buganda-kingdom.json", "utf8"));

let db: PrismaClient;
const editor = { id: "articles-editor", email: "editor@articles.invalid", role: "EDITOR" as const };
const researcher = {
  id: "articles-researcher",
  email: "researcher@articles.invalid",
  role: "RESEARCHER" as const,
};

beforeAll(async () => {
  db = getDb();
  await db.user.createMany({
    data: [
      { id: editor.id, name: "Editor", email: editor.email, role: "EDITOR" },
      { id: researcher.id, name: "Researcher", email: researcher.email, role: "RESEARCHER" },
    ],
    skipDuplicates: true,
  });
  for (const e of [
    { qid: "Q473748", kind: "KINGDOM" as const, slug: "buganda", name: "Buganda" },
    { qid: "Q1036", kind: "COUNTRY" as const, slug: "uganda", name: "Uganda" },
    { qid: "Q889311", kind: "PERSON" as const, slug: "muteesa-i", name: "Muteesa I" },
  ]) {
    await db.entity.upsert({
      where: { wikidataId: e.qid },
      create: { wikidataId: e.qid, kind: e.kind, slug: `${e.slug}-articles-test`, name: e.name },
      update: {},
    });
  }
  const pd = await db.mediaLicense.upsert({
    where: { code: "PD" },
    create: {
      code: "PD",
      name: "Public domain",
      family: "PUBLIC_DOMAIN",
      publishable: true,
      requiresAttribution: false,
    },
    update: {},
  });
  const nc = await db.mediaLicense.upsert({
    where: { code: "CC-BY-NC-4.0" },
    create: { code: "CC-BY-NC-4.0", name: "CC BY-NC 4.0", family: "CC_BY_NC", publishable: false },
    update: {},
  });
  // Stored, publishable engraving; stored but non-publishable photo; un-downloaded map.
  const media = [
    { ref: "File:King Mwanga II Buganda.jpg", licenseId: pd.id, storageKey: "media/aa/mwanga.jpg" },
    { ref: "File:Mutesa I.jpg", licenseId: nc.id, storageKey: "media/aa/mutesa.jpg" },
    {
      ref: "File:Uganda - Location Map (2013) - UGA - UNOCHA.svg",
      licenseId: pd.id,
      storageKey: null,
    },
  ];
  for (const m of media) {
    await db.mediaAsset.upsert({
      where: { sourceName_sourceRef: { sourceName: "Wikimedia Commons", sourceRef: m.ref } },
      create: {
        kind: "UNCLASSIFIED",
        title: m.ref.replace("File:", "").replace(/\.[a-z]+$/i, ""),
        sourceName: "Wikimedia Commons",
        sourceRef: m.ref,
        attribution: "test",
        licenseId: m.licenseId,
        storageKey: m.storageKey,
        mimeType: "image/jpeg",
      },
      update: {},
    });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("article files", () => {
  it("accepts the real Buganda article file", () => {
    const file = parseArticleFile(bugandaFile);
    expect(file.sources.map((s) => s.key)).toContain("loc-1990");
    expect(file.sections.length).toBeGreaterThan(5);
  });

  it("rejects citations to undeclared sources and uncited sections", () => {
    const bad = structuredClone(bugandaFile);
    bad.sections[1].body = "A claim.[@made-up-source]";
    bad.sections[2].body = "A paragraph with no citation at all.";
    expect(() => parseArticleFile(bad)).toThrow(
      /unknown source "made-up-source"[\s\S]*section has no citations/,
    );
  });

  it("rejects impossible dates", () => {
    const bad = structuredClone(bugandaFile);
    bad.keyDates[0].date = { year: 0, precision: "year" };
    expect(() => parseArticleFile(bad)).toThrow(ArticleLoadError);
  });
});

describe("loading", () => {
  it("creates a flagged draft with cited sections, key dates and links", async () => {
    const report = await loadArticle(db, bugandaFile);
    expect(report).toMatchObject({ slug: "buganda", version: 1, keyDates: 14 });
    expect(report.warnings.join(" ")).toMatch(/Q707775 is not imported/);

    const article = await db.article.findUniqueOrThrow({
      where: { slug: "buganda" },
      include: { sections: true },
    });
    expect(article).toMatchObject({
      status: "DRAFT",
      containsUnreviewedAi: true,
      template: "KINGDOM",
    });
    expect(article.sections.every((s) => !s.body.includes("[@"))).toBe(true);
    expect(await db.citation.count({ where: { articleId: article.id } })).toBe(report.citations);

    const claims = await db.historicalClaim.findMany({ where: { articleId: article.id } });
    expect(claims.every((c) => c.origin === "AI_DRAFT" && c.verification === "UNVERIFIED")).toBe(
      true,
    );
  });

  it("reloads a draft as a new version without duplicating sources", async () => {
    const sources = await db.source.count();
    const report = await loadArticle(db, bugandaFile);
    expect(report.version).toBe(2);
    expect(await db.source.count()).toBe(sources);
    expect(await db.articleRevision.count({ where: { articleId: report.articleId } })).toBe(2);
  });

  it("is not visible to the public while it is a draft", async () => {
    expect(await buildArticleView(db, { slug: "buganda" }, { publicOnly: true })).toBeNull();
    expect(await listPublishedArticles(db, ["KINGDOM"])).toEqual([]);
  });

  it("previews with every image annotated", async () => {
    const view = await buildArticleView(db, { slug: "buganda" }, { publicOnly: false });
    expect(view!.hero!.title).toBe("King Mwanga II Buganda");
    const blockers = Object.fromEntries(
      [view!.hero!, ...view!.gallery].map((m) => [m.title, m.blocker]),
    );
    expect(blockers["Mutesa I"]).toMatch(/does not allow publication/);
    expect(blockers["Uganda - Location Map (2013) - UGA - UNOCHA"]).toMatch(/not been downloaded/);
  });
});

describe("editorial workflow", () => {
  it("refuses to publish a draft that has not been reviewed", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    await expect(publishArticle(db, editor, article.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("lets a researcher submit, but only an editor approve or send back", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    await submitForReview(db, researcher, article.id, "Ready for a look");
    expect((await db.article.findUniqueOrThrow({ where: { id: article.id } })).status).toBe(
      "RESEARCH_REVIEW",
    );
    await expect(submitForReview(db, researcher, article.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(approveResearch(db, researcher, article.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await requestChanges(db, editor, article.id, "Check the 1953 date against a second source.");
    expect((await db.article.findUniqueOrThrow({ where: { id: article.id } })).status).toBe(
      "DRAFT",
    );
    const sentBack = await db.editorialReview.findFirstOrThrow({
      where: { articleId: article.id, decision: "CHANGES_REQUESTED" },
    });
    expect(sentBack).toMatchObject({
      stage: "RESEARCH_REVIEW",
      reviewerId: editor.id,
      notes: "Check the 1953 date against a second source.",
    });

    await submitForReview(db, researcher, article.id);
    await approveResearch(db, editor, article.id, "Sources check out.");
    expect((await db.article.findUniqueOrThrow({ where: { id: article.id } })).status).toBe(
      "EDITORIAL_APPROVAL",
    );
    const actions = (
      await db.auditLog.findMany({ where: { targetId: article.id }, orderBy: { createdAt: "asc" } })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "article.submitted_for_review",
        "article.changes_requested",
        "article.research_approved",
      ]),
    );
  });
});

describe("publishing", () => {
  it("is refused for researchers", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    await expect(publishArticle(db, researcher, article.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("publishes, approves only publishable stored images and verifies the key dates", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    const result = await publishArticle(db, editor, article.id);
    expect(result.approvedMedia).toBe(1);
    expect(result.withheld.map((w) => w.title).sort()).toEqual([
      "Mutesa I",
      "Uganda - Location Map (2013) - UGA - UNOCHA",
    ]);

    const after = await db.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(after).toMatchObject({
      status: "PUBLISHED",
      containsUnreviewedAi: false,
      lastEditedById: editor.id,
    });
    expect(after.publishedAt).not.toBeNull();

    const claims = await db.historicalClaim.findMany({ where: { articleId: article.id } });
    expect(claims.every((c) => c.verification === "VERIFIED" && c.verifiedById === editor.id)).toBe(
      true,
    );

    const review = await db.editorialReview.findFirstOrThrow({
      where: { articleId: article.id, stage: "EDITORIAL_APPROVAL" },
    });
    expect(review).toMatchObject({
      stage: "EDITORIAL_APPROVAL",
      decision: "APPROVED",
      reviewerId: editor.id,
      articleVersion: 2,
    });
    expect(
      await db.auditLog.count({ where: { action: "article.published", targetId: article.id } }),
    ).toBe(1);
  });

  it("shows readers the published article with numbered references and only approved images", async () => {
    const view = await buildArticleView(db, { slug: "buganda" }, { publicOnly: true });
    expect(view).not.toBeNull();
    expect(view!.path).toBe("/kingdoms/buganda");
    expect(view!.hero?.title).toBe("King Mwanga II Buganda");
    expect(view!.gallery).toEqual([]);
    expect(view!.references.map((r) => r.n)).toEqual(view!.references.map((_, i) => i + 1));
    expect(view!.references.find((r) => r.title === "Uganda: A Country Study")).toMatchObject({
      year: 1990,
    });

    // Every citation marker in the text resolves to a reference.
    const numbers = new Set(view!.references.map((r) => r.n));
    for (const section of view!.sections) {
      for (const [, position] of section.body.matchAll(/\[\^(\d+)\]/g)) {
        expect(numbers.has(section.refs[Number(position)]!)).toBe(true);
      }
    }
    // Key dates come out in chronological order.
    expect(view!.keyDates[0]!.label).toBe("1844");
    expect(view!.keyDates.at(-1)!.label).toBe("31 July 1993");
    expect(view!.people.map((p) => p.name)).toEqual(["Muteesa I"]);
  });

  it("cannot publish twice, and can be taken back to draft with a reason", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    await expect(publishArticle(db, editor, article.id)).rejects.toBeInstanceOf(PublishError);
    await unpublishArticle(db, editor, article.id, "test");
    expect(await buildArticleView(db, { slug: "buganda" }, { publicOnly: true })).toBeNull();
  });

  it("refuses to overwrite an article that is no longer a draft", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    await db.article.update({ where: { id: article.id }, data: { status: "RESEARCH_REVIEW" } });
    await expect(loadArticle(db, bugandaFile)).rejects.toThrow(
      /is research review; only drafts can be edited/,
    );
  });
});

describe("editor round trip", () => {
  it("exports an article and saves it back unchanged", async () => {
    const { exportArticle } = await import("@/server/content/export-article");
    // A fresh draft from the real file.
    await db.article.deleteMany({ where: { slug: "buganda" } });
    const { articleId } = await loadArticle(db, bugandaFile);
    const before = await buildArticleView(db, { id: articleId }, { publicOnly: false });

    const draft = await exportArticle(db, articleId);
    expect(draft!.sections[0]!.body).toContain("[@s1|Uganda Before 1900]");
    const saved = await loadArticle(db, draft, null, { mode: "lenient", articleId });
    expect(saved.version).toBe(2);

    const after = await buildArticleView(db, { id: articleId }, { publicOnly: false });
    // Sections and key-date claims are recreated on save, so only their ids may differ.
    const strip = (v: typeof before) => ({
      ...v!,
      version: 0,
      updatedAt: "",
      sections: v!.sections.map((s) => ({ ...s, id: "" })),
      keyDates: v!.keyDates.map((d) => ({ ...d, id: "" })),
    });
    expect(strip(after)).toEqual(strip(before));
  });

  it("saves unfinished drafts in the editor but still refuses them at publication", async () => {
    const draft = structuredClone(bugandaFile);
    draft.slug = "unfinished-draft";
    draft.sections = [{ kind: "INTRODUCTION", body: "No citations yet." }];
    draft.keyDates = [];
    expect(() => parseArticleFile(draft)).toThrow(/section has no citations/);
    const { articleId } = await loadArticle(db, draft, null, { mode: "lenient" });
    await submitForReview(db, researcher, articleId);
    await approveResearch(db, editor, articleId);
    await expect(publishArticle(db, editor, articleId)).rejects.toThrow(
      /Every section must cite a source.*Introduction/,
    );
  });

  it("assigns categories by slug and keeps them when a file omits them", async () => {
    const { exportArticle } = await import("@/server/content/export-article");
    const category = await db.category.create({
      data: { slug: "kingdoms-test", name: "Kingdoms" },
    });
    const article = await db.article.findUniqueOrThrow({ where: { slug: "unfinished-draft" } });
    if (article.status !== "DRAFT")
      await requestChanges(db, editor, article.id, "Back to draft for categories.");
    const draft = (await exportArticle(db, article.id))!;
    await loadArticle(db, { ...draft, categories: ["kingdoms-test"] }, null, {
      mode: "lenient",
      articleId: article.id,
    });
    expect((await exportArticle(db, article.id))!.categories).toEqual(["kingdoms-test"]);
    const { categories: _omit, ...withoutCategories } = draft;
    await loadArticle(db, withoutCategories, null, { mode: "lenient", articleId: article.id });
    expect((await exportArticle(db, article.id))!.categories).toEqual(["kingdoms-test"]);
    await expect(
      loadArticle(db, { ...draft, categories: ["no-such-category"] }, null, {
        mode: "lenient",
        articleId: article.id,
      }),
    ).rejects.toThrow(/Unknown category: no-such-category/);
    await db.article.update({ where: { id: article.id }, data: { categories: { set: [] } } });
    await db.category.delete({ where: { id: category.id } });
  });

  it("refuses to create a new article over an existing address", async () => {
    const draft = structuredClone(bugandaFile);
    draft.slug = "unfinished-draft";
    await expect(
      loadArticle(db, draft, null, { mode: "lenient", createOnly: true }),
    ).rejects.toThrow(/Another article already uses the address "unfinished-draft"/);
  });

  it("keeps sources that are listed but not cited yet", async () => {
    const { exportArticle } = await import("@/server/content/export-article");
    const article = await db.article.findUniqueOrThrow({ where: { slug: "unfinished-draft" } });
    if (article.status !== "DRAFT") {
      await requestChanges(db, editor, article.id, "Add citations before this goes further.");
    }
    const draft = (await exportArticle(db, article.id))!;
    draft.sources.push({ key: "later", type: "BOOK", title: "A book to cite later", authors: [] });
    await loadArticle(db, draft, null, { mode: "lenient", articleId: article.id });
    const again = (await exportArticle(db, article.id))!;
    expect(again.sources.map((s) => s.title)).toContain("A book to cite later");
  });

  it("can rename an article but not onto another article's address", async () => {
    const { exportArticle } = await import("@/server/content/export-article");
    const article = await db.article.findUniqueOrThrow({ where: { slug: "buganda" } });
    const draft = (await exportArticle(db, article.id))!;
    await expect(
      loadArticle(db, { ...draft, slug: "unfinished-draft" }, null, {
        mode: "lenient",
        articleId: article.id,
      }),
    ).rejects.toThrow(/already uses the address/);
    await loadArticle(db, { ...draft, slug: "kingdom-of-buganda" }, null, {
      mode: "lenient",
      articleId: article.id,
    });
    expect((await db.article.findUniqueOrThrow({ where: { id: article.id } })).slug).toBe(
      "kingdom-of-buganda",
    );
  });
});

describe("publishing calendar", () => {
  it("publishes an approved article when it is due, as the approving editor", async () => {
    const { runDuePublications, scheduleArticle } = await import("@/server/content/schedule");
    const { articleId } = await loadArticle(db, { ...bugandaFile, slug: "scheduled-buganda" });
    const now = new Date("2030-01-01T09:00:00Z");
    await expect(
      scheduleArticle(db, editor, articleId, new Date("2030-01-01T10:00:00Z"), now),
    ).rejects.toThrow(/awaiting editorial approval/);
    await submitForReview(db, researcher, articleId);
    await approveResearch(db, editor, articleId);
    await expect(
      scheduleArticle(db, researcher, articleId, new Date("2030-01-01T10:00:00Z"), now),
    ).rejects.toThrow(/Only editors/);
    await expect(
      scheduleArticle(db, editor, articleId, new Date("2030-01-01T09:01:00Z"), now),
    ).rejects.toThrow(/at least 5 minutes/);
    await scheduleArticle(db, editor, articleId, new Date("2030-01-01T10:00:00Z"), now);
    await expect(
      scheduleArticle(db, editor, articleId, new Date("2030-01-01T11:00:00Z"), now),
    ).rejects.toThrow(/already scheduled/);

    // Not yet due.
    expect(await runDuePublications(db, new Date("2030-01-01T09:59:00Z"))).toEqual({
      published: [],
      failed: [],
    });
    const run = await runDuePublications(db, new Date("2030-01-01T10:00:30Z"));
    expect(run.published).toEqual([{ scheduleId: expect.any(String), slug: "scheduled-buganda" }]);
    const article = await db.article.findUniqueOrThrow({ where: { id: articleId } });
    expect(article.status).toBe("PUBLISHED");
    const schedule = await db.publicationSchedule.findFirstOrThrow({ where: { articleId } });
    expect(schedule).toMatchObject({ status: "PUBLISHED", approvedById: editor.id });
    // Running again does nothing.
    expect((await runDuePublications(db, new Date("2030-01-02T00:00:00Z"))).published).toHaveLength(
      0,
    );
    await unpublishArticle(db, editor, articleId, "Test cleanup");
  });

  it("cancels the schedule when changes are requested, and fails honestly when it cannot publish", async () => {
    const { runDuePublications, scheduleArticle } = await import("@/server/content/schedule");
    const article = await db.article.findUniqueOrThrow({ where: { slug: "scheduled-buganda" } });
    await submitForReview(db, researcher, article.id);
    await approveResearch(db, editor, article.id);
    const now = new Date("2030-02-01T09:00:00Z");
    await scheduleArticle(db, editor, article.id, new Date("2030-02-01T10:00:00Z"), now);
    await requestChanges(db, editor, article.id, "One more source for the 1966 crisis.");
    expect(
      await db.publicationSchedule.count({ where: { articleId: article.id, status: "CANCELLED" } }),
    ).toBe(1);

    // An editor who loses the role cannot have their old approvals executed.
    await submitForReview(db, researcher, article.id);
    await approveResearch(db, editor, article.id);
    await scheduleArticle(db, editor, article.id, new Date("2030-02-01T10:00:00Z"), now);
    await db.user.update({ where: { id: editor.id }, data: { role: "RESEARCHER" } });
    const run = await runDuePublications(db, new Date("2030-02-01T10:05:00Z"));
    await db.user.update({ where: { id: editor.id }, data: { role: "EDITOR" } });
    expect(run.failed).toEqual([
      { scheduleId: expect.any(String), reason: expect.stringMatching(/no longer has permission/) },
    ]);
    expect((await db.article.findUniqueOrThrow({ where: { id: article.id } })).status).toBe(
      "EDITORIAL_APPROVAL",
    );
  });
});
