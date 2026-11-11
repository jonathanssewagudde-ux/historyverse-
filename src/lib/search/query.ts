import { toAstronomicalYear } from "@/lib/history/dates";
import { worldEras } from "@/lib/history/eras";

/**
 * Interpretation of what a reader typed. Years are pulled out so that "What happened in 1962?"
 * or "Who ruled France in 1804?" can match articles by date as well as by words.
 */
export interface ParsedQuery {
  /** The words to match, with the year phrase removed (may be empty). */
  text: string;
  /** Astronomical year mentioned in the query, if any. */
  year: number | null;
  /** The year as the reader wrote it, for display ("1962", "44 BCE"). */
  yearLabel: string | null;
}

const YEAR =
  /\b(?:in\s+(?:the\s+year\s+)?)?(\d{1,4})\s*(BCE|BC|CE|AD)\b|\b(?:in\s+(?:the\s+year\s+)?)?(\d{3,4})\b/i;
// Words that only frame a date question and carry no meaning for text matching.
const DATE_FRAMING = /\b(what|which|who|when|happened|happen|occurred|events?|took\s+place|in)\b/gi;

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.trim().replace(/\s+/g, " ").slice(0, 200);
  const m = YEAR.exec(q);
  if (!m) return { text: q, year: null, yearLabel: null };

  const digits = Number(m[1] ?? m[3]);
  const era = m[2]?.toUpperCase();
  if (!digits) return { text: q, year: null, yearLabel: null };
  const bce = era === "BCE" || era === "BC";
  const historical = bce ? -digits : digits;
  const rest = (q.slice(0, m.index) + " " + q.slice(m.index + m[0].length)).replace(
    /[?!.,]+/g,
    " ",
  );
  const text = rest.replace(DATE_FRAMING, " ").replace(/\s+/g, " ").trim();
  return {
    text,
    year: toAstronomicalYear(historical),
    yearLabel: bce ? `${digits} BCE` : String(digits),
  };
}

/** Astronomical-year bounds of each era, for period filters (open ends are unbounded). */
export function eraBounds(eraId: string): { from: number | null; to: number | null } | null {
  const era = worldEras.find((e) => e.id === eraId);
  if (!era) return null;
  return {
    from: era.start ? toAstronomicalYear(era.start.year) : null,
    to: era.end ? toAstronomicalYear(era.end.year) : null,
  };
}

export const CONTINENTS = [
  { id: "AFRICA", label: "Africa" },
  { id: "ASIA", label: "Asia" },
  { id: "EUROPE", label: "Europe" },
  { id: "NORTH_AMERICA", label: "North America" },
  { id: "SOUTH_AMERICA", label: "South America" },
  { id: "OCEANIA", label: "Oceania" },
  { id: "ANTARCTICA", label: "Antarctica" },
] as const;

/** Accepts "AFRICA", "Africa" or "north-america"; returns the canonical id or null. */
export function normaliseContinent(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return CONTINENTS.some((c) => c.id === key) ? key : null;
}

export const SEARCH_TYPES = {
  kingdoms: { label: "Kingdoms", templates: ["KINGDOM"] },
  countries: { label: "Countries", templates: ["COUNTRY"] },
  people: { label: "People", templates: ["BIOGRAPHY", "MONARCH", "PRESIDENT"] },
} as const;

export type SearchType = keyof typeof SEARCH_TYPES;

export function isSearchType(value: unknown): value is SearchType {
  return typeof value === "string" && value in SEARCH_TYPES;
}
