import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { hasPermission, isRole, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { createLogger } from "@/server/logger";
import { PublishError, publishArticle } from "./publish";

const log = createLogger("schedule");

type Editor = { id: string; email?: string | null; role: Role };

export class ScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleError";
  }
}

/**
 * An editor schedules an article that has passed research review. Scheduling is the editor's
 * approval, given in advance: the same source-check confirmation as publishing now.
 * Times are real-world instants (UTC), not historical dates.
 */
export async function scheduleArticle(
  db: PrismaClient,
  editor: Editor,
  articleId: string,
  when: Date,
  now = new Date(),
) {
  if (!hasPermission(editor.role, "article:publish"))
    throw new ScheduleError("Only editors can schedule publication.");
  if (Number.isNaN(when.getTime())) throw new ScheduleError("Choose a valid date and time.");
  if (when.getTime() < now.getTime() + 5 * 60_000)
    throw new ScheduleError("Schedule at least 5 minutes ahead, or publish now.");
  if (when.getTime() > now.getTime() + 366 * 86_400_000)
    throw new ScheduleError("Schedule within the next year.");
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article || article.deletedAt) throw new ScheduleError("Article not found.");
  if (article.status !== "EDITORIAL_APPROVAL") {
    throw new ScheduleError("Only articles awaiting editorial approval can be scheduled.");
  }
  const existing = await db.publicationSchedule.findFirst({
    where: { articleId, status: { in: ["PENDING_APPROVAL", "APPROVED"] } },
  });
  if (existing) throw new ScheduleError("This article is already scheduled. Cancel that first.");
  const schedule = await db.publicationSchedule.create({
    data: {
      articleId,
      scheduledFor: when,
      status: "APPROVED",
      createdById: editor.id,
      approvedById: editor.id,
      approvedAt: now,
    },
  });
  await recordAudit({
    action: "article.publication_scheduled",
    actor: editor,
    target: { type: "article", id: articleId },
    metadata: {
      scheduleId: schedule.id,
      scheduledFor: when.toISOString(),
      version: article.version,
    },
  });
  return schedule.id;
}

export async function cancelSchedule(db: PrismaClient, editor: Editor, scheduleId: string) {
  if (!hasPermission(editor.role, "article:publish"))
    throw new ScheduleError("Only editors can cancel schedules.");
  const schedule = await db.publicationSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || !["PENDING_APPROVAL", "APPROVED"].includes(schedule.status)) {
    throw new ScheduleError("Nothing to cancel.");
  }
  await db.publicationSchedule.update({ where: { id: scheduleId }, data: { status: "CANCELLED" } });
  await recordAudit({
    action: "article.publication_cancelled",
    actor: editor,
    target: { type: "article", id: schedule.articleId ?? scheduleId },
    metadata: { scheduleId },
  });
}

export interface DueRun {
  published: { scheduleId: string; slug: string }[];
  failed: { scheduleId: string; reason: string }[];
}

/**
 * Publish every approved article whose time has come. Each publication re-runs all the checks
 * of publishing by hand, as the approving editor, who must still hold the permission.
 * A schedule that cannot be honoured is marked FAILED with the reason, never retried silently.
 */
export async function runDuePublications(db: PrismaClient, now = new Date()): Promise<DueRun> {
  const due = await db.publicationSchedule.findMany({
    where: { status: "APPROVED", scheduledFor: { lte: now }, articleId: { not: null } },
    include: { approvedBy: { select: { id: true, email: true, role: true } } },
    orderBy: { scheduledFor: "asc" },
    take: 50,
  });
  const run: DueRun = { published: [], failed: [] };
  for (const schedule of due) {
    // Claim the row first so two overlapping runs cannot both publish it.
    const claimed = await db.publicationSchedule.updateMany({
      where: { id: schedule.id, status: "APPROVED" },
      data: { status: "FAILED" },
    });
    if (claimed.count === 0) continue;
    const approver = schedule.approvedBy;
    try {
      if (!approver || !isRole(approver.role) || !hasPermission(approver.role, "article:publish")) {
        throw new ScheduleError("The approving editor no longer has permission to publish.");
      }
      const result = await publishArticle(
        db,
        { id: approver.id, email: approver.email, role: approver.role },
        schedule.articleId!,
      );
      await db.publicationSchedule.update({
        where: { id: schedule.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      run.published.push({ scheduleId: schedule.id, slug: result.slug });
    } catch (error) {
      const reason =
        error instanceof PublishError || error instanceof ScheduleError
          ? error.message
          : "Unexpected error.";
      log.warn("scheduled publication failed", { scheduleId: schedule.id, reason });
      await recordAudit({
        action: "article.scheduled_publication_failed",
        target: { type: "article", id: schedule.articleId! },
        metadata: { scheduleId: schedule.id, reason },
      });
      run.failed.push({ scheduleId: schedule.id, reason });
    }
  }
  return run;
}

export async function listSchedules(db: PrismaClient, now = new Date()) {
  const [upcoming, recent, ready] = await Promise.all([
    db.publicationSchedule.findMany({
      where: { status: { in: ["PENDING_APPROVAL", "APPROVED"] }, articleId: { not: null } },
      orderBy: { scheduledFor: "asc" },
      include: {
        article: { select: { id: true, title: true } },
        approvedBy: { select: { name: true } },
      },
    }),
    db.publicationSchedule.findMany({
      where: { status: { in: ["PUBLISHED", "FAILED", "CANCELLED"] }, articleId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { article: { select: { id: true, title: true } } },
    }),
    db.article.findMany({
      where: {
        status: "EDITORIAL_APPROVAL",
        deletedAt: null,
        schedules: { none: { status: { in: ["PENDING_APPROVAL", "APPROVED"] } } },
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return {
    upcoming: upcoming.map((s) => ({
      id: s.id,
      when: s.scheduledFor.toISOString(),
      overdue: s.scheduledFor <= now,
      article: s.article!,
      approvedBy: s.approvedBy?.name ?? null,
    })),
    recent: recent.map((s) => ({
      id: s.id,
      when: s.scheduledFor.toISOString(),
      status: s.status,
      article: s.article!,
    })),
    ready,
  };
}
