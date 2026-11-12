import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { formatDateRow, formatDateRowRange } from "@/server/history/date-row";
import { importFromWikidata, type ImportDeps } from "@/server/ingestion/wikidata-import";
import {
  JobCancelledError,
  PermanentJobError,
  type JobContext,
  type JobHandler,
} from "@/server/jobs/types";
import type { SourceHttpClient } from "@/server/sources/http";
import { isQid } from "@/server/sources/wikidata/client";
import {
  getWikipediaText,
  searchLibraryOfCongress,
  searchOpenLibrary,
  searchWikidata,
  type WikidataHit,
} from "./sources";

export interface ResearchDeps {
  http: SourceHttpClient;
  wikidata: ImportDeps["wikidata"];
  commons?: ImportDeps["commons"];
  /** Library of Congress search is opt-in (LOC_ENABLED). */
  locEnabled: boolean;
  now?: () => Date;
}

/** "The Complete History of the Buganda Kingdom" → "Buganda Kingdom", for catalogue searches. */
export function searchTermsFor(topic: string): string {
  const cleaned = topic
    .replace(
      /^\s*(the\s+)?(complete\s+|full\s+|brief\s+|short\s+)?(history|story)\s+of\s+(the\s+)?/i,
      "",
    )
    .trim();
  return cleaned || topic.trim();
}

export interface ResearchReport {
  subject: {
    qid: string;
    name: string;
    kind: string;
    dates: string | null;
    summary: string | null;
    matchedBy: "given" | "search";
    alternatives: WikidataHit[];
  };
  periods: { name: string; dates: string | null }[];
  people: { name: string; relation: string; dates: string | null }[];
  events: { name: string; dates: string | null }[];
  places: { name: string; relation: string }[];
  dates: { label: string; statement: string; sortKey: string }[];
  conflicts: { property: string; values: { label: string; statement: string }[] }[];
  counts: { sources: number; byProvider: Record<string, number> };
  warnings: string[];
}

const relationLabel = (type: string) => type.toLowerCase().replace(/_/g, " ");

/**
 * Wikidata properties that hold one date for a subject (birth, death, founding, dissolution,
 * start, end). Two different values for one of these are competing accounts; other dated
 * properties can legitimately have many values.
 */
const SINGLE_DATE_PROPERTIES = new Set([
  "P569",
  "P570",
  "P571",
  "P576",
  "P580",
  "P582",
  "P1619",
  "P3999",
]);

/** Catalogue records of the same title by the same author (other editions) count once. */
export function dedupeBooks<
  T extends { title: string; authors: string[]; firstPublished: number | null },
>(books: T[]): T[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const byTitle = new Map<string, T>();
  for (const book of books) {
    // Catalogue author strings vary ("Mutesa II King of Buganda." / "Mutesa II Kabaka of …"),
    // so the first two words of the first author identify the person.
    const author = norm(book.authors[0] ?? "")
      .split(" ")
      .slice(0, 2)
      .join(" ");
    const key = `${norm(book.title)}|${author}`;
    const seen = byTitle.get(key);
    if (!seen || (book.firstPublished ?? 9999) < (seen.firstPublished ?? 9999))
      byTitle.set(key, book);
  }
  return [...byTitle.values()];
}

/** Assemble the reviewer-facing report from what the import stored, with provenance intact. */
export async function buildResearchReport(
  db: PrismaClient,
  entityId: string,
): Promise<
  Omit<ResearchReport, "subject" | "counts" | "warnings"> & {
    name: string;
    kind: string;
    lifespan: string | null;
    summary: string | null;
  }
> {
  const entity = await db.entity.findUniqueOrThrow({
    where: { id: entityId },
    include: {
      startDate: true,
      endDate: true,
      // Only imported statements: article drafts' own claims are not research evidence.
      claims: {
        where: { origin: "IMPORT" },
        include: { date: true },
        orderBy: { createdAt: "asc" },
      },
      relationsFrom: { include: { to: { include: { startDate: true, endDate: true } } }, take: 60 },
      relationsTo: { include: { from: { include: { startDate: true, endDate: true } } }, take: 60 },
    },
  });
  const related = [
    ...entity.relationsFrom.map((r) => ({
      e: r.to,
      relation: `${entity.name} ${relationLabel(r.type)} ${r.to.name}`,
    })),
    ...entity.relationsTo.map((r) => ({
      e: r.from,
      relation: `${r.from.name} ${relationLabel(r.type)} ${entity.name}`,
    })),
  ];
  const range = (e: (typeof related)[number]["e"]) => formatDateRowRange(e.startDate, e.endDate);

  const dated = entity.claims
    .filter((c) => c.date)
    .sort((a, b) => Number(a.date!.sortKey - b.date!.sortKey));

  // Differing dated values for the same property are presented side by side as accounts to check.
  const byProperty = new Map<string, typeof dated>();
  for (const c of dated) {
    if (!c.property || !SINGLE_DATE_PROPERTIES.has(c.property)) continue;
    byProperty.set(c.property, [...(byProperty.get(c.property) ?? []), c]);
  }
  const conflicts: ResearchReport["conflicts"] = [];
  for (const [property, claims] of byProperty) {
    const distinct = new Set(claims.map((c) => c.date!.sortKey.toString()));
    if (distinct.size > 1) {
      conflicts.push({
        property,
        values: claims.map((c) => ({ label: formatDateRow(c.date)!, statement: c.statement })),
      });
      await db.historicalClaim.updateMany({
        where: { id: { in: claims.map((c) => c.id) } },
        data: { disputeGroup: `${entity.id}:${property}` },
      });
    }
  }

  return {
    name: entity.name,
    kind: entity.kind,
    lifespan: formatDateRowRange(entity.startDate, entity.endDate),
    summary: entity.summary,
    periods: related
      .filter(({ e }) => e.kind === "PERIOD")
      .map(({ e }) => ({ name: e.name, dates: range(e) })),
    people: related
      .filter(({ e }) => e.kind === "PERSON")
      .map(({ e, relation }) => ({ name: e.name, relation, dates: range(e) })),
    events: related
      .filter(({ e }) => e.kind === "EVENT")
      .map(({ e }) => ({ name: e.name, dates: range(e) })),
    places: related
      .filter(({ e }) =>
        ["LOCATION", "COUNTRY", "TERRITORY", "KINGDOM", "HISTORICAL_STATE", "EMPIRE"].includes(
          e.kind,
        ),
      )
      .map(({ e, relation }) => ({ name: e.name, relation })),
    dates: dated.map((c) => ({
      label: formatDateRow(c.date)!,
      statement: c.statement,
      sortKey: c.date!.sortKey.toString(),
    })),
    conflicts,
  };
}

async function upsertSource(
  db: PrismaClient,
  projectId: string,
  data: Omit<Prisma.ResearchSourceUncheckedCreateInput, "projectId">,
) {
  // Re-running research refreshes candidates but never overrides a person's decision.
  await db.researchSource.upsert({
    where: { projectId_url: { projectId, url: data.url } },
    create: { ...data, projectId },
    update: {
      title: data.title,
      authors: data.authors,
      publishedYear: data.publishedYear,
      excerpts: data.excerpts,
      retrievedAt: data.retrievedAt,
      licenseNote: data.licenseNote,
    },
  });
}

/**
 * The research step. Free sources only; no language model is involved, so nothing here is
 * generated. Output: a candidate source set and a report for a person to review.
 */
export function createResearchHandler(deps: ResearchDeps): JobHandler {
  return async (ctx: JobContext) => {
    const { db } = ctx;
    const now = deps.now ?? (() => new Date());
    const stop = async () => {
      if (await ctx.isCancelled()) throw new JobCancelledError();
    };
    if (!ctx.projectId) throw new PermanentJobError("Research jobs belong to a project.");
    const project = await db.contentProject.findUniqueOrThrow({ where: { id: ctx.projectId } });
    const terms = searchTermsFor(project.topic);
    const warnings: string[] = [];

    // 1. Subject on Wikidata.
    await ctx.progress(5, "Finding the subject on Wikidata");
    let qid = project.subjectQid;
    let alternatives: WikidataHit[] = [];
    if (!qid) {
      const hits = await searchWikidata(deps.http, terms);
      if (hits.length === 0) {
        throw new PermanentJobError(
          `Wikidata has no item matching “${terms}”. Give the subject's Wikidata id and run research again.`,
        );
      }
      qid = hits[0]!.qid;
      alternatives = hits.slice(1);
    }
    if (!isQid(qid)) throw new PermanentJobError(`Not a Wikidata id: ${qid}`);
    await stop();

    await ctx.progress(15, `Importing ${qid} from Wikidata`);
    const imported = await importFromWikidata(
      { db, wikidata: deps.wikidata, commons: deps.commons },
      { seeds: [{ qid }], maxEntities: 1, withMedia: Boolean(deps.commons) },
    );
    if (imported.failed.length > 0) throw new Error(imported.failed[0]!.error);
    warnings.push(...imported.warnings.map((w) => `${w.qid}: ${w.message}`));
    const entity = await db.entity.findUniqueOrThrow({
      where: { wikidataId: qid },
      include: { externalIds: { where: { source: "enwiki" } } },
    });
    await db.contentProject.update({
      where: { id: project.id },
      data: { primaryEntityId: entity.id, status: "IN_PROGRESS" },
    });
    await upsertSource(db, project.id, {
      kind: "STRUCTURED_DATA",
      tier: "TERTIARY",
      provider: "wikidata",
      title: `Wikidata: ${entity.name} (${qid})`,
      authors: [],
      url: `https://www.wikidata.org/wiki/${qid}`,
      licenseNote: "CC0 1.0",
      retrievedAt: now(),
    });
    await stop();

    // 2. Encyclopedia text, as orientation and leads (tertiary).
    await ctx.progress(40, "Reading the Wikipedia article");
    const wikiTitle = entity.externalIds[0]?.value ?? entity.name;
    try {
      const article = await getWikipediaText(deps.http, wikiTitle);
      if (article) {
        await upsertSource(db, project.id, {
          kind: "ENCYCLOPEDIA",
          tier: "TERTIARY",
          provider: "wikipedia",
          title: `Wikipedia: ${article.title}`,
          authors: [],
          url: article.url,
          licenseNote: "CC BY-SA 4.0 (research input only; never copied into articles)",
          excerpts: article.sections as unknown as Prisma.InputJsonArray,
          retrievedAt: new Date(article.retrievedAt),
        });
      } else warnings.push(`Wikipedia has no English article titled “${wikiTitle}”.`);
    } catch (error) {
      warnings.push(`Wikipedia could not be read: ${(error as Error).message.slice(0, 160)}`);
    }
    await stop();

    // 3. Books in a library catalogue (scholarship to obtain and cite).
    await ctx.progress(60, "Searching the Open Library catalogue");
    try {
      for (const book of dedupeBooks(await searchOpenLibrary(deps.http, terms))) {
        await upsertSource(db, project.id, {
          kind: "BOOK",
          tier: "UNKNOWN",
          provider: "openlibrary",
          title: book.title,
          authors: book.authors,
          publishedYear: book.firstPublished,
          url: book.url,
          retrievedAt: now(),
          note: book.isbn ? `ISBN ${book.isbn}` : null,
        });
      }
    } catch (error) {
      warnings.push(
        `Open Library could not be searched: ${(error as Error).message.slice(0, 160)}`,
      );
    }
    await stop();

    // 4. Archive items (optional).
    if (deps.locEnabled) {
      await ctx.progress(75, "Searching the Library of Congress");
      try {
        for (const item of await searchLibraryOfCongress(deps.http, terms)) {
          const year = item.date ? Number(/-?\d{3,4}/.exec(item.date)?.[0]) : NaN;
          await upsertSource(db, project.id, {
            kind: "ARCHIVE_ITEM",
            tier: "UNKNOWN",
            provider: "loc",
            title: item.title,
            authors: [],
            publishedYear: Number.isFinite(year) && year !== 0 ? year : null,
            url: item.url,
            retrievedAt: now(),
            note: item.formats.join(", ") || null,
          });
        }
      } catch (error) {
        warnings.push(
          `Library of Congress could not be searched: ${(error as Error).message.slice(0, 160)}`,
        );
      }
    }

    // 5. Report.
    await ctx.progress(90, "Writing the research report");
    const built = await buildResearchReport(db, entity.id);
    const sources = await db.researchSource.groupBy({
      by: ["provider"],
      where: { projectId: project.id },
      _count: true,
    });
    const { name, kind, lifespan, summary, ...rest } = built;
    const report: ResearchReport = {
      subject: {
        qid,
        name,
        kind,
        dates: lifespan,
        summary,
        matchedBy: project.subjectQid ? "given" : "search",
        alternatives,
      },
      ...rest,
      counts: {
        sources: sources.reduce((n, s) => n + s._count, 0),
        byProvider: Object.fromEntries(sources.map((s) => [s.provider, s._count])),
      },
      warnings,
    };
    return { output: { report } as unknown as Record<string, unknown> };
  };
}
