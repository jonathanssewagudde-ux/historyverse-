/**
 * Turn a reviewed article into a documentary scene plan, following the structure in
 * CONTENT_PIPELINE.md: hook → background → origins → developments → figures → turning points →
 * consequences → significance → conclusion.
 *
 * Nothing is written here: every narration line is the article's own reviewed text, and every
 * scene keeps the citations that support it. A beat with no material is left out, not invented.
 */
import { estimateSpeechSeconds, narrationText } from "@/server/audio/audio";

export const BEATS = [
  "hook",
  "background",
  "origins",
  "developments",
  "figures",
  "turning-points",
  "consequences",
  "significance",
  "conclusion",
] as const;
export type Beat = (typeof BEATS)[number];

export const BEAT_LABELS: Record<Beat, string> = {
  hook: "Hook",
  background: "Background",
  origins: "Origins",
  developments: "Key developments",
  figures: "Important figures",
  "turning-points": "Turning points",
  consequences: "Consequences",
  significance: "Significance",
  conclusion: "Conclusion",
};

export interface SourceSection {
  kind: string;
  heading: string | null;
  /** Stored body with [^n] citation markers. */
  body: string;
  citations: { id: string; position: number }[];
}

export interface SourceKeyDate {
  label: string;
  statement: string;
  citationIds: string[];
}

export interface SourceAsset {
  id: string;
  title: string;
  kind: string;
}

export interface PlannedScene {
  beat: Beat;
  narration: string;
  citationIds: string[];
  onScreenText: string | null;
  visualDescription: string;
  durationSeconds: number;
  assets: { mediaId: string; motion: string }[];
}

const MAX_WORDS = 90;
const MOTIONS = ["push-in", "pan-right", "pan-left", "push-out"];
const ORIGIN_HEADING = /origin|found|beginning|early|emergence|rise/i;

// Citation markers are not spoken, so they do not count as words.
const words = (s: string) =>
  s
    .replace(/\[\^\d+\]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

/** Split a paragraph into chunks of at most MAX_WORDS, at sentence boundaries. */
function chunk(paragraph: string): string[] {
  if (words(paragraph) <= MAX_WORDS) return [paragraph];
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*(?:\s*\[\^\d+\])*|[^.!?]+$/g) ?? [
    paragraph,
  ];
  const out: string[] = [];
  let current = "";
  for (const s of sentences.map((x) => x.trim())) {
    if (current && words(current) + words(s) > MAX_WORDS) {
      out.push(current);
      current = s;
    } else current = current ? `${current} ${s}` : s;
  }
  if (current) out.push(current);
  return out;
}

function beatForSection(section: SourceSection): Beat | null {
  // A section about origins is the origins beat, whatever its type (e.g. an overview titled
  // "Origins: two accounts").
  const fixedKinds = ["INTRODUCTION", "PEOPLE", "LEGACY", "FURTHER_READING"];
  if (
    !fixedKinds.includes(section.kind) &&
    section.heading &&
    ORIGIN_HEADING.test(section.heading)
  ) {
    return "origins";
  }
  switch (section.kind) {
    case "INTRODUCTION":
    case "OVERVIEW":
      return "background";
    case "PEOPLE":
      return "figures";
    case "CULTURE":
      return "significance";
    case "LEGACY":
      return "consequences";
    case "FURTHER_READING":
      return null;
    default:
      return section.heading && ORIGIN_HEADING.test(section.heading) ? "origins" : "developments";
  }
}

const KIND_LABEL: Record<string, string> = {
  AUTHENTIC_PHOTO: "Archival photograph",
  AUTHENTIC_DOCUMENT: "Historical document",
  ARTWORK: "Historical artwork",
  MAP: "Map",
  MODERN_PHOTO: "Modern photograph",
  DIAGRAM: "Diagram",
  AI_RECONSTRUCTION: "AI reconstruction (labelled on screen)",
};

export function planScenes(input: {
  title: string;
  sections: SourceSection[];
  keyDates: SourceKeyDate[];
  /** Approved, publishable images; the first is used for the hook. */
  assets: SourceAsset[];
}): PlannedScene[] {
  const raw: Omit<PlannedScene, "assets" | "visualDescription" | "durationSeconds">[] = [];

  input.sections.forEach((section, sIndex) => {
    const beat = beatForSection(section);
    if (!beat) return;
    const paragraphs = section.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const isLastLegacy =
      section.kind === "LEGACY" &&
      !input.sections.slice(sIndex + 1).some((s) => s.kind === "LEGACY");
    paragraphs.forEach((paragraph, pIndex) => {
      // Citations are paragraph-level: they support every chunk the paragraph is split into.
      const positions = [...paragraph.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
      const citationIds = section.citations
        .filter((c) => positions.includes(c.position))
        .map((c) => c.id);
      const chunks = chunk(paragraph);
      chunks.forEach((text, cIndex) => {
        let sceneBeat = beat;
        if (section.kind === "INTRODUCTION" && pIndex === 0 && cIndex === 0) sceneBeat = "hook";
        if (isLastLegacy && pIndex === paragraphs.length - 1 && cIndex === chunks.length - 1)
          sceneBeat = "conclusion";
        raw.push({
          beat: sceneBeat,
          narration: narrationText(text),
          citationIds,
          onScreenText: sceneBeat === "hook" ? input.title : section.heading,
        });
      });
    });
  });

  // Turning points: the article's cited key dates, up to four per scene.
  for (let i = 0; i < input.keyDates.length; i += 4) {
    const group = input.keyDates.slice(i, i + 4);
    raw.push({
      beat: "turning-points",
      narration: group.map((d) => `${d.label}. ${d.statement}`).join(" "),
      citationIds: [...new Set(group.flatMap((d) => d.citationIds))],
      onScreenText:
        group.length > 1 ? `${group[0]!.label} – ${group.at(-1)!.label}` : group[0]!.label,
    });
  }

  const ordered = raw
    .map((scene, index) => ({ scene, index }))
    .sort((a, b) => BEATS.indexOf(a.scene.beat) - BEATS.indexOf(b.scene.beat) || a.index - b.index)
    .map(({ scene }) => scene);

  return ordered.map((scene, i) => {
    const asset = input.assets.length > 0 ? input.assets[i % input.assets.length]! : null;
    return {
      ...scene,
      durationSeconds: estimateSpeechSeconds(scene.narration),
      assets: asset ? [{ mediaId: asset.id, motion: MOTIONS[i % MOTIONS.length]! }] : [],
      visualDescription: asset
        ? `${KIND_LABEL[asset.kind] ?? "Image"}: ${asset.title}`
        : `Needs an image for “${BEAT_LABELS[scene.beat]}”.`,
    };
  });
}
