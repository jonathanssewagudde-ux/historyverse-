import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/server/logger";
import { JobCancelledError, PermanentJobError, type JobHandlers } from "./types";

const log = createLogger("jobs");

export type RunOutcome = "succeeded" | "failed" | "retry" | "cancelled" | "skipped";

/** Network trouble and rate limits are worth retrying; everything else is reported at once. */
export function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof PermanentJobError) return false;
  return /\b(429|500|502|503|504)\b|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|timed out|socket hang up/i.test(
    error.message,
  );
}

/** Short, safe error text for the UI (no URLs with tokens, no stack traces). */
export function jobErrorText(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error.";
  return error.message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 500);
}

/**
 * Run one job row. The database row, not the queue, decides what happens:
 *  - only QUEUED jobs start (cancelled or finished jobs are skipped, so a duplicate queue
 *    delivery is harmless);
 *  - transient failures go back to QUEUED while attempts remain, and the caller retries;
 *  - permanent failures and exhausted attempts end as FAILED with the reason.
 */
export async function runJob(
  db: PrismaClient,
  jobId: string,
  handlers: JobHandlers,
): Promise<RunOutcome> {
  // Claim atomically: QUEUED → RUNNING. A second worker gets count 0 and skips.
  const claimed = await db.productionJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 }, error: null },
  });
  if (claimed.count === 0) return "skipped";
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  const handler = handlers[job.type];

  const finish = (data: Prisma.ProductionJobUpdateManyMutationInput) =>
    db.productionJob.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: { ...data, finishedAt: new Date() },
    });

  if (!handler) {
    await finish({ status: "FAILED", error: `No handler for ${job.type} jobs in this milestone.` });
    return "failed";
  }

  try {
    const result = await handler({
      db,
      jobId,
      projectId: job.projectId,
      input: (job.input ?? {}) as Record<string, unknown>,
      async progress(percent, step) {
        await db.productionJob.updateMany({
          where: { id: jobId, status: "RUNNING" },
          data: {
            progress: Math.max(0, Math.min(99, Math.round(percent))),
            ...(step ? { output: { step } as Prisma.InputJsonObject } : {}),
          },
        });
      },
      async isCancelled() {
        const row = await db.productionJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        return row?.status === "CANCELLED";
      },
      async recordCost(usd) {
        if (!(usd > 0)) return;
        const amount = new Prisma.Decimal(usd.toFixed(6));
        // `increment` on a NULL column stays NULL in SQL, so add to the current value instead.
        const current = await db.productionJob.findUniqueOrThrow({
          where: { id: jobId },
          select: { actualCostUsd: true },
        });
        await db.$transaction([
          db.productionJob.update({
            where: { id: jobId },
            data: { actualCostUsd: (current.actualCostUsd ?? new Prisma.Decimal(0)).add(amount) },
          }),
          ...(job.projectId
            ? [
                db.contentProject.update({
                  where: { id: job.projectId },
                  data: { spentUsd: { increment: amount } },
                }),
              ]
            : []),
        ]);
      },
    });
    const done = await finish({
      status: "SUCCEEDED",
      progress: 100,
      output: result.output as Prisma.InputJsonObject,
    });
    return done.count === 0 ? "cancelled" : "succeeded";
  } catch (error) {
    if (error instanceof JobCancelledError) return "cancelled";
    const text = jobErrorText(error);
    // `job` was read after the claim, so `attempts` already counts this run.
    if (isTransient(error) && job.attempts < job.maxAttempts) {
      await db.productionJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: { status: "QUEUED", error: `Attempt ${job.attempts} failed, will retry: ${text}` },
      });
      log.warn("job will retry", { jobId, type: job.type, error: text });
      return "retry";
    }
    await finish({ status: "FAILED", error: text });
    log.warn("job failed", { jobId, type: job.type, error: text });
    return "failed";
  }
}
