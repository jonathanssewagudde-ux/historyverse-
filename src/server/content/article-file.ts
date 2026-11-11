import { z } from "zod";

import { AUTHOR_MARKER } from "@/lib/content/citations";
import { createHistoricalDate } from "@/lib/history/dates";

/**
 * Schema for article data files (data/articles/*.json). Files are the reviewable, version-
 * controlled form of an article draft; `pnpm article:load` writes them to the database.
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase slug");
const qid = z.string().regex(/^Q[1-9]\d*$/);

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

const sourceSchema = z.object({
  key: slug,
  type: z.enum([
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
  ]),
  title: z.string().min(3),
  authors: z.array(z.string()).default([]),
  publisher: z.string().optional(),
  publishedYear: z.number().int().optional(),
  url: z.url(),
  accessedAt: z.iso.date(),
  repository: z.string().optional(),
  licenseNote: z.string().optional(),
  reliabilityNote: z.string().optional(),
});

const citeSchema = z.object({ source: slug, locator: z.string().optional() });

export const articleFileSchema = z
  .object({
    slug,
    title: z.string().min(3),
    subtitle: z.string().optional(),
    summary: z.string().min(20).max(400),
    template: z.enum([
      "COUNTRY",
      "PRESIDENT",
      "MONARCH",
      "BIOGRAPHY",
      "KINGDOM",
      "CIVILIZATION",
      "EVENT",
      "INVENTION",
      "GENERAL",
    ]),
    primaryEntity: z.object({ wikidataId: qid }),
    /** How the draft was produced. AI-assisted drafts are flagged and cannot be published unreviewed. */
    authoring: z.enum(["ai_draft", "human"]),
    sources: z.array(sourceSchema).min(1),
    sections: z
      .array(
        z.object({
          kind: z.enum([
            "INTRODUCTION",
            "OVERVIEW",
            "CHRONOLOGY",
            "PEOPLE",
            "EVENTS",
            "CULTURE",
            "LEGACY",
            "FURTHER_READING",
            "CUSTOM",
          ]),
          heading: z.string().optional(),
          body: z.string().min(1),
        }),
      )
      .min(1),
    keyDates: z
      .array(
        z.object({
          statement: z.string().min(5),
          type: z.enum(["FACT", "INTERPRETATION", "TRADITION", "DISPUTED"]).default("FACT"),
          certainty: z
            .enum(["DOCUMENTED", "TRADITIONAL", "PROBABLE", "UNCERTAIN", "DISPUTED"])
            .default("DOCUMENTED"),
          date: dateSchema,
          cite: z.array(citeSchema).min(1),
        }),
      )
      .default([]),
    entities: z
      .array(z.object({ wikidataId: qid, role: z.enum(["people", "places", "events", "related"]) }))
      .default([]),
    media: z
      .array(
        z.object({
          /** Commons file title, matching an imported MediaAsset (sourceName "Wikimedia Commons"). */
          sourceRef: z.string().startsWith("File:"),
          kind: z.enum([
            "AUTHENTIC_PHOTO",
            "AUTHENTIC_DOCUMENT",
            "ARTWORK",
            "MAP",
            "MODERN_PHOTO",
            "DIAGRAM",
          ]),
          altText: z.string().min(5),
          caption: z.string().min(5),
          hero: z.boolean().default(false),
        }),
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
            message: `unknown source "${match[1]}"`,
          });
        }
      }
      // Every factual section must cite something; further reading is a list of sources itself.
      if (section.kind !== "FURTHER_READING" && !AUTHOR_MARKER.test(section.body)) {
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
            message: `unknown source "${c.source}"`,
          });
        }
      }),
    );
    if (file.media.filter((m) => m.hero).length > 1)
      ctx.addIssue({ code: "custom", path: ["media"], message: "only one hero image" });
  });

export type ArticleFile = z.infer<typeof articleFileSchema>;
