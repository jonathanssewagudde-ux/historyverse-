/**
 * Grounded drafting: build the evidence a model may use, and check what it wrote against that
 * evidence. Pure functions (no database, no network) so every rule is unit-tested.
 *
 * Rules enforced after generation, whatever the model was told:
 *  - every sentence of a factual section must cite an evidence excerpt that exists;
 *    a sentence without a valid citation is removed and listed for the reviewer;
 *  - a key date is kept only if its year appears in the excerpt it cites;
 *  - long word-for-word overlaps with the evidence are flagged (the text must be paraphrased).
 */

export interface EvidenceExcerpt {
  /** Locator used in citations, e.g. "History" or "P571". Unique within its source. */
  locator: string;
  text: string;
  /** Years the excerpt states, when known structurally (Wikidata dates). */
  years?: number[];
}

export interface EvidenceSource {
  key: string;
  title: string;
  kind: string;
  tier: string;
  url: string;
  excerpts: EvidenceExcerpt[];
}

export const DRAFT_SECTION_KINDS = [
  "INTRODUCTION",
  "OVERVIEW",
  "CHRONOLOGY",
  "PEOPLE",
  "EVENTS",
  "CULTURE",
  "LEGACY",
  "CUSTOM",
] as const;

/** JSON Schema for the model's answer (kept to keywords every structured-output API accepts). */
export const draftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "summary", "sections", "keyDates"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "heading", "body"],
        properties: {
          kind: { type: "string", enum: [...DRAFT_SECTION_KINDS] },
          heading: { type: "string" },
          body: { type: "string" },
        },
      },
    },
    keyDates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "statement",
          "year",
          "month",
          "day",
          "precision",
          "approximate",
          "source",
          "locator",
        ],
        properties: {
          statement: { type: "string" },
          year: { type: "integer" },
          month: { type: "integer" },
          day: { type: "integer" },
          precision: { type: "string", enum: ["day", "month", "year", "decade", "century"] },
          approximate: { type: "boolean" },
          source: { type: "string" },
          locator: { type: "string" },
        },
      },
    },
  },
} as const;

export interface ModelDraft {
  title: string;
  subtitle: string;
  summary: string;
  sections: { kind: (typeof DRAFT_SECTION_KINDS)[number]; heading: string; body: string }[];
  keyDates: {
    statement: string;
    year: number;
    month: number;
    day: number;
    precision: "day" | "month" | "year" | "decade" | "century";
    approximate: boolean;
    source: string;
    locator: string;
  }[];
}

const yearText = (year: number) => (year < 0 ? `${-year} BC` : String(year));

/** System and user messages for the drafting request. */
export function buildDraftPrompt(topic: string, subject: string, sources: EvidenceSource[]) {
  const evidence = sources
    .map((s) =>
      [
        `<source key="${s.key}" title="${s.title.replace(/"/g, "'")}" kind="${s.kind}" tier="${s.tier}">`,
        ...s.excerpts.map(
          (e) => `<excerpt locator="${e.locator.replace(/"/g, "'")}">\n${e.text}\n</excerpt>`,
        ),
        "</source>",
      ].join("\n"),
    )
    .join("\n\n");

  const system = [
    "You draft encyclopedia articles for HISTORYVERSE, a history platform with strict sourcing rules.",
    "Your draft will be checked by researchers and an editor before anything is published.",
    "",
    "Rules:",
    "1. Use only facts stated in the evidence below. Do not add facts from memory, even well-known ones.",
    "2. End every sentence with a citation to the excerpt that supports it, written exactly as [@KEY|LOCATOR], e.g. [@s2|History]. Sentences without a valid citation are deleted automatically, so cite each one.",
    "3. Paraphrase. Never copy more than eight consecutive words from an excerpt. No quotations.",
    "4. Where excerpts disagree (for example two different dates), say so and present both accounts with their citations; do not choose one.",
    "5. Keep oral traditions and origin stories clearly labelled as traditions.",
    "6. Use neutral, plain English. No speculation, no superlatives the evidence does not support.",
    "7. Key dates: include only dates whose year appears in the cited excerpt. Use precision 'year' unless the excerpt gives the month or day; set month and day to 0 when not given. Negative years are BCE.",
    "8. Sections: start with an INTRODUCTION, then whichever of OVERVIEW, CHRONOLOGY, PEOPLE, EVENTS, CULTURE, LEGACY the evidence supports. Leave out what the evidence does not cover.",
    "9. The summary is one or two sentences for search results (20–300 characters), without citations.",
  ].join("\n");

  const user = [
    `Topic: ${topic}`,
    `Subject: ${subject}`,
    "",
    "Evidence (the only material you may use):",
    "",
    evidence,
    "",
    "Write the draft as JSON matching the schema.",
  ].join("\n");

  return { system, user };
}

const MARKER = /\[@([a-z0-9-]+)\|([^\]]+)\]/g;

/** Split prose into sentences, keeping trailing citation markers with their sentence. */
export function splitSentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?]+[.!?]+(?:["')\]]*)(?:\s*\[@[^\]]+\])*|[^.!?]+$/g) ?? [];
  return parts.map((s) => s.trim()).filter(Boolean);
}

function findExcerpt(sources: EvidenceSource[], key: string, locator: string) {
  const source = sources.find((s) => s.key === key);
  const wanted = locator.trim().toLowerCase();
  const excerpt = source?.excerpts.find((e) => e.locator.toLowerCase() === wanted);
  return source && excerpt ? { source, excerpt } : null;
}

const words = (text: string) =>
  text
    .replace(MARKER, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Passages of at least n words that appear verbatim in the evidence, merged into the longest
 * copied spans so the reviewer sees each passage once.
 */
export function copiedPhrases(text: string, sources: EvidenceSource[], n = 10): string[] {
  const evidence = new Set<string>();
  for (const s of sources)
    for (const e of s.excerpts) {
      const w = words(e.text);
      for (let i = 0; i + n <= w.length; i++) evidence.add(w.slice(i, i + n).join(" "));
    }
  const w = words(text);
  const copied = new Array<boolean>(w.length).fill(false);
  for (let i = 0; i + n <= w.length; i++) {
    if (evidence.has(w.slice(i, i + n).join(" "))) copied.fill(true, i, i + n);
  }
  const spans: string[] = [];
  for (let i = 0; i < w.length;) {
    if (!copied[i]) {
      i += 1;
      continue;
    }
    let end = i;
    while (end < w.length && copied[end]) end += 1;
    spans.push(w.slice(i, end).join(" "));
    i = end;
  }
  return spans;
}

export interface GroundingReport {
  removedSentences: { section: string; sentence: string; reason: string }[];
  removedKeyDates: { statement: string; reason: string }[];
  copiedPhrases: { section: string; phrase: string }[];
  keptSentences: number;
}

export interface GroundedDraft {
  sections: { kind: string; heading: string; body: string }[];
  keyDates: ModelDraft["keyDates"];
  report: GroundingReport;
}

/** Apply the grounding rules to what the model returned. */
export function groundDraft(draft: ModelDraft, sources: EvidenceSource[]): GroundedDraft {
  const report: GroundingReport = {
    removedSentences: [],
    removedKeyDates: [],
    copiedPhrases: [],
    keptSentences: 0,
  };
  const sections: GroundedDraft["sections"] = [];

  for (const section of draft.sections) {
    const label = section.heading || section.kind.toLowerCase();
    const paragraphs: string[] = [];
    for (const paragraph of section.body.split(/\n\s*\n/)) {
      const kept: string[] = [];
      for (const sentence of splitSentences(paragraph)) {
        const markers = [...sentence.matchAll(MARKER)];
        if (markers.length === 0) {
          report.removedSentences.push({ section: label, sentence, reason: "no citation" });
          continue;
        }
        const invalid = markers.filter((m) => !findExcerpt(sources, m[1]!, m[2]!));
        if (invalid.length === markers.length) {
          report.removedSentences.push({
            section: label,
            sentence,
            reason: `cites evidence that does not exist (${invalid.map((m) => m[0]).join(", ")})`,
          });
          continue;
        }
        // Drop only the invalid markers when at least one valid citation remains.
        let cleaned = sentence;
        for (const m of invalid) cleaned = cleaned.replace(m[0], "");
        kept.push(cleaned.replace(/\s+([.,;:])/g, "$1").trim());
        report.keptSentences += 1;
      }
      if (kept.length > 0) paragraphs.push(kept.join(" "));
    }
    if (paragraphs.length === 0) continue;
    const body = paragraphs.join("\n\n");
    for (const phrase of copiedPhrases(body, sources))
      report.copiedPhrases.push({ section: label, phrase });
    sections.push({ kind: section.kind, heading: section.heading, body });
  }

  const keyDates = draft.keyDates.filter((kd) => {
    const found = findExcerpt(sources, kd.source, kd.locator);
    if (!found) {
      report.removedKeyDates.push({
        statement: kd.statement,
        reason: "cites evidence that does not exist",
      });
      return false;
    }
    const supported =
      found.excerpt.years?.includes(kd.year) ??
      new RegExp(`(^|\\D)${Math.abs(kd.year)}(\\D|$)`).test(found.excerpt.text);
    if (!supported || kd.year === 0) {
      report.removedKeyDates.push({
        statement: kd.statement,
        reason: `the year ${yearText(kd.year)} does not appear in the cited excerpt`,
      });
      return false;
    }
    return true;
  });

  return { sections, keyDates, report };
}
