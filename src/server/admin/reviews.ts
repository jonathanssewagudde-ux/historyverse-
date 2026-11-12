import "server-only";

import type { CorrectionStatus, PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";

type Actor = { id: string; email?: string | null; role: Role };

export class ReviewAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewAdminError";
  }
}

const PUBLIC = ["PUBLISHED", "UPDATED"] as const;

/** A signed-in reader reports a possible error in a published article. */
export async function submitCorrection(
  db: PrismaClient,
  actor: Actor,
  input: { articleId: string; message: string; evidenceUrl: string },
) {
  if (!hasPermission(actor.role, "correction:submit"))
    throw new ReviewAdminError("Sign in to report an error.");
  const message = input.message.trim();
  if (message.length < 15)
    throw new ReviewAdminError("Describe what is wrong in a sentence or two.");
  if (message.length > 2000) throw new ReviewAdminError("Keep the report under 2,000 characters.");
  let evidenceUrl: string | null = null;
  if (input.evidenceUrl.trim()) {
    try {
      const url = new URL(input.evidenceUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
      evidenceUrl = url.toString();
    } catch {
      throw new ReviewAdminError("The source link is not a valid web address.");
    }
  }
  const article = await db.article.findFirst({
    where: { id: input.articleId, status: { in: [...PUBLIC] }, deletedAt: null },
    select: { id: true },
  });
  if (!article) throw new ReviewAdminError("Article not found.");
  const open = await db.correctionRequest.count({
    where: { userId: actor.id, status: "OPEN" },
  });
  if (open >= 10)
    throw new ReviewAdminError(
      "You have 10 open reports already. Please wait for editors to review them.",
    );
  const created = await db.correctionRequest.create({
    data: { articleId: article.id, userId: actor.id, message, evidenceUrl },
  });
  await recordAudit({
    action: "correction.submitted",
    actor,
    target: { type: "correction", id: created.id },
    metadata: { articleId: article.id },
  });
  return created.id;
}

export async function resolveCorrection(
  db: PrismaClient,
  actor: Actor,
  id: string,
  status: Exclude<CorrectionStatus, "OPEN">,
  resolution: string,
) {
  if (!hasPermission(actor.role, "correction:resolve"))
    throw new ReviewAdminError("Only editors can resolve reports.");
  const note = resolution.trim();
  if (note.length < 5) throw new ReviewAdminError("Say what was decided (at least a few words).");
  const report = await db.correctionRequest.findUnique({ where: { id } });
  if (!report) throw new ReviewAdminError("Report not found.");
  if (report.status !== "OPEN")
    throw new ReviewAdminError("This report has already been resolved.");
  await db.correctionRequest.update({
    where: { id },
    data: { status, resolution: note, resolvedAt: new Date() },
  });
  await recordAudit({
    action: "correction.resolved",
    actor,
    target: { type: "correction", id },
    metadata: { status, articleId: report.articleId },
  });
}

/** Everything waiting for an editor: article reviews, reader reports, media and claims. */
export async function getReviewQueue(db: PrismaClient) {
  const [reviews, corrections, pendingMedia, unverifiedClaims] = await Promise.all([
    db.editorialReview.findMany({
      where: { decision: "PENDING", articleId: { not: null } },
      orderBy: { createdAt: "asc" },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            status: true,
            version: true,
            containsUnreviewedAi: true,
          },
        },
        requestedBy: { select: { name: true } },
      },
    }),
    db.correctionRequest.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: {
        article: { select: { id: true, title: true } },
        user: { select: { name: true } },
      },
    }),
    db.mediaAsset.count({ where: { reviewStatus: "PENDING", deletedAt: null } }),
    db.historicalClaim.count({ where: { verification: "UNVERIFIED", entityId: { not: null } } }),
  ]);
  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      stage: r.stage,
      notes: r.notes,
      requestedBy: r.requestedBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      article: r.article!,
      stale:
        r.articleVersion !== null && r.article !== null && r.articleVersion !== r.article.version,
    })),
    corrections: corrections.map((c) => ({
      id: c.id,
      message: c.message,
      evidenceUrl: c.evidenceUrl,
      reporter: c.user?.name ?? "a reader",
      createdAt: c.createdAt.toISOString(),
      article: c.article,
    })),
    pendingMedia,
    unverifiedClaims,
  };
}
