import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/server/db/client";
import { importFromWikidata, type ImportDeps } from "@/server/ingestion/wikidata-import";
import { parseCommonsFiles } from "@/server/sources/commons/client";
import type { WikidataClient } from "@/server/sources/wikidata/client";
import type { WbEntity } from "@/server/sources/wikidata/types";

/**
 * The importer against a real database, fed with real Wikidata/Commons responses captured as
 * fixtures (so the test needs no network). Labels are the ones Wikidata returns for these ids.
 */
const fixture = (qid: string): WbEntity =>
  JSON.parse(readFileSync(`tests/fixtures/wikidata/${qid}.json`, "utf8")).entities[qid];

const labels = new Map([
  ["Q938484", "Kabaka of Buganda"],
  ["Q12097", "king"],
  ["Q116", "monarch"],
  ["Q5", "human"],
  ["Q6581097", "male"],
]);

let fetched: string[] = [];
const wikidata: WikidataClient = {
  async getEntity(qid) {
    fetched.push(qid);
    try {
      return fixture(qid);
    } catch {
      throw new Error(`Request to www.wikidata.org failed (404) after 1 attempt(s).`);
    }
  },
  async getLabels(qids) {
    return new Map(qids.filter((q) => labels.has(q)).map((q) => [q, labels.get(q)!]));
  },
  async sparql() {
    return [];
  },
};
const commons = {
  async getFiles() {
    return parseCommonsFiles(
      JSON.parse(readFileSync("tests/fixtures/commons/Mutesa_I.json", "utf8")),
    );
  },
};

let db: PrismaClient;
let deps: ImportDeps;
const SEEDS = [
  { qid: "Q1036" },
  { qid: "Q473748", kind: "KINGDOM" as const },
  { qid: "Q3894" },
  { qid: "Q889311" },
  { qid: "Q707775" },
];

beforeAll(() => {
  db = getDb();
  deps = { db, wikidata, commons };
});
afterAll(async () => {
  await db.$disconnect();
});

describe("importFromWikidata", () => {
  it("imports entities as unreviewed drafts with their detail rows and dates", async () => {
    const report = await importFromWikidata(deps, { seeds: SEEDS, withMedia: true });
    expect(report.failed).toEqual([]);
    expect(report.created.sort()).toEqual(["Q1036", "Q3894", "Q473748", "Q707775", "Q889311"]);

    const uganda = await db.entity.findUniqueOrThrow({
      where: { wikidataId: "Q1036" },
      include: { country: true, startDate: true },
    });
    expect(uganda).toMatchObject({
      kind: "COUNTRY",
      slug: "uganda",
      status: "DRAFT",
      name: "Uganda",
    });
    expect(uganda.country).toMatchObject({ iso2: "UG", iso3: "UGA", continent: "AFRICA" });
    expect(uganda.startDate).toMatchObject({
      year: 1962,
      precision: "YEAR",
      month: null,
      day: null,
    });

    const mutesa = await db.entity.findUniqueOrThrow({
      where: { wikidataId: "Q889311" },
      include: { person: true, startDate: true, endDate: true, aliases: true },
    });
    expect(mutesa.kind).toBe("PERSON");
    expect(mutesa.person).toMatchObject({
      gender: "MALE",
      occupations: ["monarch"],
      isLiving: false,
    });
    expect(mutesa.startDate).toMatchObject({ year: 1837, precision: "YEAR", day: null });
    expect(mutesa.endDate).toMatchObject({ year: 1884, month: 10, day: 19, precision: "DAY" });
    expect(mutesa.aliases.map((a) => a.name)).toContain("Muteesa I of Buganda");
  });

  it("applies the kind hint through the entity → state → kingdom chain", async () => {
    const buganda = await db.entity.findUniqueOrThrow({
      where: { wikidataId: "Q473748" },
      include: { historicalState: { include: { kingdom: true, capital: true } } },
    });
    expect(buganda).toMatchObject({ kind: "KINGDOM", slug: "buganda" });
    expect(buganda.historicalState?.polityType).toBe("KINGDOM");
    expect(buganda.historicalState?.kingdom).not.toBeNull();
    expect(buganda.historicalState?.capital?.name).toBe("Kampala");
  });

  it("stores every statement as an unverified claim citing the exact Wikidata statement", async () => {
    const buganda = await db.entity.findUniqueOrThrow({ where: { wikidataId: "Q473748" } });
    const claims = await db.historicalClaim.findMany({
      where: { entityId: buganda.id },
      include: { citations: { include: { source: true } }, date: true },
    });
    expect(claims.length).toBeGreaterThan(4);
    for (const claim of claims) {
      expect(claim).toMatchObject({
        origin: "IMPORT",
        verification: "UNVERIFIED",
        verifiedById: null,
      });
      expect(claim.citations).toHaveLength(1);
      expect(claim.citations[0]!.locator).toMatch(/^Q473748\$/i);
      expect(claim.citations[0]!.source).toMatchObject({
        repository: "wikidata",
        url: "https://www.wikidata.org/wiki/Q473748",
        licenseNote: "CC0 1.0",
      });
    }
    const inception = claims.find((c) => c.property === "P571")!;
    expect(inception.statement).toBe("Buganda: inception is 1420 (Julian).");
    expect(inception.date).toMatchObject({ year: 1420, calendar: "JULIAN" });
    const capital = claims.find((c) => c.property === "P36")!;
    expect(capital.statement).toBe("Buganda: capital is Kampala.");
  });

  it("links people, places and offices that were imported together", async () => {
    const mutesa = await db.historicalPerson.findFirstOrThrow({
      where: { entity: { wikidataId: "Q889311" } },
      include: {
        relationsFrom: { include: { to: { include: { entity: true } } } },
        terms: { include: { office: true } },
      },
    });
    expect(mutesa.relationsFrom.map((r) => [r.type, r.to.entity.name, r.certainty])).toContainEqual(
      ["PARENT_OF", "Mwanga II", "PROBABLE"],
    );

    const mwanga = await db.historicalPerson.findFirstOrThrow({
      where: { entity: { wikidataId: "Q707775" } },
      include: { terms: { include: { office: true, startDate: true } } },
    });
    const kabaka = mwanga.terms.find((t) => t.office.wikidataId === "Q938484")!;
    expect(kabaka.office.name).toBe("Kabaka of Buganda");
    expect(kabaka.startDate).toMatchObject({ year: 1884, month: 10, day: 18 });

    const kampala = await db.entity.findUniqueOrThrow({
      where: { wikidataId: "Q3894" },
      include: { location: { include: { modernCountry: true } } },
    });
    expect(kampala.location?.modernCountry?.name).toBe("Uganda");
    expect(Number(kampala.location?.latitude)).toBeCloseTo(0.31, 1);
  });

  it("records image licence and attribution without classifying or publishing the image", async () => {
    const media = await db.mediaAsset.findFirstOrThrow({
      where: { sourceRef: "File:Mutesa I.jpg" },
      include: { license: true, entities: { include: { entity: true } } },
    });
    expect(media).toMatchObject({
      kind: "UNCLASSIFIED",
      reviewStatus: "PENDING",
      sourceName: "Wikimedia Commons",
      storageKey: null,
      attribution: "Unknown author, via Wikimedia Commons, Public domain",
    });
    expect(media.license.code).toBe("PD");
    expect(media.entities.map((e) => e.entity.name)).toEqual(["Muteesa I"]);
  });

  it("is idempotent: a second run creates no duplicates", async () => {
    const before = {
      entities: await db.entity.count(),
      claims: await db.historicalClaim.count(),
      ids: await db.externalIdentifier.count(),
      kin: await db.royalRelationship.count(),
      terms: await db.leadershipTerm.count(),
      media: await db.mediaAsset.count(),
      sources: await db.source.count(),
    };
    const report = await importFromWikidata(deps, { seeds: SEEDS, withMedia: true });
    expect(report.created).toEqual([]);
    expect(report.updated).toHaveLength(5);
    expect(report.claims).toBe(0);
    expect({
      entities: await db.entity.count(),
      claims: await db.historicalClaim.count(),
      ids: await db.externalIdentifier.count(),
      kin: await db.royalRelationship.count(),
      terms: await db.leadershipTerm.count(),
      media: await db.mediaAsset.count(),
      sources: await db.source.count(),
    }).toEqual(before);
  });

  it("never overwrites an entity that has entered review, and keeps verified claims", async () => {
    const reviewer = await db.user.create({
      data: { id: "import-reviewer", name: "Reviewer", email: "reviewer@test.invalid" },
    });
    const buganda = await db.entity.findUniqueOrThrow({ where: { wikidataId: "Q473748" } });
    await db.entity.update({
      where: { id: buganda.id },
      data: {
        status: "RESEARCH_REVIEW",
        name: "Kingdom of Buganda",
        summary: "Editor-written summary.",
      },
    });
    const claim = await db.historicalClaim.findFirstOrThrow({
      where: { entityId: buganda.id, property: "P36" },
    });
    await db.historicalClaim.update({
      where: { id: claim.id },
      data: { verification: "VERIFIED", verifiedById: reviewer.id, verifiedAt: new Date() },
    });

    const report = await importFromWikidata(deps, { seeds: [{ qid: "Q473748", kind: "KINGDOM" }] });
    expect(report.protectedFromOverwrite).toEqual(["Q473748"]);

    const after = await db.entity.findUniqueOrThrow({ where: { id: buganda.id } });
    expect(after).toMatchObject({
      name: "Kingdom of Buganda",
      summary: "Editor-written summary.",
      status: "RESEARCH_REVIEW",
    });
    expect(
      (await db.historicalClaim.findUniqueOrThrow({ where: { id: claim.id } })).verification,
    ).toBe("VERIFIED");
  });

  it("follows family links to discover relatives, within the entity limit", async () => {
    fetched = [];
    const report = await importFromWikidata(deps, {
      seeds: [{ qid: "Q889311" }],
      followKin: 1,
      maxEntities: 3,
    });
    // Mutesa I's father and children are attempted; only those with fixtures exist here.
    expect(fetched).toContain("Q707775");
    expect(fetched.length).toBeLessThanOrEqual(5);
    expect(
      report.warnings.some((w) => /limit of 3 entities/.test(w.message)) ||
        report.failed.length > 0,
    ).toBe(true);
  });

  it("reports failures honestly and records the run", async () => {
    const report = await importFromWikidata(deps, { seeds: [{ qid: "Q999999999" }] });
    expect(report.failed).toEqual([{ qid: "Q999999999", error: expect.stringMatching(/404/) }]);
    expect(await db.entity.count({ where: { wikidataId: "Q999999999" } })).toBe(0);

    const job = await db.productionJob.findUniqueOrThrow({ where: { id: report.jobId } });
    expect(job).toMatchObject({ type: "INGESTION", status: "FAILED" });
    const audit = await db.auditLog.findFirst({
      where: { action: "ingestion.wikidata_import", targetId: report.jobId },
    });
    expect(audit).not.toBeNull();
  });
});
