import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { formatHistoricalDate } from "@/lib/history/dates";
import { bestStatements, mapWikidataEntity, slugify } from "./mapper";
import type { WbEntity, WbStatement } from "./types";

/** Fixtures are real Wikidata responses (CC0), trimmed to the properties the importer reads. */
const load = (qid: string): WbEntity =>
  JSON.parse(readFileSync(`tests/fixtures/wikidata/${qid}.json`, "utf8")).entities[qid];

describe("mapWikidataEntity (real Wikidata data)", () => {
  it("maps a person: Muteesa I", () => {
    const m = mapWikidataEntity(load("Q889311"));
    expect(m).toMatchObject({
      qid: "Q889311",
      kind: "PERSON",
      kindFromSource: true,
      name: "Muteesa I",
    });
    expect(m.wikipediaTitle).toBe("Muteesa I of Buganda");
    expect(m.person).toMatchObject({
      gender: "MALE",
      birthPlaceQid: "Q6933715",
      deathPlaceQid: "Q309426",
    });
    expect(m.aliases.map((a) => a.name)).toContain("Muteesa I of Buganda");
    expect(m.imageFile).toBe("Mutesa I.jpg");
  });

  it("keeps Wikidata's date precision instead of inventing a day", () => {
    const m = mapWikidataEntity(load("Q889311"));
    // Wikidata stores the birth as +1837-01-01 with YEAR precision: only the year is known.
    expect(m.startDate).toEqual({ year: 1837, precision: "year" });
    expect(formatHistoricalDate(m.startDate!)).toBe("1837");
    expect(formatHistoricalDate(m.endDate!)).toBe("19 October 1884");
  });

  it("records family links as directed parent → child relationships", () => {
    const m = mapWikidataEntity(load("Q889311"));
    expect(m.kinship).toContainEqual(
      expect.objectContaining({ type: "PARENT_OF", fromQid: "Q7638738", toQid: "Q889311" }),
    );
    expect(m.kinship).toContainEqual(
      expect.objectContaining({ type: "PARENT_OF", fromQid: "Q889311", toQid: "Q707775" }),
    );
    expect(m.referencedQids).toEqual(expect.arrayContaining(["Q7638738", "Q707775", "Q473748"]));
  });

  it("reads offices held with their qualifiers", () => {
    const mwanga = mapWikidataEntity(load("Q707775"));
    const kabaka = mwanga.terms.find((t) => t.officeQid === "Q938484");
    expect(kabaka).toBeDefined();
    expect(formatHistoricalDate(kabaka!.start!)).toBe("18 October 1884");
  });

  it("maps a country: Uganda", () => {
    const m = mapWikidataEntity(load("Q1036"));
    expect(m.kind).toBe("COUNTRY");
    expect(m.country).toEqual({
      iso2: "UG",
      iso3: "UGA",
      continent: "AFRICA",
      capitalQid: "Q3894",
    });
    expect(m.startDate).toEqual({ year: 1962, precision: "year" });
  });

  it("maps a historical state and honours a more specific kind hint, with a warning", () => {
    const plain = mapWikidataEntity(load("Q473748"));
    expect(plain.kind).toBe("HISTORICAL_STATE");
    expect(plain.state).toEqual({ continent: null, capitalQid: "Q3894" });
    expect(plain.countryQid).toBe("Q1036");

    const hinted = mapWikidataEntity(load("Q473748"), "KINGDOM");
    expect(hinted.kind).toBe("KINGDOM");
    expect(hinted.kindFromSource).toBe(false);
    expect(hinted.warnings.join(" ")).toMatch(/hint KINGDOM differs/);
  });

  it("maps a city with coordinates", () => {
    const m = mapWikidataEntity(load("Q3894"));
    expect(m.kind).toBe("LOCATION");
    expect(m.location!.latitude).toBeCloseTo(0.31, 1);
    expect(m.location!.longitude).toBeCloseTo(32.58, 1);
  });

  it("keeps a statement id on every claim for traceability", () => {
    const m = mapWikidataEntity(load("Q473748"));
    expect(m.claims.length).toBeGreaterThan(4);
    for (const claim of m.claims) expect(claim.statementId).toMatch(/^Q473748\$/i);
    const inception = m.claims.find((c) => c.property === "P571");
    // Wikidata records pre-1582 dates in the Julian calendar; that is preserved, not normalised away.
    expect(inception?.date).toEqual({ year: 1420, precision: "year", calendar: "julian" });
  });
});

describe("bestStatements", () => {
  const st = (
    rank: WbStatement["rank"],
    snaktype: "value" | "somevalue" = "value",
  ): WbStatement => ({
    rank,
    mainsnak: { snaktype, property: "P1", datavalue: { type: "string", value: rank } },
  });

  it("drops deprecated and unknown-value statements, and prefers preferred rank", () => {
    expect(
      bestStatements([st("deprecated"), st("normal"), st("normal", "somevalue")]),
    ).toHaveLength(1);
    expect(bestStatements([st("normal"), st("preferred")]).map((s) => s.rank)).toEqual([
      "preferred",
    ]);
    expect(bestStatements(undefined)).toEqual([]);
  });
});

describe("slugify", () => {
  it.each([
    ["Muteesa I", "muteesa-i"],
    ["Simón Bolívar", "simon-bolivar"],
    ["Bunyoro-Kitara", "bunyoro-kitara"],
    ["  Côte d'Ivoire ", "cote-d-ivoire"],
    ["中文", "q42"],
  ])("%s → %s", (name, expected) => expect(slugify(name, "Q42")).toBe(expected));
});
