import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { loadArticle } from "@/server/content/load-article";
import { publishArticle, unpublishArticle } from "@/server/content/publish";
import { approveResearch, submitForReview } from "@/server/content/workflow";
import { getDb } from "@/server/db/client";
import { reindexAll } from "@/server/search/indexer";
import { searchArticles, suggest } from "@/server/search/search";

/**
 * Search over real published content: the Buganda article file plus a second, small fixture
 * article, published through the normal editorial path.
 */
const buganda = JSON.parse(readFileSync("data/articles/buganda-kingdom.json", "utf8"));
const editor = { id: "search-editor", email: "editor@search.invalid", role: "EDITOR" as const };

const ugandaFixture = {
  slug: "uganda-test-fixture",
  title: "Uganda Test Fixture",
  summary: "A short fixture article about Uganda used only by the search tests.",
  template: "COUNTRY",
  primaryEntity: { wikidataId: "Q1036" },
  authoring: "human",
  sources: [
    {
      key: "loc-1990",
      type: "BOOK",
      title: "Uganda: A Country Study",
      url: "https://countrystudies.us/uganda/",
      accessedAt: "2026-11-11",
    },
  ],
  sections: [
    {
      kind: "INTRODUCTION",
      body: "Uganda gained independence in October 1962.[@loc-1990|Power Politics in Buganda]",
    },
  ],
  keyDates: [
    {
      statement: "Uganda becomes independent.",
      date: { year: 1962, month: 10, precision: "month" },
      cite: [{ source: "loc-1990", locator: "Power Politics in Buganda" }],
    },
  ],
};

let db: PrismaClient;

beforeAll(async () => {
  db = getDb();
  await db.user.create({
    data: { id: editor.id, name: "Editor", email: editor.email, role: "EDITOR" },
  });
  await db.entity.create({
    data: {
      wikidataId: "Q473748",
      kind: "KINGDOM",
      slug: "buganda",
      name: "Buganda",
      aliases: { create: [{ name: "Buganda Kingdom" }] },
      historicalState: { create: { polityType: "KINGDOM", continent: "AFRICA" } },
      startDate: {
        create: { year: 1420, precision: "YEAR", sortKey: 14200101n, calendar: "JULIAN" },
      },
    },
  });
  await db.entity.create({
    data: {
      wikidataId: "Q1036",
      kind: "COUNTRY",
      slug: "uganda",
      name: "Uganda",
      country: { create: { continent: "AFRICA", iso2: "UG" } },
    },
  });
  await db.entity.create({
    data: { wikidataId: "Q889311", kind: "PERSON", slug: "muteesa-i", name: "Muteesa I" },
  });
  for (const file of [buganda, ugandaFixture]) {
    const { articleId } = await loadArticle(db, file);
    await submitForReview(db, editor, articleId);
    await approveResearch(db, editor, articleId);
    await publishArticle(db, editor, articleId);
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("indexing", () => {
  it("indexes exactly the published articles, with names, dates and region", async () => {
    const docs = await db.searchDocument.findMany({ orderBy: { title: "asc" } });
    expect(docs.map((d) => d.path)).toEqual([
      "/kingdoms/buganda",
      "/countries/uganda-test-fixture",
    ]);
    const doc = docs[0]!;
    expect(doc.names).toEqual(expect.arrayContaining(["Buganda", "Buganda Kingdom", "Muteesa I"]));
    expect(doc.continents).toEqual(["AFRICA"]);
    expect(doc.countries).toContain("Uganda");
    expect(doc.startYear).toBe(1420);
    expect(doc.dateYears).toEqual(expect.arrayContaining([1844, 1900, 1962, 1993]));
    expect(doc.body).not.toMatch(/\[\^\d+\]/);
  });

  it("can be rebuilt from scratch", async () => {
    await db.searchDocument.deleteMany();
    expect(await reindexAll(db)).toEqual({ indexed: 2, removed: 0 });
  });
});

describe("searchArticles", () => {
  it("finds an article by its subject and highlights the match", async () => {
    const res = await searchArticles(db, { q: "Buganda Agreement" });
    expect(res.mode).toBe("text");
    expect(res.hits[0]!.path).toBe("/kingdoms/buganda");
    expect(res.hits[0]!.snippet.some((p) => p.match && /agreement/i.test(p.text))).toBe(true);
  });

  it("understands natural-language questions", async () => {
    const res = await searchArticles(db, { q: "Who was Kabaka Mwanga?" });
    expect(res.hits.map((h) => h.path)).toContain("/kingdoms/buganda");
  });

  it("ignores accents", async () => {
    const res = await searchArticles(db, { q: "Muteesá" });
    expect(res.hits[0]?.path).toBe("/kingdoms/buganda");
  });

  it("answers year questions with the matching key dates", async () => {
    const res = await searchArticles(db, { q: "What happened in 1962?" });
    expect(res.mode).toBe("year");
    expect(res.yearLabel).toBe("1962");
    expect(res.hits.map((h) => h.path).sort()).toEqual([
      "/countries/uganda-test-fixture",
      "/kingdoms/buganda",
    ]);
    const fixture = res.hits.find((h) => h.path === "/countries/uganda-test-fixture")!;
    expect(fixture.matchedDates).toEqual([
      { label: "October 1962", statement: "Uganda becomes independent." },
    ]);
  });

  it("tolerates typos and suggests the intended name", async () => {
    const res = await searchArticles(db, { q: "Bugnda" });
    expect(res.mode).toBe("fuzzy");
    expect(res.hits[0]?.path).toBe("/kingdoms/buganda");
    expect(res.didYouMean).toMatch(/^Buganda/);
  });

  it("filters by type, continent and era, and counts facets", async () => {
    expect(
      (await searchArticles(db, { q: "Uganda", type: "kingdoms" })).hits.map((h) => h.path),
    ).toEqual(["/kingdoms/buganda"]);
    const all = await searchArticles(db, { q: "Uganda" });
    expect(all.facets.type).toMatchObject({ kingdoms: 1, countries: 1, people: 0 });
    expect(all.facets.continent).toMatchObject({ AFRICA: 2 });
    expect((await searchArticles(db, { q: "Uganda", continent: "EUROPE" })).total).toBe(0);
    // Buganda's subject starts in 1420 with no end date, so it overlaps the medieval era.
    expect((await searchArticles(db, { era: "medieval" })).hits.map((h) => h.path)).toEqual([
      "/kingdoms/buganda",
    ]);
    expect((await searchArticles(db, { era: "prehistory" })).total).toBe(0);
  });

  it("returns nothing invented when nothing matches", async () => {
    const res = await searchArticles(db, { q: "Mongol Empire Genghis" });
    expect(res.total).toBe(0);
    expect(res.hits).toEqual([]);
    expect(res.indexSize).toBe(2);
  });

  it("browses everything published when there is no query", async () => {
    const res = await searchArticles(db, {});
    expect(res.mode).toBe("browse");
    expect(res.total).toBe(2);
  });

  it("is safe against SQL and tsquery syntax in input", async () => {
    for (const q of ["'; DROP TABLE articles; --", "a & | ! (", '"unclosed', "\\", "%_%"]) {
      await expect(searchArticles(db, { q })).resolves.toBeTruthy();
      await expect(suggest(db, q)).resolves.toBeTruthy();
    }
    expect(await db.article.count()).toBe(2);
  });
});

describe("suggest", () => {
  it("completes partial words and shows the alias that matched", async () => {
    const results = await suggest(db, "bugan");
    expect(results[0]).toMatchObject({ path: "/kingdoms/buganda", template: "KINGDOM" });
    const viaAlias = await suggest(db, "mutee");
    expect(viaAlias[0]).toMatchObject({ path: "/kingdoms/buganda", via: "Muteesa I" });
    expect(await suggest(db, "b")).toEqual([]);
  });
});

describe("unpublishing", () => {
  it("removes the article from search immediately", async () => {
    const article = await db.article.findUniqueOrThrow({ where: { slug: "uganda-test-fixture" } });
    await unpublishArticle(db, editor, article.id, "search test");
    expect((await searchArticles(db, { q: "Uganda" })).hits.map((h) => h.path)).toEqual([
      "/kingdoms/buganda",
    ]);
    expect(await db.searchDocument.count()).toBe(1);
  });
});
