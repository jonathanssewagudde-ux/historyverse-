import "server-only";

import { Queue } from "bullmq";

import { getServerEnv } from "@/server/env";

export const QUEUE_NAME = "historyverse-jobs";

/** BullMQ connection options from REDIS_URL (null when the queue is not configured). */
export function redisConnection(): { url: string; maxRetriesPerRequest: null } | null {
  const url = getServerEnv().env.REDIS_URL;
  return url ? { url, maxRetriesPerRequest: null } : null;
}

/** Queue key prefix (QUEUE_PREFIX). Worker counts are per prefix, even across Redis databases. */
export const queuePrefix = () => getServerEnv().env.QUEUE_PREFIX;

let queue: Queue | null | undefined;

export function getQueue(): Queue | null {
  if (queue !== undefined) return queue;
  const connection = redisConnection();
  queue = connection ? new Queue(QUEUE_NAME, { connection, prefix: queuePrefix() }) : null;
  return queue;
}

/**
 * Hand a job row to the queue. The BullMQ job id is the row id, so adding twice is harmless.
 * Retries are decided by the runner (it knows which errors are worth retrying), so BullMQ is
 * told to try `attempts` times with exponential backoff.
 */
export async function enqueueJob(jobId: string, attempts: number): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  // A finished copy with the same id would make BullMQ ignore the new one (e.g. after a retry).
  const previous = await q.getJob(jobId);
  if (previous && ((await previous.isCompleted()) || (await previous.isFailed()))) {
    await previous.remove();
  }
  await q.add(
    "run",
    { jobId },
    {
      jobId,
      attempts,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 7 * 86_400 },
      removeOnFail: { age: 30 * 86_400 },
    },
  );
  return true;
}

/** Remove a job that has not started yet. Running jobs stop at their next cancellation check. */
export async function dequeueJob(jobId: string): Promise<void> {
  const q = getQueue();
  if (!q) return;
  const job = await q.getJob(jobId);
  if (job && ((await job.isWaiting()) || (await job.isDelayed()))) await job.remove();
}

/** Real round-trip to Redis, for health checks and the Integrations page. */
export async function pingQueue(): Promise<{ waiting: number; active: number; failed: number }> {
  const q = getQueue();
  if (!q) throw new Error("REDIS_URL is not configured.");
  const counts = await q.getJobCounts("waiting", "active", "failed", "delayed");
  return {
    waiting: (counts.waiting ?? 0) + (counts.delayed ?? 0),
    active: counts.active ?? 0,
    failed: counts.failed ?? 0,
  };
}
