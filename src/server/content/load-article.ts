import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { compileCitations } from "@/lib/content/citations";
import { chronologicalSortKey, type HistoricalDate } from "@/lib/history/dates";
import { recordAudit } from "@/server/audit";
import { articleFileSchema, type ArticleFile } from "./article-file";

export class ArticleLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleLoadError";
  }
}

export interface LoadReport {
  articleId: string;
  slug: string;
  version: number;
  sections: number;
  citations: number;
  keyDates: number;
  entities: number;
  media: number;
  warnings: string[];
}

const WORDS_PER_MINUTE = 220;

const dateData = (d: HistoricalDate): Prisma.HistoricalDateCreateInput => ({
  year: d.year,
  month: d.month ?? null,
  day: d.day ?? null,
  precision: d.precision.toUpperCase() as Prisma.HistoricalDateCreateInput["precision"],
  approximate: d.approximate ?? false,
  uncertain: d.uncertain ?? false,
  sortKey: BigInt(chronologicalSortKey(d)),
});

/** Parse and validate an article data file. Throws ArticleLoadError listing every problem. */
export function parseArticleFile(raw: unknown): ArticleFile {
  const result = articleFileSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map(
      (i) => `${i.path.join(".") || "(file)"}: ${i.message}`,
    );
    throw new ArticleLoadError(`Invalid article file:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

/**
 * Write an article data file to the database as a DRAFT.
 *
 * - Refuses to touch an article that has entered review or been published: from that point the
 *   database copy is the editorial record and must be changed through the Studio.
 * - AI-assisted drafts are flagged `containsUnreviewedAi`, which the database forbids publishing.
 * - Every load is kept as an ArticleRevision snapshot.
 */
export async function loadArticle(
  db: PrismaClient,
  raw: unknown,
  actor?: { id: string; email?: string | null; role?: string | null } | null,
): Promise<LoadReport> {
  const file = parseArticleFile(raw);
  const warnings: string[] = [];

  const report = await db.$transaction(
    async (tx) => {
      const primary = await tx.entity.findUnique({
        where: { wikidataId: file.primaryEntity.wikidataId },
      });
      if (!primary) {
        throw new ArticleLoadError(
          `Primary entity ${file.primaryEntity.wikidataId} is not in the database. Import it first with pnpm ingest:wikidata.`,
        );
      }

      const existing = await tx.article.findUnique({ where: { slug: file.slug } });
      if (existing && existing.status !== "DRAFT") {
        throw new ArticleLoadError(
          `Article "${file.slug}" is ${existing.status}; it can no longer be replaced from a file. Edit it in the Studio.`,
        );
      }

      // Sources: matched by URL so reloading never duplicates them.
      const sourceIds = new Map<string, string>();
      for (const s of file.sources) {
        const data = {
          type: s.type,
          title: s.title,
          authors: s.authors,
          publisher: s.publisher ?? null,
          publishedYear: s.publishedYear ?? null,
          url: s.url,
          repository: s.repository ?? null,
          licenseNote: s.licenseNote ?? null,
          reliabilityNote: s.reliabilityNote ?? null,
          accessedAt: new Date(`${s.accessedAt}T00:00:00Z`),
        };
        const found = await tx.source.findFirst({ where: { url: s.url } });
        const row = found
          ? await tx.source.update({ where: { id: found.id }, data })
          : await tx.source.create({ data });
        sourceIds.set(s.key, row.id);
      }

      const wordCount = file.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0);
      const articleData = {
        title: file.title,
        subtitle: file.subtitle ?? null,
        summary: file.summary,
        template: file.template,
        status: "DRAFT" as const,
        primaryEntityId: primary.id,
        containsUnreviewedAi: file.authoring === "ai_draft",
        readingMinutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
        heroMediaId: null,
        publishedAt: null,
      };

      let articleId: string;
      let version: number;
      if (existing) {
        // Replace the draft's contents wholesale; claims and citations cascade with their parents.
        await tx.historicalClaim.deleteMany({ where: { articleId: existing.id } });
        await tx.citation.deleteMany({ where: { articleId: existing.id } });
        await tx.articleSection.deleteMany({ where: { articleId: existing.id } });
        await tx.articleEntity.deleteMany({ where: { articleId: existing.id } });
        await tx.articleMedia.deleteMany({ where: { articleId: existing.id } });
        version = existing.version + 1;
        articleId = (
          await tx.article.update({ where: { id: existing.id }, data: { ...articleData, version } })
        ).id;
      } else {
        version = 1;
        articleId = (
          await tx.article.create({ data: { ...articleData, slug: file.slug, version } })
        ).id;
      }

      // Sections and their citations.
      let citationCount = 0;
      for (const [position, section] of file.sections.entries()) {
        const { body, citations } = compileCitations(section.body);
        const created = await tx.articleSection.create({
          data: { articleId, position, kind: section.kind, heading: section.heading ?? null, body },
        });
        for (const [i, c] of citations.entries()) {
          await tx.citation.create({
            data: {
              sourceId: sourceIds.get(c.sourceKey)!,
              sectionId: created.id,
              articleId,
              locator: c.locator,
              position: i + 1,
            },
          });
        }
        citationCount += citations.length;
      }

      // Key dates: claims with structured dates, each cited. Unverified until an editor publishes.
      for (const kd of file.keyDates) {
        const date = await tx.historicalDate.create({ data: dateData(kd.date) });
        await tx.historicalClaim.create({
          data: {
            statement: kd.statement,
            type: kd.type,
            certainty: kd.certainty,
            origin: file.authoring === "ai_draft" ? "AI_DRAFT" : "HUMAN",
            verification: "UNVERIFIED",
            property: "key-date",
            articleId,
            entityId: primary.id,
            dateId: date.id,
            citations: {
              create: kd.cite.map((c, i) => ({
                sourceId: sourceIds.get(c.source)!,
                locator: c.locator ?? null,
                position: i + 1,
              })),
            },
          },
        });
      }

      // Related entities.
      let entityCount = 0;
      for (const [position, e] of file.entities.entries()) {
        const entity = await tx.entity.findUnique({
          where: { wikidataId: e.wikidataId },
          select: { id: true },
        });
        if (!entity) {
          warnings.push(`Related entity ${e.wikidataId} is not imported; skipped.`);
          continue;
        }
        await tx.articleEntity.create({
          data: { articleId, entityId: entity.id, role: e.role, position },
        });
        entityCount += 1;
      }

      // Media: the file proposes a classification; approval happens at publication.
      let mediaCount = 0;
      for (const [position, m] of file.media.entries()) {
        const asset = await tx.mediaAsset.findUnique({
          where: {
            sourceName_sourceRef: { sourceName: "Wikimedia Commons", sourceRef: m.sourceRef },
          },
        });
        if (!asset) {
          warnings.push(`Media ${m.sourceRef} has not been imported; skipped.`);
          continue;
        }
        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: { kind: m.kind, altText: m.altText },
        });
        await tx.articleMedia.create({
          data: { articleId, mediaId: asset.id, caption: m.caption, position },
        });
        if (m.hero)
          await tx.article.update({ where: { id: articleId }, data: { heroMediaId: asset.id } });
        mediaCount += 1;
      }

      await tx.articleRevision.create({
        data: {
          articleId,
          version,
          status: "DRAFT",
          snapshot: file as unknown as Prisma.InputJsonObject,
          note: existing ? "Draft reloaded from file" : "Draft created from file",
          editedById: actor && !actor.id.startsWith("system:") ? actor.id : null,
        },
      });

      return {
        articleId,
        slug: file.slug,
        version,
        sections: file.sections.length,
        citations: citationCount,
        keyDates: file.keyDates.length,
        entities: entityCount,
        media: mediaCount,
        warnings,
      };
    },
    { timeout: 30_000 },
  );

  await recordAudit({
    action: "article.draft_loaded",
    actor: actor ?? { id: "system:cli", role: "SYSTEM" },
    target: { type: "article", id: report.articleId },
    metadata: { slug: report.slug, version: report.version, warnings: report.warnings.length },
  });
  return report;
}
