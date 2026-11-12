import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { PublishError } from "./publish";

/**
 * Editorial workflow: Draft → Research Review → Editorial Approval → Published.
 *
 *  - A researcher (or above) submits a draft for research review.
 *  - An editor approves the research (→ Editorial Approval) or requests changes (→ Draft).
 *  - An editor publishes from Editorial Approval (see publish.ts), or requests changes.
 * Every step is recorded as an EditorialReview and in the audit log.
 */

export interface Actor {
  id: string;
  email: string;
  role: Role;
}

function require(actor: Actor, permission: Permission, message: string) {
  if (!hasPermission(actor.role, permission)) throw new PublishError("FORBIDDEN", message);
}

async function loadForTransition(
  db: PrismaClient,
  articleId: string,
  allowed: string[],
  action: string,
) {
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article || article.deletedAt) throw new PublishError("NOT_FOUND", "Article not found.");
  if (!allowed.includes(article.status)) {
    throw new PublishError(
      "INVALID_STATE",
      `Cannot ${action} an article that is ${article.status.toLowerCase().replace(/_/g, " ")}.`,
    );
  }
  return article;
}

export async function submitForReview(
  db: PrismaClient,
  actor: Actor,
  articleId: string,
  note?: string,
) {
  require(actor, "review:request", "Only researchers and above can submit articles for review.");
  const article = await loadForTransition(db, articleId, ["DRAFT"], "submit");
  if ((await db.articleSection.count({ where: { articleId } })) === 0) {
    throw new PublishError("INVALID_STATE", "Add at least one section before submitting.");
  }
  await db.$transaction([
    db.article.update({
      where: { id: articleId },
      data: { status: "RESEARCH_REVIEW", lastEditedById: actor.id },
    }),
    db.editorialReview.create({
      data: {
        stage: "RESEARCH_REVIEW",
        decision: "PENDING",
        articleId,
        articleVersion: article.version,
        requestedById: actor.id,
        notes: note?.trim() || null,
      },
    }),
  ]);
  await recordAudit({
    action: "article.submitted_for_review",
    actor,
    target: { type: "article", id: articleId },
    metadata: { version: article.version },
  });
  return { slug: article.slug };
}

export async function approveResearch(
  db: PrismaClient,
  actor: Actor,
  articleId: string,
  note?: string,
) {
  require(actor, "article:review", "Only editors can approve research.");
  const article = await loadForTransition(
    db,
    articleId,
    ["RESEARCH_REVIEW"],
    "approve the research of",
  );
  const now = new Date();
  await db.$transaction([
    db.editorialReview.updateMany({
      where: { articleId, stage: "RESEARCH_REVIEW", decision: "PENDING" },
      data: {
        decision: "APPROVED",
        reviewerId: actor.id,
        decidedAt: now,
        notes: note?.trim() || undefined,
      },
    }),
    db.editorialReview.create({
      data: {
        stage: "EDITORIAL_APPROVAL",
        decision: "PENDING",
        articleId,
        articleVersion: article.version,
        requestedById: actor.id,
      },
    }),
    db.article.update({ where: { id: articleId }, data: { status: "EDITORIAL_APPROVAL" } }),
  ]);
  await recordAudit({
    action: "article.research_approved",
    actor,
    target: { type: "article", id: articleId },
    metadata: { version: article.version },
  });
  return { slug: article.slug };
}

export async function requestChanges(
  db: PrismaClient,
  actor: Actor,
  articleId: string,
  note: string,
) {
  require(actor, "article:review", "Only editors can request changes.");
  if (note.trim().length < 5)
    throw new PublishError("INVALID_STATE", "Explain what needs to change.");
  const article = await loadForTransition(
    db,
    articleId,
    ["RESEARCH_REVIEW", "EDITORIAL_APPROVAL"],
    "request changes to",
  );
  await db.$transaction([
    db.editorialReview.updateMany({
      where: { articleId, decision: "PENDING" },
      data: {
        decision: "CHANGES_REQUESTED",
        reviewerId: actor.id,
        decidedAt: new Date(),
        notes: note.trim(),
      },
    }),
    db.article.update({ where: { id: articleId }, data: { status: "DRAFT" } }),
  ]);
  await recordAudit({
    action: "article.changes_requested",
    actor,
    target: { type: "article", id: articleId },
    metadata: { note: note.trim() },
  });
  return { slug: article.slug };
}
