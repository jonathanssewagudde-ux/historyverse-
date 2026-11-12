import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { costUsd, estimateTokens, priceFor } from "@/server/ai/pricing";
import {
  buildDraftPrompt,
  copiedPhrases,
  groundDraft,
  splitSentences,
  type EvidenceSource,
  type ModelDraft,
} from "./grounding";
import { dedupeBooks, searchTermsFor } from "./research-job";
import { splitSections } from "./sources";

const evidence: EvidenceSource[] = [
  {
    key: "s1",
    title: "Wikidata: Buganda (Q473748)",
    kind: "STRUCTURED_DATA",
    tier: "TERTIARY",
    url: "https://www.wikidata.org/wiki/Q473748",
    excerpts: [{ locator: "P571", text: "Buganda: inception is 1420. (1420)", years: [1420] }],
  },
  {
    key: "s2",
    title: "Wikipedia: Buganda",
    kind: "ENCYCLOPEDIA",
    tier: "TERTIARY",
    url: "https://en.wikipedia.org/wiki/Buganda",
    excerpts: [
      {
        locator: "History",
        text: "The kingdom was abolished in 1967 by the government of Milton Obote and restored in 1993 under the 1995 constitution framework.",
      },
    ],
  },
];

const draft = (overrides: Partial<ModelDraft> = {}): ModelDraft => ({
  title: "Buganda",
  subtitle: "",
  summary: "A kingdom in Uganda.",
  sections: [
    {
      kind: "INTRODUCTION",
      heading: "",
      body: "Buganda is said to date from the fifteenth century [@s1|P571]. It is the largest kingdom in the region. Its kabaka was deposed [@s9|Nowhere].\n\nThe kingdom was abolished in 1967 and later restored [@s2|history].",
    },
  ],
  keyDates: [
    {
      statement: "Abolition",
      year: 1967,
      month: 0,
      day: 0,
      precision: "year",
      approximate: false,
      source: "s2",
      locator: "History",
    },
    {
      statement: "Invented date",
      year: 1888,
      month: 0,
      day: 0,
      precision: "year",
      approximate: false,
      source: "s2",
      locator: "History",
    },
    {
      statement: "Bad source",
      year: 1420,
      month: 0,
      day: 0,
      precision: "year",
      approximate: false,
      source: "s7",
      locator: "P571",
    },
    {
      statement: "Founding",
      year: 1420,
      month: 0,
      day: 0,
      precision: "year",
      approximate: true,
      source: "s1",
      locator: "P571",
    },
  ],
  ...overrides,
});

describe("grounding a model draft", () => {
  it("keeps only sentences that cite existing evidence, and says why the rest went", () => {
    const grounded = groundDraft(draft(), evidence);
    expect(grounded.sections).toHaveLength(1);
    expect(grounded.sections[0]!.body).toBe(
      "Buganda is said to date from the fifteenth century [@s1|P571].\n\nThe kingdom was abolished in 1967 and later restored [@s2|history].",
    );
    expect(grounded.report.removedSentences).toEqual([
      {
        section: "introduction",
        sentence: "It is the largest kingdom in the region.",
        reason: "no citation",
      },
      {
        section: "introduction",
        sentence: "Its kabaka was deposed [@s9|Nowhere].",
        reason: "cites evidence that does not exist ([@s9|Nowhere])",
      },
    ]);
    expect(grounded.report.keptSentences).toBe(2);
  });

  it("keeps a key date only when its year is in the cited excerpt", () => {
    const grounded = groundDraft(draft(), evidence);
    expect(grounded.keyDates.map((k) => k.statement)).toEqual(["Abolition", "Founding"]);
    expect(grounded.report.removedKeyDates).toEqual([
      { statement: "Invented date", reason: "the year 1888 does not appear in the cited excerpt" },
      { statement: "Bad source", reason: "cites evidence that does not exist" },
    ]);
  });

  it("drops a section with nothing supported, and flags word-for-word copying", () => {
    const grounded = groundDraft(
      draft({
        sections: [
          {
            kind: "CULTURE",
            heading: "Culture",
            body: "Unsupported claim one. Unsupported claim two.",
          },
          {
            kind: "LEGACY",
            heading: "Legacy",
            body: "The kingdom was abolished in 1967 by the government of Milton Obote and restored later [@s2|History].",
          },
        ],
      }),
      evidence,
    );
    expect(grounded.sections.map((s) => s.heading)).toEqual(["Legacy"]);
    expect(grounded.report.copiedPhrases).toEqual([
      {
        section: "Legacy",
        phrase: "the kingdom was abolished in 1967 by the government of milton obote and restored",
      },
    ]);
  });

  it("splits sentences without separating citations from them", () => {
    expect(splitSentences("One [@s1|A]. Two? [@s2|B] Three.")).toEqual([
      "One [@s1|A].",
      "Two? [@s2|B]",
      "Three.",
    ]);
    expect(copiedPhrases("nothing like the evidence here at all really", evidence)).toEqual([]);
  });

  it("gives the model only the evidence, with its keys and locators", () => {
    const { system, user } = buildDraftPrompt(
      "The History of Buganda",
      "Buganda (kingdom)",
      evidence,
    );
    expect(system).toContain("Use only facts stated in the evidence");
    expect(user).toContain('<source key="s2" title="Wikipedia: Buganda"');
    expect(user).toContain('<excerpt locator="P571">');
  });
});

describe("research sources", () => {
  it("splits a real Wikipedia extract into sections and skips reference lists", () => {
    const page = JSON.parse(
      readFileSync("tests/fixtures/research/wikipedia-buganda-extract.json", "utf8"),
    ).query.pages[0];
    const sections = splitSections(page.extract);
    expect(sections[0]!.heading).toBe("Introduction");
    expect(sections[0]!.text).toMatch(/^Buganda is a Bantu kingdom within Uganda/);
    expect(sections.map((s) => s.heading)).not.toContain("References");
    expect(sections.every((s) => s.text.length <= 2402)).toBe(true);
  });

  it("turns a title into catalogue search terms", () => {
    expect(searchTermsFor("The Complete History of the Buganda Kingdom")).toBe("Buganda Kingdom");
    expect(searchTermsFor("History of Rome")).toBe("Rome");
    expect(searchTermsFor("Buganda")).toBe("Buganda");
  });

  it("counts other editions of the same book once, but keeps different books", () => {
    const books = [
      {
        title: "Desecration of my kingdom",
        authors: ["Mutesa II King of Buganda."],
        firstPublished: 1972,
      },
      {
        title: "Desecration of my kingdom",
        authors: ["Mutesa II Kabaka of Buganda."],
        firstPublished: 1967,
      },
      { title: "Buganda", authors: ["A. Author"], firstPublished: 1993 },
      { title: "Buganda", authors: ["B. Writer"], firstPublished: 1950 },
    ];
    expect(dedupeBooks(books).map((b) => `${b.title} ${b.firstPublished}`)).toEqual([
      "Desecration of my kingdom 1967",
      "Buganda 1993",
      "Buganda 1950",
    ]);
  });
});

describe("pricing", () => {
  const base = { AI_INPUT_USD_PER_MTOK: undefined, AI_OUTPUT_USD_PER_MTOK: undefined };

  it("knows current Claude list prices, lets configuration override them, and treats Ollama as free", () => {
    expect(
      priceFor({ ...base, AI_PROVIDER: "anthropic", AI_MODEL: "claude-opus-5-5" }),
    ).toMatchObject({
      input: 4,
      output: 20,
    });
    expect(
      priceFor({
        AI_PROVIDER: "anthropic",
        AI_MODEL: "claude-opus-5-5",
        AI_INPUT_USD_PER_MTOK: 1,
        AI_OUTPUT_USD_PER_MTOK: 2,
      }),
    ).toMatchObject({ input: 1, output: 2 });
    expect(priceFor({ ...base, AI_PROVIDER: "ollama", AI_MODEL: "llama3.1" })).toMatchObject({
      input: 0,
      output: 0,
    });
  });

  it("never assumes an unknown paid model is free", () => {
    expect(priceFor({ ...base, AI_PROVIDER: "openai", AI_MODEL: "some-model" })).toBeNull();
    expect(priceFor({ ...base, AI_PROVIDER: "anthropic", AI_MODEL: "claude-unknown" })).toBeNull();
  });

  it("computes costs and conservative token estimates", () => {
    expect(costUsd({ input: 4, output: 20, basis: "" }, 1_000_000, 100_000)).toBe(6);
    expect(estimateTokens("abcdefghi")).toBe(3);
  });
});
