import {
  InvalidHistoricalDateError,
  parseWikidataTime,
  type HistoricalDate,
} from "@/lib/history/dates";
import type { WbCoordinate, WbEntity, WbEntityId, WbSnak, WbStatement, WbTime } from "./types";

/**
 * Pure mapping from a Wikidata entity to HISTORYVERSE's import model. No I/O, no guessing:
 * anything Wikidata does not state is left empty, and every statement keeps its statement id so
 * it can be traced back to the exact source assertion.
 */

export type ImportKind =
  | "COUNTRY"
  | "TERRITORY"
  | "HISTORICAL_STATE"
  | "KINGDOM"
  | "EMPIRE"
  | "CIVILIZATION"
  | "DYNASTY"
  | "PERSON"
  | "EVENT"
  | "PERIOD"
  | "LOCATION"
  | "TOPIC";

/** Wikidata classes (P31 values) that identify a kind with confidence. Deliberately short. */
const KIND_BY_CLASS: Record<string, ImportKind> = {
  Q5: "PERSON",
  Q6256: "COUNTRY",
  Q3624078: "COUNTRY", // sovereign state
  Q417175: "KINGDOM",
  Q48349: "EMPIRE",
  Q3024240: "HISTORICAL_STATE", // historical country
  Q28171280: "HISTORICAL_STATE", // ancient civilization is handled by hint; this is "historical state"
  Q8432: "CIVILIZATION",
  Q164950: "DYNASTY",
  Q515: "LOCATION", // city
  Q5119: "LOCATION", // capital city
  Q1549591: "LOCATION", // big city
  Q839954: "LOCATION", // archaeological site
  Q198: "EVENT", // war
  Q178561: "EVENT", // battle
  Q11514315: "PERIOD", // historical period
};

const CONTINENT_BY_QID: Record<string, string> = {
  Q15: "AFRICA",
  Q48: "ASIA",
  Q46: "EUROPE",
  Q49: "NORTH_AMERICA",
  Q18: "SOUTH_AMERICA",
  Q55643: "OCEANIA",
  Q538: "OCEANIA",
  Q51: "ANTARCTICA",
};

const GENDER_BY_QID: Record<string, "FEMALE" | "MALE" | "OTHER"> = {
  Q6581072: "FEMALE",
  Q6581097: "MALE",
  Q1052281: "FEMALE",
  Q2449503: "MALE",
  Q48270: "OTHER",
};

/** Properties stored as provenance-carrying claims, with a readable label for the statement text. */
export const CLAIM_PROPERTIES: Record<string, string> = {
  P31: "instance of",
  P569: "date of birth",
  P570: "date of death",
  P571: "inception",
  P576: "dissolved, abolished or demolished",
  P580: "start time",
  P582: "end time",
  P585: "point in time",
  P19: "place of birth",
  P20: "place of death",
  P21: "sex or gender",
  P106: "occupation",
  P17: "country",
  P36: "capital",
  P30: "continent",
  P27: "country of citizenship",
  P39: "position held",
  P22: "father",
  P25: "mother",
  P26: "spouse",
  P40: "child",
  P53: "family",
  P1365: "replaces",
  P1366: "replaced by",
  P131: "located in the administrative territorial entity",
  P625: "coordinate location",
  P297: "ISO 3166-1 alpha-2 code",
  P298: "ISO 3166-1 alpha-3 code",
};

export interface ImportedClaim {
  /** Wikidata statement GUID. */
  statementId: string | null;
  property: string;
  propertyLabel: string;
  value:
    | { type: "entity"; id: string }
    | { type: "time"; raw: WbTime }
    | { type: "string"; text: string }
    | { type: "coordinate"; latitude: number; longitude: number };
  date: HistoricalDate | null;
  rank: WbStatement["rank"];
}

export interface ImportedTerm {
  officeQid: string;
  start: HistoricalDate | null;
  end: HistoricalDate | null;
  ordinal: number | null;
  statementId: string | null;
}

export interface ImportedKinship {
  /** Direction is always parent → child or spouse ↔ spouse, expressed as QIDs. */
  type: "PARENT_OF" | "SPOUSE_OF";
  fromQid: string;
  toQid: string;
  statementId: string | null;
}

export interface ImportedEntity {
  qid: string;
  revision: number | null;
  kind: ImportKind;
  /** True when the kind came from a recognised Wikidata class rather than the caller's hint. */
  kindFromSource: boolean;
  name: string;
  description: string | null;
  aliases: { name: string; language: string }[];
  startDate: HistoricalDate | null;
  endDate: HistoricalDate | null;
  wikipediaTitle: string | null;
  imageFile: string | null;
  claims: ImportedClaim[];
  /** QIDs referenced by this entity (places, relatives, offices) that could be imported next. */
  referencedQids: string[];
  person?: {
    gender: "FEMALE" | "MALE" | "OTHER" | "UNKNOWN";
    birthPlaceQid: string | null;
    deathPlaceQid: string | null;
    occupationQids: string[];
  };
  country?: {
    iso2: string | null;
    iso3: string | null;
    continent: string | null;
    capitalQid: string | null;
  };
  state?: { continent: string | null; capitalQid: string | null };
  location?: { latitude: number; longitude: number } | null;
  countryQid: string | null;
  terms: ImportedTerm[];
  kinship: ImportedKinship[];
  /** Anything that could not be read, reported instead of silently dropped. */
  warnings: string[];
}

const isEntityId = (v: unknown): v is WbEntityId =>
  typeof v === "object" && v !== null && "id" in v && typeof (v as WbEntityId).id === "string";
const isTime = (v: unknown): v is WbTime =>
  typeof v === "object" && v !== null && "time" in v && "precision" in v;
const isCoordinate = (v: unknown): v is WbCoordinate =>
  typeof v === "object" && v !== null && "latitude" in v && "longitude" in v;

/** Statements worth reading: deprecated ones are ignored; preferred ones win when present. */
export function bestStatements(statements: WbStatement[] | undefined): WbStatement[] {
  const usable = (statements ?? []).filter(
    (s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value",
  );
  const preferred = usable.filter((s) => s.rank === "preferred");
  return preferred.length > 0 ? preferred : usable;
}

function snakValue(snak: WbSnak | undefined) {
  return snak?.snaktype === "value" ? snak.datavalue?.value : undefined;
}

export function mapWikidataEntity(entity: WbEntity, hint?: ImportKind): ImportedEntity {
  const warnings: string[] = [];
  const claimsOf = (p: string) => bestStatements(entity.claims[p]);
  const entityIds = (p: string) =>
    claimsOf(p)
      .map((s) => snakValue(s.mainsnak))
      .filter(isEntityId)
      .map((v) => v.id);
  const firstEntity = (p: string) => entityIds(p)[0] ?? null;
  const firstString = (p: string) => {
    const v = snakValue(claimsOf(p)[0]?.mainsnak);
    return typeof v === "string" ? v : null;
  };

  const toDate = (value: unknown, context: string): HistoricalDate | null => {
    if (!isTime(value)) return null;
    try {
      return parseWikidataTime(value);
    } catch (error) {
      if (error instanceof InvalidHistoricalDateError) {
        warnings.push(`${context}: ${error.message}`);
        return null;
      }
      throw error;
    }
  };
  const firstDate = (...props: string[]): HistoricalDate | null => {
    for (const p of props) {
      const date = toDate(snakValue(claimsOf(p)[0]?.mainsnak), p);
      if (date) return date;
    }
    return null;
  };

  // --- kind
  const classes = entityIds("P31");
  const sourceKind = classes.map((c) => KIND_BY_CLASS[c]).find(Boolean);
  const kind: ImportKind = hint ?? sourceKind ?? "TOPIC";
  if (hint && sourceKind && hint !== sourceKind) {
    warnings.push(
      `Kind hint ${hint} differs from Wikidata class (${sourceKind}); the hint was used.`,
    );
  }
  if (!hint && !sourceKind)
    warnings.push(
      `No recognised class in P31 (${classes.join(", ") || "none"}); imported as TOPIC.`,
    );

  // --- names
  const name = entity.labels.en?.value;
  if (!name) warnings.push("No English label.");
  const aliases = [
    ...(entity.aliases?.en ?? []).map((a) => ({ name: a.value, language: "en" })),
    ...Object.entries(entity.labels)
      .filter(([lang, l]) => lang !== "en" && l.value !== name)
      .map(([language, l]) => ({ name: l.value, language })),
  ];

  // --- claims with provenance
  const claims: ImportedClaim[] = [];
  const referenced = new Set<string>();
  for (const [property, propertyLabel] of Object.entries(CLAIM_PROPERTIES)) {
    for (const statement of claimsOf(property)) {
      const raw = snakValue(statement.mainsnak);
      const base = {
        statementId: statement.id ?? null,
        property,
        propertyLabel,
        rank: statement.rank,
      };
      if (isEntityId(raw)) {
        referenced.add(raw.id);
        claims.push({ ...base, value: { type: "entity", id: raw.id }, date: null });
      } else if (isTime(raw)) {
        claims.push({ ...base, value: { type: "time", raw }, date: toDate(raw, property) });
      } else if (isCoordinate(raw)) {
        claims.push({
          ...base,
          value: { type: "coordinate", latitude: raw.latitude, longitude: raw.longitude },
          date: null,
        });
      } else if (typeof raw === "string") {
        claims.push({ ...base, value: { type: "string", text: raw }, date: null });
      }
    }
  }

  // --- offices held
  const terms: ImportedTerm[] = claimsOf("P39").flatMap((statement) => {
    const office = snakValue(statement.mainsnak);
    if (!isEntityId(office)) return [];
    const qualifier = (p: string) => snakValue(statement.qualifiers?.[p]?.[0]);
    const ordinalRaw = qualifier("P1545");
    const ordinal =
      typeof ordinalRaw === "string" && /^\d+$/.test(ordinalRaw) ? Number(ordinalRaw) : null;
    return [
      {
        officeQid: office.id,
        start: toDate(qualifier("P580"), "P39/P580"),
        end: toDate(qualifier("P582"), "P39/P582"),
        ordinal,
        statementId: statement.id ?? null,
      },
    ];
  });

  // --- family
  const kinship: ImportedKinship[] = [];
  const kin = (p: string, build: (other: string) => Omit<ImportedKinship, "statementId">) => {
    for (const statement of claimsOf(p)) {
      const other = snakValue(statement.mainsnak);
      if (isEntityId(other))
        kinship.push({ ...build(other.id), statementId: statement.id ?? null });
    }
  };
  kin("P22", (parent) => ({ type: "PARENT_OF", fromQid: parent, toQid: entity.id }));
  kin("P25", (parent) => ({ type: "PARENT_OF", fromQid: parent, toQid: entity.id }));
  kin("P40", (child) => ({ type: "PARENT_OF", fromQid: entity.id, toQid: child }));
  kin("P26", (spouse) => ({ type: "SPOUSE_OF", fromQid: entity.id, toQid: spouse }));

  const coordinate = snakValue(claimsOf("P625")[0]?.mainsnak);
  const continent = CONTINENT_BY_QID[firstEntity("P30") ?? ""] ?? null;
  const isPerson = kind === "PERSON";

  return {
    qid: entity.id,
    revision: entity.lastrevid ?? null,
    kind,
    kindFromSource: Boolean(sourceKind) && (!hint || hint === sourceKind),
    name: name ?? entity.id,
    description: entity.descriptions.en?.value ?? null,
    aliases,
    startDate: isPerson ? firstDate("P569") : firstDate("P571", "P580", "P585"),
    endDate: isPerson ? firstDate("P570") : firstDate("P576", "P582"),
    wikipediaTitle: entity.sitelinks?.enwiki?.title ?? null,
    imageFile: firstString("P18"),
    claims,
    referencedQids: [...referenced].filter((q) => q !== entity.id),
    person: isPerson
      ? {
          gender: GENDER_BY_QID[firstEntity("P21") ?? ""] ?? "UNKNOWN",
          birthPlaceQid: firstEntity("P19"),
          deathPlaceQid: firstEntity("P20"),
          occupationQids: entityIds("P106"),
        }
      : undefined,
    country:
      kind === "COUNTRY"
        ? {
            iso2: firstString("P297"),
            iso3: firstString("P298"),
            continent,
            capitalQid: firstEntity("P36"),
          }
        : undefined,
    state:
      kind === "HISTORICAL_STATE" || kind === "KINGDOM" || kind === "EMPIRE"
        ? { continent, capitalQid: firstEntity("P36") }
        : undefined,
    location: isCoordinate(coordinate)
      ? { latitude: coordinate.latitude, longitude: coordinate.longitude }
      : null,
    countryQid: firstEntity("P17"),
    terms,
    kinship,
    warnings,
  };
}

/** URL-safe slug from a name; falls back to the QID so it is never empty. */
export function slugify(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback.toLowerCase();
}
