import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { buildArticleView, listPublishedArticles } from "@/server/content/article-view";
import { ArticleLoadError, loadArticle, parseArticleFile } from "@/server/content/load-article";
import { PublishError, publishArticle, unpublishArticle } from "@/server/content/publish";
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

    const review = await db.editorialReview.findFirstOrThrow({ where: { articleId: article.id } });
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
      /RESEARCH_REVIEW; it can no longer be replaced/,
    );
  });
});
