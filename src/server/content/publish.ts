import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { indexArticle } from "@/server/search/indexer";

export class PublishError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" | "NO_CITATIONS",
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface Editor {
  id: string;
  email: string;
  role: Role;
}

export interface WithheldMedia {
  title: string;
  reason: string;
}

/** Why an attached image may not be shown publicly, or null when it may. */
export function mediaPublishBlocker(asset: {
  kind: string;
  storageKey: string | null;
  license: { publishable: boolean; name: string };
}): string | null {
  if (asset.kind === "UNCLASSIFIED") return "not yet classified as photograph, artwork, map, etc.";
  if (!asset.license.publishable)
    return `licence "${asset.license.name}" does not allow publication`;
  if (!asset.storageKey) return "file has not been downloaded to storage";
  return null;
}

/**
 * Publish an article after editorial review. The publishing editor:
 *  - attests the text (clearing the unreviewed-AI flag) and verifies the article's dated claims;
 *  - approves the attached images that are classified, publishable and stored; others stay hidden.
 * Recorded as an EditorialReview, an ArticleRevision snapshot and an audit entry.
 */
export async function publishArticle(db: PrismaClient, editor: Editor, articleId: string) {
  if (!hasPermission(editor.role, "article:publish")) {
    throw new PublishError("FORBIDDEN", "Only editors and above can publish articles.");
  }

  const result = await db.$transaction(async (tx) => {
    const article = await tx.article.findUnique({
      where: { id: articleId },
      include: {
        sections: { orderBy: { position: "asc" } },
        media: { include: { media: { include: { license: true } } } },
      },
    });
    if (!article || article.deletedAt) throw new PublishError("NOT_FOUND", "Article not found.");
    if (
      article.status === "PUBLISHED" ||
      article.status === "UPDATED" ||
      article.status === "ARCHIVED"
    ) {
      throw new PublishError(
        "INVALID_STATE",
        `Article is already ${article.status.toLowerCase()}.`,
      );
    }
    if ((await tx.citation.count({ where: { articleId } })) === 0) {
      throw new PublishError(
        "NO_CITATIONS",
        "An article must cite at least one source before publication.",
      );
    }

    const withheld: WithheldMedia[] = [];
    const approved: string[] = [];
    for (const { media } of article.media) {
      const blocker = mediaPublishBlocker(media);
      if (blocker) withheld.push({ title: media.title, reason: blocker });
      else approved.push(media.id);
    }
    if (approved.length > 0) {
      await tx.mediaAsset.updateMany({
        where: { id: { in: approved } },
        data: { reviewStatus: "APPROVED" },
      });
    }

    const now = new Date();
    await tx.historicalClaim.updateMany({
      where: { articleId, verification: "UNVERIFIED" },
      data: { verification: "VERIFIED", verifiedById: editor.id, verifiedAt: now },
    });

    const version = article.version + 1;
    await tx.article.update({
      where: { id: articleId },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        containsUnreviewedAi: false,
        lastEditedById: editor.id,
        version,
      },
    });
    await tx.editorialReview.create({
      data: {
        stage: "EDITORIAL_APPROVAL",
        decision: "APPROVED",
        articleId,
        articleVersion: article.version,
        reviewerId: editor.id,
        decidedAt: now,
        notes:
          withheld.length > 0 ? `${withheld.length} image(s) withheld from publication.` : null,
      },
    });
    await tx.articleRevision.create({
      data: {
        articleId,
        version,
        status: "PUBLISHED",
        editedById: editor.id,
        note: "Published after editorial approval",
        snapshot: {
          title: article.title,
          summary: article.summary,
          sections: article.sections.map((s) => ({
            kind: s.kind,
            heading: s.heading,
            body: s.body,
          })),
        } as Prisma.InputJsonObject,
      },
    });
    // Same transaction: an article is searchable exactly when it is published.
    await indexArticle(tx, articleId);
    return {
      slug: article.slug,
      template: article.template,
      version,
      approvedMedia: approved.length,
      withheld,
    };
  });

  await recordAudit({
    action: "article.published",
    actor: editor,
    target: { type: "article", id: articleId },
    metadata: {
      slug: result.slug,
      version: result.version,
      approvedMedia: result.approvedMedia,
      withheld: result.withheld.length,
    },
  });
  return result;
}

/** Take a published article back to draft (e.g. a serious error was reported). */
export async function unpublishArticle(
  db: PrismaClient,
  editor: Editor,
  articleId: string,
  reason: string,
) {
  if (!hasPermission(editor.role, "article:publish")) {
    throw new PublishError("FORBIDDEN", "Only editors and above can unpublish articles.");
  }
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) throw new PublishError("NOT_FOUND", "Article not found.");
  if (article.status !== "PUBLISHED" && article.status !== "UPDATED") {
    throw new PublishError("INVALID_STATE", "Only published articles can be unpublished.");
  }
  await db.$transaction(async (tx) => {
    await tx.article.update({
      where: { id: articleId },
      data: { status: "DRAFT", publishedAt: null, lastEditedById: editor.id },
    });
    await indexArticle(tx, articleId);
  });
  await recordAudit({
    action: "article.unpublished",
    actor: editor,
    target: { type: "article", id: articleId },
    metadata: { slug: article.slug, reason },
  });
  return { slug: article.slug, template: article.template };
}
