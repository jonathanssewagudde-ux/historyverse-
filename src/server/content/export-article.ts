import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { STORED_MARKER } from "@/lib/content/citations";
import { fromDateRow } from "@/server/history/date-row";
import type { ArticleDraft } from "./article-file";

/**
 * Read an article from the database in the editable article format. Stored citation markers
 * `[^n]` become `[@key|locator]` again, so saving the result through the loader reproduces the
 * article exactly (a round trip, verified by tests).
 */
export async function exportArticle(
  db: PrismaClient,
  articleId: string,
): Promise<ArticleDraft | null> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      primaryEntity: { select: { id: true, wikidataId: true } },
      sections: {
        orderBy: { position: "asc" },
        include: { citations: { orderBy: { position: "asc" }, include: { source: true } } },
      },
      claims: {
        where: { property: "key-date" },
        include: {
          date: true,
          citations: { orderBy: { position: "asc" }, include: { source: true } },
        },
      },
      entities: {
        orderBy: { position: "asc" },
        include: { entity: { select: { id: true, wikidataId: true } } },
      },
      media: { orderBy: { position: "asc" }, include: { media: true } },
      categories: { select: { slug: true }, orderBy: { name: "asc" } },
    },
  });
  if (!article || !article.primaryEntity) return null;

  // One key per distinct source, in order of first use.
  type SourceRow = (typeof article.sections)[number]["citations"][number]["source"];
  const sources = new Map<string, { key: string; row: SourceRow }>();
  const keyFor = (row: SourceRow) => {
    let entry = sources.get(row.id);
    if (!entry) {
      entry = { key: `s${sources.size + 1}`, row };
      sources.set(row.id, entry);
    }
    return entry.key;
  };

  const sections = article.sections.map((s) => {
    const byPosition = new Map(s.citations.map((c) => [c.position, c]));
    const body = s.body.replace(STORED_MARKER, (marker, n: string) => {
      const c = byPosition.get(Number(n));
      if (!c) return "";
      return c.locator ? `[@${keyFor(c.source)}|${c.locator}]` : `[@${keyFor(c.source)}]`;
    });
    return { kind: s.kind, heading: s.heading ?? undefined, body };
  });

  const keyDates = article.claims
    .filter((c) => c.date)
    .sort((a, b) => Number(a.date!.sortKey - b.date!.sortKey))
    .map((c) => {
      const d = fromDateRow(c.date!);
      return {
        statement: c.statement,
        type: c.type,
        certainty: c.certainty,
        date: {
          year: d.year,
          month: d.month,
          day: d.day,
          precision: d.precision,
          approximate: d.approximate,
          uncertain: d.uncertain,
        },
        cite: c.citations.map((ct) => ({
          source: keyFor(ct.source),
          locator: ct.locator ?? undefined,
        })),
      };
    });

  // Sources listed in the latest draft but not cited yet live only in its revision snapshot.
  const latest = await db.articleRevision.findFirst({
    where: { articleId },
    orderBy: { version: "desc" },
    select: { snapshot: true },
  });
  const listed = ((latest?.snapshot as { sources?: { id?: string }[] } | null)?.sources ?? [])
    .map((s) => s.id)
    .filter((sid): sid is string => typeof sid === "string" && !sources.has(sid));
  if (listed.length > 0) {
    const rows = await db.source.findMany({ where: { id: { in: listed } } });
    rows.sort((a, b) => listed.indexOf(a.id) - listed.indexOf(b.id)).forEach(keyFor);
  }

  return {
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle ?? undefined,
    summary: article.summary ?? undefined,
    template: article.template,
    primaryEntity: {
      entityId: article.primaryEntity.id,
      wikidataId: article.primaryEntity.wikidataId ?? undefined,
    },
    authoring: article.containsUnreviewedAi ? "ai_draft" : "human",
    sources: [...sources.values()].map(({ key, row }) => ({
      id: row.id,
      key,
      type: row.type,
      title: row.title,
      authors: row.authors,
      publisher: row.publisher ?? undefined,
      publishedYear: row.publishedYear ?? undefined,
      url: row.url ?? undefined,
      accessedAt: row.accessedAt?.toISOString().slice(0, 10),
      repository: row.repository ?? undefined,
      licenseNote: row.licenseNote ?? undefined,
      reliabilityNote: row.reliabilityNote ?? undefined,
    })),
    sections,
    keyDates,
    categories: article.categories.map((c) => c.slug),
    entities: article.entities.map((e) => ({
      entityId: e.entity.id,
      wikidataId: e.entity.wikidataId ?? undefined,
      role: e.role as "people" | "places" | "events" | "related",
    })),
    media: article.media.map((m) => ({
      mediaId: m.media.id,
      kind: m.media.kind === "AI_RECONSTRUCTION" ? "UNCLASSIFIED" : m.media.kind,
      altText: m.media.altText ?? "",
      caption: m.caption ?? "",
      hero: article.heroMediaId === m.media.id,
    })),
  };
}
