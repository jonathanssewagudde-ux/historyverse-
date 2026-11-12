import { z } from "zod";

import { AUTHOR_MARKER } from "@/lib/content/citations";
import { createHistoricalDate } from "@/lib/history/dates";

/**
 * Schema for article data: both the reviewable files in data/articles/*.json (loaded with
 * `pnpm article:load`) and the Studio editor, which round-trips articles through this format.
 *
 * - strict (files): every factual section must cite a source.
 * - lenient (editor drafts): unfinished drafts can be saved; missing citations become warnings,
 *   and publication still refuses any uncited section.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase slug");
const qid = z.string().regex(/^Q[1-9]\d*$/, "must be a Wikidata id such as Q1036");
const id = z.string().min(1).max(40);

const dateSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().optional(),
    day: z.number().int().optional(),
    precision: z.enum(["millennium", "century", "decade", "year", "month", "day"]),
    approximate: z.boolean().optional(),
    uncertain: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    try {
      createHistoricalDate(d);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
    }
  });

export const SOURCE_TYPES = [
  "BOOK",
  "JOURNAL_ARTICLE",
  "THESIS",
  "ARCHIVE_DOCUMENT",
  "PRIMARY_SOURCE",
  "NEWSPAPER",
  "WEBSITE",
  "ENCYCLOPEDIA",
  "DATASET",
  "ORAL_TRADITION",
  "MUSEUM_RECORD",
  "OTHER",
] as const;

const sourceSchema = z.object({
  /** Set when the source already exists in the database (editor round-trips). */
  id: id.optional(),
  key: slug,
  type: z.enum(SOURCE_TYPES),
  title: z.string().trim().min(3, "needs a title"),
  authors: z.array(z.string().trim().min(1)).default([]),
  publisher: z.string().trim().optional(),
  publishedYear: z.number().int().optional(),
  url: z.url("must be a full URL").optional(),
  accessedAt: z.iso.date().optional(),
  repository: z.string().optional(),
  licenseNote: z.string().optional(),
  reliabilityNote: z.string().optional(),
});

const citeSchema = z.object({ source: slug, locator: z.string().optional() });

/** A reference to an entity: by database id (editor) or Wikidata id (files). */
const entityRef = z
  .object({ entityId: id.optional(), wikidataId: qid.optional() })
  .refine((e) => e.entityId || e.wikidataId, "needs an entity");

export const TEMPLATES = [
  "COUNTRY",
  "PRESIDENT",
  "MONARCH",
  "BIOGRAPHY",
  "KINGDOM",
  "CIVILIZATION",
  "EVENT",
  "INVENTION",
  "GENERAL",
] as const;
export const SECTION_KINDS = [
  "INTRODUCTION",
  "OVERVIEW",
  "CHRONOLOGY",
  "PEOPLE",
  "EVENTS",
  "CULTURE",
  "LEGACY",
  "FURTHER_READING",
  "CUSTOM",
] as const;
export const EDITABLE_MEDIA_KINDS = [
  "UNCLASSIFIED",
  "AUTHENTIC_PHOTO",
  "AUTHENTIC_DOCUMENT",
  "ARTWORK",
  "MAP",
  "MODERN_PHOTO",
  "DIAGRAM",
] as const;

function buildSchema(strict: boolean) {
  return z
    .object({
      slug,
      title: z.string().trim().min(3, "needs a title"),
      subtitle: z.string().trim().optional(),
      summary: strict ? z.string().min(20).max(400) : z.string().max(400).optional(),
      template: z.enum(TEMPLATES),
      primaryEntity: entityRef,
      /** How the draft was produced. AI-assisted drafts are flagged and cannot be published unreviewed. */
      authoring: z.enum(["ai_draft", "human"]),
      sources: z.array(sourceSchema).min(strict ? 1 : 0),
      sections: z
        .array(
          z.object({
            kind: z.enum(SECTION_KINDS),
            heading: z.string().trim().optional(),
            body: strict ? z.string().min(1) : z.string(),
          }),
        )
        .min(strict ? 1 : 0),
      keyDates: z
        .array(
          z.object({
            statement: z.string().trim().min(5, "describe what happened"),
            type: z.enum(["FACT", "INTERPRETATION", "TRADITION", "DISPUTED"]).default("FACT"),
            certainty: z
              .enum(["DOCUMENTED", "TRADITIONAL", "PROBABLE", "UNCERTAIN", "DISPUTED"])
              .default("DOCUMENTED"),
            date: dateSchema,
            cite: z.array(citeSchema).min(1, "cite at least one source"),
          }),
        )
        .default([]),
      /** Category slugs. Leaving it out keeps the article's current categories. */
      categories: z.array(slug).max(20).optional(),
      entities: z
        .array(entityRef.and(z.object({ role: z.enum(["people", "places", "events", "related"]) })))
        .default([]),
      media: z
        .array(
          z
            .object({
              /** Database id (editor) or Commons file title (files). */
              mediaId: id.optional(),
              sourceRef: z.string().startsWith("File:").optional(),
              kind: z.enum(EDITABLE_MEDIA_KINDS),
              altText: z.string().trim().min(5, "describe the image for people who cannot see it"),
              caption: z.string().trim().min(5, "needs a caption"),
              hero: z.boolean().default(false),
            })
            .refine((m) => m.mediaId || m.sourceRef, "needs an image"),
        )
        .default([]),
    })
    .superRefine((file, ctx) => {
      const keys = new Set(file.sources.map((s) => s.key));
      if (keys.size !== file.sources.length)
        ctx.addIssue({ code: "custom", path: ["sources"], message: "duplicate source key" });

      file.sections.forEach((section, i) => {
        for (const match of section.body.matchAll(AUTHOR_MARKER)) {
          if (!keys.has(match[1]!)) {
            ctx.addIssue({
              code: "custom",
              path: ["sections", i, "body"],
              message: `cites unknown source "${match[1]}"`,
            });
          }
        }
        AUTHOR_MARKER.lastIndex = 0;
        // Every factual section must cite something; further reading is a list of sources itself.
        if (strict && section.kind !== "FURTHER_READING" && !AUTHOR_MARKER.test(section.body)) {
          ctx.addIssue({
            code: "custom",
            path: ["sections", i, "body"],
            message: "section has no citations",
          });
        }
        AUTHOR_MARKER.lastIndex = 0;
      });
      file.keyDates.forEach((kd, i) =>
        kd.cite.forEach((c, j) => {
          if (!keys.has(c.source)) {
            ctx.addIssue({
              code: "custom",
              path: ["keyDates", i, "cite", j],
              message: `cites unknown source "${c.source}"`,
            });
          }
        }),
      );
      if (file.media.filter((m) => m.hero).length > 1)
        ctx.addIssue({ code: "custom", path: ["media"], message: "only one hero image" });
    });
}

export const articleFileSchema = buildSchema(true);
export const articleDraftSchema = buildSchema(false);

export type ArticleFile = z.infer<typeof articleFileSchema>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;

/** Sections that would be refused at publication because they cite nothing. */
export function uncitedSections(draft: Pick<ArticleDraft, "sections">): number[] {
  return draft.sections.flatMap((s, i) => {
    AUTHOR_MARKER.lastIndex = 0;
    const cited = AUTHOR_MARKER.test(s.body);
    AUTHOR_MARKER.lastIndex = 0;
    return s.kind !== "FURTHER_READING" && !cited ? [i] : [];
  });
}
