import "server-only";

import type { Prisma, PrismaClient, SourceType } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { SOURCE_TYPES } from "@/server/content/article-file";

type Actor = { id: string; email?: string | null; role: Role };

export class SourceAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceAdminError";
  }
}

export async function listSources(db: PrismaClient, q = "") {
  const term = q.trim().slice(0, 100);
  const where: Prisma.SourceWhereInput = term
    ? {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { authors: { has: term } },
          { url: { contains: term, mode: "insensitive" } },
          { publisher: { contains: term, mode: "insensitive" } },
        ],
      }
    : {};
  const sources = await db.source.findMany({
    where,
    orderBy: { title: "asc" },
    take: 200,
    include: {
      citations: {
        select: {
          claimId: true,
          article: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });
  return sources.map((s) => {
    const articles = new Map<string, { id: string; title: string; status: string }>();
    for (const c of s.citations) if (c.article) articles.set(c.article.id, c.article);
    return {
      id: s.id,
      type: s.type,
      title: s.title,
      authors: s.authors,
      publisher: s.publisher,
      publishedYear: s.publishedYear,
      url: s.url,
      archiveUrl: s.archiveUrl,
      isbn: s.isbn,
      doi: s.doi,
      repository: s.repository,
      reliabilityNote: s.reliabilityNote,
      accessedAt: s.accessedAt?.toISOString().slice(0, 10) ?? null,
      citations: s.citations.length,
      claims: s.citations.filter((c) => c.claimId).length,
      articles: [...articles.values()],
    };
  });
}

export type SourceRow = Awaited<ReturnType<typeof listSources>>[number];

export interface SourceEdit {
  type: string;
  title: string;
  authors: string;
  publisher: string;
  publishedYear: string;
  url: string;
  archiveUrl: string;
  isbn: string;
  doi: string;
  accessedAt: string;
  reliabilityNote: string;
}

function optionalUrl(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
    return url.toString();
  } catch {
    throw new SourceAdminError(`${label} is not a valid web address.`);
  }
}

/**
 * Correct a source's bibliographic details. Returns the slugs of published articles that cite it,
 * so their cached pages can be refreshed.
 */
export async function updateSource(db: PrismaClient, actor: Actor, id: string, edit: SourceEdit) {
  if (!hasPermission(actor.role, "source:manage"))
    throw new SourceAdminError("You cannot edit sources.");
  const before = await db.source.findUnique({ where: { id } });
  if (!before) throw new SourceAdminError("Source not found.");
  if (!(SOURCE_TYPES as readonly string[]).includes(edit.type))
    throw new SourceAdminError("Choose a source type.");
  const title = edit.title.trim();
  if (title.length < 3) throw new SourceAdminError("The source needs a title.");
  const year = edit.publishedYear.trim();
  if (year && !/^-?\d{1,4}$/.test(year))
    throw new SourceAdminError("The year must be a whole number (negative for BCE).");
  if (year === "0") throw new SourceAdminError("There is no year 0; use 1 BCE (-1) or 1 CE (1).");
  const accessed = edit.accessedAt.trim();
  if (accessed && !/^\d{4}-\d{2}-\d{2}$/.test(accessed))
    throw new SourceAdminError("The access date must be YYYY-MM-DD.");
  const doi = edit.doi.trim() || null;
  if (doi && !/^10\.\d{4,9}\/\S+$/.test(doi))
    throw new SourceAdminError("A DOI looks like 10.1234/abcd.");

  const data = {
    type: edit.type as SourceType,
    title,
    authors: edit.authors
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    publisher: edit.publisher.trim() || null,
    publishedYear: year ? Number(year) : null,
    url: optionalUrl(edit.url, "The URL"),
    archiveUrl: optionalUrl(edit.archiveUrl, "The archive URL"),
    isbn: edit.isbn.trim() || null,
    doi,
    // The access date is a modern calendar date (when a person looked), not a historical one.
    accessedAt: accessed ? new Date(`${accessed}T00:00:00Z`) : null,
    reliabilityNote: edit.reliabilityNote.trim() || null,
  };
  if (doi) {
    const clash = await db.source.findFirst({ where: { doi, id: { not: id } } });
    if (clash) throw new SourceAdminError(`Another source already has this DOI: “${clash.title}”.`);
  }
  await db.source.update({ where: { id }, data });
  await recordAudit({
    action: "source.updated",
    actor,
    target: { type: "source", id },
    metadata: { title: [before.title, title], url: [before.url, data.url] },
  });
  const published = await db.article.findMany({
    where: { citations: { some: { sourceId: id } }, status: { in: ["PUBLISHED", "UPDATED"] } },
    select: { slug: true },
  });
  return published.map((a) => a.slug);
}
