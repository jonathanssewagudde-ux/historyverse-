import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { eraBounds, parseQuery, SEARCH_TYPES, type SearchType } from "@/lib/search/query";
import {
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  splitHighlights,
  type HighlightPart,
} from "@/lib/search/text";

export interface SearchInput {
  q?: string;
  type?: SearchType;
  era?: string;
  continent?: string;
  page?: number;
}

export interface SearchHit {
  path: string;
  title: string;
  summary: string | null;
  template: string;
  snippet: HighlightPart[];
  /** Key dates that match the year asked about. */
  matchedDates: { label: string; statement: string }[];
  hero: string | null;
}

export interface SearchOutput {
  /** How results were found: full-text words, a year, typo-tolerant fallback, or plain browsing. */
  mode: "text" | "year" | "fuzzy" | "browse";
  query: string;
  yearLabel: string | null;
  total: number;
  page: number;
  pageSize: number;
  hits: SearchHit[];
  /** Closest known title or name when nothing matched exactly. */
  didYouMean: string | null;
  facets: { type: Record<string, number>; continent: Record<string, number> };
  /** Names from the results, for "related searches". */
  related: string[];
  /** Total published articles: lets the page say honestly how small the index still is. */
  indexSize: number;
}

const PAGE_SIZE = 10;

type Row = {
  path: string;
  title: string;
  summary: string | null;
  template: string;
  snippet: string | null;
  keyDates: { year: number; label: string; statement: string }[];
  names: string[];
  heroMediaId: string | null;
  total: bigint;
};

function filters(
  input: SearchInput,
  skip: { type?: boolean; continent?: boolean } = {},
): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (input.type && !skip.type) {
    where.push(
      Prisma.sql`d."template"::text = ANY(${[...SEARCH_TYPES[input.type].templates]}::text[])`,
    );
  }
  if (input.continent && !skip.continent)
    where.push(Prisma.sql`${input.continent} = ANY(d."continents")`);
  const era = input.era ? eraBounds(input.era) : null;
  if (era) {
    // Overlap between the subject's lifespan and the era; subjects without dates are excluded.
    where.push(Prisma.sql`d."startYear" IS NOT NULL`);
    if (era.to !== null) where.push(Prisma.sql`d."startYear" <= ${era.to}`);
    if (era.from !== null) where.push(Prisma.sql`coalesce(d."endYear", 1000000) >= ${era.from}`);
  }
  return where;
}

const and = (parts: Prisma.Sql[]) =>
  parts.length ? Prisma.join(parts, " AND ") : Prisma.sql`TRUE`;

/**
 * Search published articles. Strategy:
 *  1. Full-text match on words (weighted: names and title > summary > body), with snippets.
 *  2. If the query names a year, articles whose key dates fall in that year, or whose subject
 *     existed then, with the matching dates shown.
 *  3. If words found nothing, a trigram (typo-tolerant) match on titles and names, plus a
 *     "did you mean" suggestion.
 * Only the search index is queried, and it contains published articles only.
 */
export async function searchArticles(db: PrismaClient, input: SearchInput): Promise<SearchOutput> {
  const parsed = parseQuery(input.q ?? "");
  const page = Math.max(1, Math.min(50, input.page ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const hasWords = parsed.text.replace(/[^\p{L}\p{N}]+/gu, "").length > 0;
  const year = parsed.year;

  const textMatch = hasWords
    ? Prisma.sql`d."searchVector" @@ hv_search_query(${parsed.text})`
    : Prisma.sql`TRUE`;
  const yearMatch =
    year !== null
      ? Prisma.sql`(${year} = ANY(d."dateYears") OR (d."startYear" <= ${year} AND coalesce(d."endYear", 1000000) >= ${year}))`
      : Prisma.sql`TRUE`;

  const run = async (match: Prisma.Sql, order: Prisma.Sql, snippet: Prisma.Sql) =>
    db.$queryRaw<Row[]>`
      SELECT d."path", d."title", d."summary", d."template"::text AS "template", ${snippet} AS "snippet",
             d."keyDates", d."names", d."heroMediaId", count(*) OVER () AS "total"
        FROM "search_documents" d
       WHERE ${match} AND ${and(filters(input))}
       ORDER BY ${order}
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

  const headline = hasWords
    ? Prisma.sql`ts_headline('english', d."body", hv_search_query(${parsed.text}),
        ${`StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxFragments=2, MinWords=12, MaxWords=30, FragmentDelimiter=" … "`})`
    : Prisma.sql`left(coalesce(d."summary", d."body"), 240)`;

  let mode: SearchOutput["mode"] =
    !hasWords && year === null ? "browse" : hasWords ? "text" : "year";
  let rows: Row[];
  if (mode === "browse") {
    rows = await run(Prisma.sql`TRUE`, Prisma.sql`d."publishedAt" DESC`, headline);
  } else {
    const order: Prisma.Sql[] = [];
    if (year !== null) order.push(Prisma.sql`(${year} = ANY(d."dateYears")) DESC`);
    if (hasWords)
      order.push(
        Prisma.sql`ts_rank_cd(d."searchVector", hv_search_query(${parsed.text}), 32) DESC`,
      );
    order.push(Prisma.sql`d."publishedAt" DESC`);
    rows = await run(Prisma.sql`${textMatch} AND ${yearMatch}`, Prisma.join(order, ", "), headline);
  }

  // Typo tolerance: only when the words matched nothing.
  let didYouMean: string | null = null;
  if (hasWords && rows.length === 0) {
    const needle = parsed.text.toLowerCase();
    const fuzzy = await db.$queryRaw<Row[]>`
      SELECT d."path", d."title", d."summary", d."template"::text AS "template",
             left(coalesce(d."summary", d."body"), 240) AS "snippet",
             d."keyDates", d."names", d."heroMediaId", count(*) OVER () AS "total"
        FROM "search_documents" d
       WHERE word_similarity(lower(hv_unaccent(${needle})), d."matchText") > 0.4 AND ${and(filters(input))}
       ORDER BY word_similarity(lower(hv_unaccent(${needle})), d."matchText") DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
    if (fuzzy.length > 0) {
      mode = "fuzzy";
      rows = fuzzy;
    }
    const [best] = await db.$queryRaw<{ name: string }[]>`
      SELECT n AS "name"
        FROM "search_documents" d, unnest(array_append(d."names", d."title")) AS n
       WHERE similarity(lower(hv_unaccent(n)), lower(hv_unaccent(${needle}))) > 0.3
       ORDER BY similarity(lower(hv_unaccent(n)), lower(hv_unaccent(${needle}))) DESC
       LIMIT 1`;
    didYouMean = best && best.name.toLowerCase() !== needle ? best.name : null;
  }

  // Facet counts for the same match, ignoring the facet's own filter.
  const facetMatch =
    mode === "fuzzy"
      ? Prisma.sql`word_similarity(lower(hv_unaccent(${parsed.text.toLowerCase()})), d."matchText") > 0.4`
      : mode === "browse"
        ? Prisma.sql`TRUE`
        : Prisma.sql`${textMatch} AND ${yearMatch}`;
  const [typeCounts, continentCounts, [{ count: indexSize }]] = await Promise.all([
    db.$queryRaw<{ key: string; n: bigint }[]>`
      SELECT d."template"::text AS "key", count(*) AS "n" FROM "search_documents" d
       WHERE ${facetMatch} AND ${and(filters(input, { type: true }))} GROUP BY 1`,
    db.$queryRaw<{ key: string; n: bigint }[]>`
      SELECT c AS "key", count(*) AS "n" FROM "search_documents" d, unnest(d."continents") AS c
       WHERE ${facetMatch} AND ${and(filters(input, { continent: true }))} GROUP BY 1`,
    db.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS "count" FROM "search_documents"`,
  ]);

  const typeFacet: Record<string, number> = {};
  for (const [type, { templates }] of Object.entries(SEARCH_TYPES)) {
    typeFacet[type] = typeCounts
      .filter((r) => (templates as readonly string[]).includes(r.key))
      .reduce((n, r) => n + Number(r.n), 0);
  }

  const hits: SearchHit[] = rows.map((r) => ({
    path: r.path,
    title: r.title,
    summary: r.summary,
    template: r.template,
    snippet: splitHighlights(r.snippet ?? ""),
    matchedDates:
      year !== null
        ? r.keyDates
            .filter((k) => k.year === year)
            .map(({ label, statement }) => ({ label, statement }))
        : [],
    hero: r.heroMediaId ? `/media/${r.heroMediaId}` : null,
  }));
  const queryWords = new Set(parsed.text.toLowerCase().split(/\s+/));
  const related = [...new Set(rows.flatMap((r) => r.names))]
    .filter(
      (n) => !queryWords.has(n.toLowerCase()) && n.toLowerCase() !== parsed.text.toLowerCase(),
    )
    .slice(0, 8);

  return {
    mode,
    query: (input.q ?? "").trim(),
    yearLabel: parsed.yearLabel,
    total: rows[0] ? Number(rows[0].total) : 0,
    page,
    pageSize: PAGE_SIZE,
    hits,
    didYouMean,
    facets: {
      type: typeFacet,
      continent: Object.fromEntries(continentCounts.map((r) => [r.key, Number(r.n)])),
    },
    related,
    indexSize: Number(indexSize),
  };
}

export interface Suggestion {
  title: string;
  path: string;
  template: string;
  /** The alias or name that matched, when it is not the title itself. */
  via: string | null;
}

/** Autocomplete: prefix match on words, with a typo-tolerant fallback. */
export async function suggest(db: PrismaClient, raw: string): Promise<Suggestion[]> {
  const q = raw.trim().slice(0, 80);
  const words = q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0 || q.length < 2) return [];
  // Each word must be a prefix of some indexed word: "bug kin" → bug:* & kin:*.
  const prefix = words.map((w) => `${w}:*`).join(" & ");

  const rows = await db.$queryRaw<
    { title: string; path: string; template: string; names: string[]; score: number }[]
  >`
    SELECT d."title", d."path", d."template"::text AS "template", d."names",
           ts_rank_cd(d."searchVector", to_tsquery('simple', ${prefix})) + word_similarity(${q.toLowerCase()}, d."matchText") AS "score"
      FROM "search_documents" d
     WHERE d."searchVector" @@ to_tsquery('simple', ${prefix})
        OR word_similarity(lower(hv_unaccent(${q})), d."matchText") > 0.5
     ORDER BY "score" DESC
     LIMIT 6`;

  return rows.map((r) => {
    const lowered = words.join(" ");
    const via = r.title.toLowerCase().includes(lowered)
      ? null
      : (r.names.find((n) => n.toLowerCase().includes(words[0]!)) ?? null);
    return { title: r.title, path: r.path, template: r.template, via };
  });
}
