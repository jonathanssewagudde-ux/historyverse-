import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { articlePath } from "@/lib/content/paths";
import { formatDateRow, formatDateRowRange } from "@/server/history/date-row";
import { mediaPublishBlocker } from "./publish";

/** Plain, serialisable view of an article: safe to cache and to pass to client components. */
export interface MediaView {
  id: string;
  src: string;
  alt: string;
  caption: string | null;
  kind:
    | "AUTHENTIC_PHOTO"
    | "AUTHENTIC_DOCUMENT"
    | "ARTWORK"
    | "MAP"
    | "MODERN_PHOTO"
    | "DIAGRAM"
    | "AI_RECONSTRUCTION"
    | "UNCLASSIFIED";
  width: number;
  height: number;
  title: string;
  credit: {
    source: string;
    sourceUrl: string | null;
    creator: string | null;
    license: string;
    licenseUrl: string | null;
  };
  /** Set only in previews: why this image would not be shown publicly. */
  blocker: string | null;
}

export interface ReferenceView {
  n: number;
  title: string;
  authors: string[];
  publisher: string | null;
  year: number | null;
  url: string | null;
  locator: string | null;
  type: string;
  licenseNote: string | null;
  reliabilityNote: string | null;
  accessedAt: string | null;
}

export interface ArticleView {
  id: string;
  slug: string;
  path: string | null;
  title: string;
  subtitle: string | null;
  summary: string | null;
  template: string;
  status: string;
  version: number;
  containsUnreviewedAi: boolean;
  readingMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string;
  subject: { name: string; kind: string; wikidataId: string | null; dates: string | null };
  hero: MediaView | null;
  sections: {
    id: string;
    kind: string;
    heading: string | null;
    body: string;
    refs: Record<number, number>;
  }[];
  keyDates: {
    id: string;
    label: string;
    statement: string;
    type: string;
    certainty: string;
    verified: boolean;
    refs: number[];
  }[];
  people: { name: string; href: string | null }[];
  places: { name: string; href: string | null }[];
  gallery: MediaView[];
  references: ReferenceView[];
  documentaries: { title: string; youtubeVideoId: string }[];
  related: { title: string; href: string; summary: string | null }[];
}

const PUBLIC_STATUSES = ["PUBLISHED", "UPDATED"] as const;

/**
 * Build the view for one article. `publicOnly` hides unapproved media and links only to other
 * published articles; previews (publicOnly: false) include everything, annotated with blockers.
 */
export async function buildArticleView(
  db: PrismaClient,
  where: { slug: string } | { id: string },
  { publicOnly }: { publicOnly: boolean },
): Promise<ArticleView | null> {
  const article = await db.article.findFirst({
    where: {
      ...where,
      deletedAt: null,
      ...(publicOnly ? { status: { in: [...PUBLIC_STATUSES] } } : {}),
    },
    include: {
      primaryEntity: { include: { startDate: true, endDate: true } },
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
      entities: { orderBy: { position: "asc" }, include: { entity: true } },
      media: { orderBy: { position: "asc" }, include: { media: { include: { license: true } } } },
      documentaries: { where: { status: "PUBLISHED" }, include: { youtubeVideos: true } },
    },
  });
  if (!article) return null;

  // Global reference numbering: first appearance order, identical (source, locator) pairs merged.
  const references: ReferenceView[] = [];
  const refIndex = new Map<string, number>();
  type Cite = (typeof article.sections)[number]["citations"][number];
  const numberFor = (c: Cite) => {
    const key = `${c.sourceId}|${c.locator ?? ""}`;
    let n = refIndex.get(key);
    if (n === undefined) {
      n = references.length + 1;
      refIndex.set(key, n);
      references.push({
        n,
        title: c.source.title,
        authors: c.source.authors,
        publisher: c.source.publisher,
        year: c.source.publishedYear,
        url: c.source.url,
        locator: c.locator,
        type: c.source.type,
        licenseNote: c.source.licenseNote,
        reliabilityNote: c.source.reliabilityNote,
        accessedAt: c.source.accessedAt?.toISOString().slice(0, 10) ?? null,
      });
    }
    return n;
  };

  const sections = article.sections.map((s) => ({
    id: s.id,
    kind: s.kind,
    heading: s.heading,
    body: s.body,
    refs: Object.fromEntries(s.citations.map((c) => [c.position, numberFor(c)])),
  }));

  const keyDates = article.claims
    .filter((c) => c.date)
    .sort((a, b) => Number(a.date!.sortKey - b.date!.sortKey))
    .map((c) => ({
      id: c.id,
      label: formatDateRow(c.date)!,
      statement: c.statement,
      type: c.type,
      certainty: c.certainty,
      verified: c.verification === "VERIFIED",
      refs: c.citations.map(numberFor),
    }));

  const toMedia = (
    m: (typeof article.media)[number]["media"],
    caption: string | null,
  ): MediaView => ({
    id: m.id,
    src: `/media/${m.id}`,
    alt: m.altText ?? m.title,
    caption,
    kind: m.kind,
    width: m.width ?? 1200,
    height: m.height ?? 800,
    title: m.title,
    credit: {
      source: m.sourceName,
      sourceUrl: m.sourceUrl,
      creator: m.creator,
      license: m.license.name,
      licenseUrl: m.license.url,
    },
    blocker: publicOnly
      ? null
      : (mediaPublishBlocker(m) ??
        (m.reviewStatus === "APPROVED" ? null : "awaiting approval at publication")),
  });
  const visible = article.media.filter(
    ({ media }) =>
      !publicOnly || (media.reviewStatus === "APPROVED" && !mediaPublishBlocker(media)),
  );
  const heroEntry = visible.find(({ media }) => media.id === article.heroMediaId);

  // Links to other published articles about the related entities.
  const entityIds = article.entities.map((e) => e.entityId);
  const linked = await db.article.findMany({
    where: {
      primaryEntityId: { in: entityIds },
      status: { in: [...PUBLIC_STATUSES] },
      deletedAt: null,
      id: { not: article.id },
    },
    select: { primaryEntityId: true, slug: true, template: true, title: true, summary: true },
  });
  const hrefFor = (entityId: string) => {
    const a = linked.find((l) => l.primaryEntityId === entityId);
    return a ? articlePath(a.template, a.slug) : null;
  };
  const named = (role: string) =>
    article.entities
      .filter((e) => e.role === role)
      .map((e) => ({ name: e.entity.name, href: hrefFor(e.entityId) }));

  return {
    id: article.id,
    slug: article.slug,
    path: articlePath(article.template, article.slug),
    title: article.title,
    subtitle: article.subtitle,
    summary: article.summary,
    template: article.template,
    status: article.status,
    version: article.version,
    containsUnreviewedAi: article.containsUnreviewedAi,
    readingMinutes: article.readingMinutes,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    updatedAt: article.updatedAt.toISOString(),
    subject: article.primaryEntity
      ? {
          name: article.primaryEntity.name,
          kind: article.primaryEntity.kind,
          wikidataId: article.primaryEntity.wikidataId,
          dates: formatDateRowRange(article.primaryEntity.startDate, article.primaryEntity.endDate),
        }
      : { name: article.title, kind: "TOPIC", wikidataId: null, dates: null },
    hero: heroEntry ? toMedia(heroEntry.media, heroEntry.caption) : null,
    sections,
    keyDates,
    people: named("people"),
    places: named("places"),
    gallery: visible
      .filter(({ media }) => media.id !== heroEntry?.media.id)
      .map(({ media, caption }) => toMedia(media, caption)),
    references,
    documentaries: article.documentaries.flatMap((d) =>
      d.youtubeVideos
        .filter((v) => v.videoId && v.privacy === "PUBLIC")
        .map((v) => ({ title: d.title, youtubeVideoId: v.videoId! })),
    ),
    related: linked.flatMap((l) => {
      const href = articlePath(l.template, l.slug);
      return href ? [{ title: l.title, href, summary: l.summary }] : [];
    }),
  };
}

export interface ArticleSummary {
  slug: string;
  path: string;
  title: string;
  summary: string | null;
  template: string;
  readingMinutes: number | null;
  publishedAt: string;
  hero: { src: string; alt: string } | null;
}

export async function listPublishedArticles(
  db: PrismaClient,
  templates: readonly string[],
): Promise<ArticleSummary[]> {
  const rows = await db.article.findMany({
    where: {
      status: { in: [...PUBLIC_STATUSES] },
      deletedAt: null,
      template: { in: templates as never },
    },
    orderBy: { publishedAt: "desc" },
    include: { heroMedia: { include: { license: true } } },
  });
  return rows.flatMap((a) => {
    const path = articlePath(a.template, a.slug);
    if (!path || !a.publishedAt) return [];
    const hero =
      a.heroMedia && a.heroMedia.reviewStatus === "APPROVED" && !mediaPublishBlocker(a.heroMedia)
        ? { src: `/media/${a.heroMedia.id}`, alt: a.heroMedia.altText ?? a.heroMedia.title }
        : null;
    return [
      {
        slug: a.slug,
        path,
        title: a.title,
        summary: a.summary,
        template: a.template,
        readingMinutes: a.readingMinutes,
        publishedAt: a.publishedAt.toISOString(),
        hero,
      },
    ];
  });
}
