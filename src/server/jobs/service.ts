import "server-only";

import { Prisma, type JobType, type PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { getServerEnv } from "@/server/env";
import { dequeueJob, enqueueJob } from "./queue";

type Actor = { id: string; email?: string | null; role: Role };

export class JobServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobServiceError";
  }
}

const ACTIVE = ["QUEUED", "AWAITING_APPROVAL", "RUNNING"] as const;

/** Operator tools act as "system:<name>"; only real users are stored as foreign keys. */
export const userIdOf = (actor: { id: string } | null) =>
  actor && !actor.id.startsWith("system:") ? actor.id : null;

/**
 * Create a job row and hand it to the queue. A job with a cost estimate above zero waits for
 * a person's approval instead (AWAITING_APPROVAL) and is never queued automatically.
 * `queued` is false when Redis is not configured: the row stays QUEUED until a worker can run it.
 */
export async function createJob(
  db: PrismaClient,
  actor: Actor | null,
  input: {
    /** Paid jobs need a project: budgets are per project. */
    projectId: string | null;
    type: JobType;
    input?: Record<string, unknown>;
    costEstimateUsd?: number;
    maxAttempts?: number;
    /** Identifies "the same step" for jobs without a project, e.g. { scriptId }. */
    subject?: { key: string; value: string };
  },
) {
  const existing = await db.productionJob.findFirst({
    where: {
      projectId: input.projectId,
      type: input.type,
      status: { in: [...ACTIVE] },
      ...(input.subject
        ? { input: { path: [input.subject.key], equals: input.subject.value } }
        : {}),
    },
  });
  if (existing) throw new JobServiceError("This step is already queued or running.");
  const needsApproval = (input.costEstimateUsd ?? 0) > 0;
  if (needsApproval && !input.projectId) {
    throw new JobServiceError("Paid steps need a project with a budget.");
  }
  const job = await db.productionJob.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      status: needsApproval ? "AWAITING_APPROVAL" : "QUEUED",
      input: (input.input ?? {}) as Prisma.InputJsonObject,
      maxAttempts: input.maxAttempts ?? 3,
      costEstimateUsd:
        input.costEstimateUsd !== undefined ? new Prisma.Decimal(input.costEstimateUsd) : null,
      requestedById: userIdOf(actor),
    },
  });
  const queued = needsApproval ? false : await enqueueJob(job.id, job.maxAttempts);
  if (queued)
    await db.productionJob.update({ where: { id: job.id }, data: { queueJobId: job.id } });
  await recordAudit({
    action: "job.created",
    actor,
    target: { type: "job", id: job.id },
    metadata: {
      type: input.type,
      projectId: input.projectId,
      costEstimateUsd: input.costEstimateUsd ?? 0,
    },
  });
  return { job, queued };
}

/** Money spent this calendar month (UTC) across all jobs, plus approved estimates not yet spent. */
export async function monthlyCommittedUsd(db: PrismaClient, now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [spent, reserved] = await Promise.all([
    db.productionJob.aggregate({
      _sum: { actualCostUsd: true },
      where: { finishedAt: { gte: monthStart } },
    }),
    db.productionJob.aggregate({
      _sum: { costEstimateUsd: true },
      where: { status: { in: ["QUEUED", "RUNNING"] }, approvedAt: { not: null } },
    }),
  ]);
  return Number(spent._sum.actualCostUsd ?? 0) + Number(reserved._sum.costEstimateUsd ?? 0);
}

/**
 * Approve a billable job's cost estimate. Refused when it would exceed the project's budget or
 * the monthly ceiling (AI_MONTHLY_BUDGET_USD). Both default to 0, so nothing is ever spent
 * until an administrator sets a budget.
 */
export async function approveJobCost(
  db: PrismaClient,
  actor: Actor,
  jobId: string,
  options: { now?: Date; monthlyCeilingUsd?: number } = {},
) {
  if (!hasPermission(actor.role, "spend:approve")) {
    throw new JobServiceError("Only administrators can approve spending.");
  }
  const job = await db.productionJob.findUnique({
    where: { id: jobId },
    include: { project: true },
  });
  if (!job || job.status !== "AWAITING_APPROVAL") throw new JobServiceError("Nothing to approve.");
  const estimate = Number(job.costEstimateUsd ?? 0);
  const project = job.project;
  if (project) {
    const reserved = await db.productionJob.aggregate({
      _sum: { costEstimateUsd: true },
      where: {
        projectId: project.id,
        status: { in: ["QUEUED", "RUNNING"] },
        approvedAt: { not: null },
      },
    });
    const committed = Number(project.spentUsd) + Number(reserved._sum.costEstimateUsd ?? 0);
    if (committed + estimate > Number(project.budgetUsd)) {
      throw new JobServiceError(
        `Over the project budget: $${committed.toFixed(2)} committed + $${estimate.toFixed(4)} estimated is more than the $${Number(project.budgetUsd).toFixed(2)} budget.`,
      );
    }
  }
  const now = options.now ?? new Date();
  const ceiling = options.monthlyCeilingUsd ?? getServerEnv().env.AI_MONTHLY_BUDGET_USD;
  const monthly = await monthlyCommittedUsd(db, now);
  if (monthly + estimate > ceiling) {
    throw new JobServiceError(
      `Over the monthly spending ceiling: $${monthly.toFixed(2)} committed + $${estimate.toFixed(4)} estimated is more than $${ceiling.toFixed(2)} (AI_MONTHLY_BUDGET_USD).`,
    );
  }
  const updated = await db.productionJob.updateMany({
    where: { id: jobId, status: "AWAITING_APPROVAL" },
    data: { status: "QUEUED", approvedById: actor.id, approvedAt: now },
  });
  if (updated.count === 0) throw new JobServiceError("Nothing to approve.");
  const queued = await enqueueJob(jobId, job.maxAttempts);
  if (queued) await db.productionJob.update({ where: { id: jobId }, data: { queueJobId: jobId } });
  await recordAudit({
    action: "spend.approved",
    actor,
    target: { type: "job", id: jobId },
    metadata: { estimateUsd: estimate, projectId: job.projectId, type: job.type },
  });
  return { queued };
}

export async function cancelJob(db: PrismaClient, actor: Actor, jobId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new JobServiceError("You cannot cancel jobs.");
  const updated = await db.productionJob.updateMany({
    where: { id: jobId, status: { in: [...ACTIVE] } },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  if (updated.count === 0) throw new JobServiceError("This job is not active.");
  await dequeueJob(jobId);
  await recordAudit({ action: "job.cancelled", actor, target: { type: "job", id: jobId } });
}

/** Start a failed or cancelled job again. Billable jobs need their cost approved again. */
export async function retryJob(db: PrismaClient, actor: Actor, jobId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new JobServiceError("You cannot retry jobs.");
  const job = await db.productionJob.findUnique({ where: { id: jobId } });
  if (!job || !["FAILED", "CANCELLED"].includes(job.status)) {
    throw new JobServiceError("Only failed or cancelled jobs can be retried.");
  }
  const active = await db.productionJob.findFirst({
    where: { projectId: job.projectId, type: job.type, status: { in: [...ACTIVE] } },
  });
  if (active) throw new JobServiceError("This step is already queued or running.");
  const billable = Number(job.costEstimateUsd ?? 0) > 0;
  await db.productionJob.update({
    where: { id: jobId },
    data: {
      status: billable ? "AWAITING_APPROVAL" : "QUEUED",
      attempts: 0,
      progress: 0,
      error: null,
      output: Prisma.DbNull,
      startedAt: null,
      finishedAt: null,
      approvedById: null,
      approvedAt: null,
    },
  });
  const queued = billable ? false : await enqueueJob(jobId, job.maxAttempts);
  await recordAudit({ action: "job.retried", actor, target: { type: "job", id: jobId } });
  return { queued, needsApproval: billable };
}
