import "server-only";

import { Worker } from "bullmq";

import type { PrismaClient } from "@/generated/prisma/client";
import { createLogger } from "@/server/logger";
import { enqueueJob, QUEUE_NAME, queuePrefix, redisConnection } from "./queue";
import { runJob } from "./runner";
import type { JobHandlers } from "./types";

const log = createLogger("worker");

/**
 * Put every job the database says should run back on the queue. Called when a worker starts:
 * jobs created while Redis was down, and jobs interrupted by a crash (left RUNNING), resume.
 */
export async function recoverJobs(db: PrismaClient): Promise<number> {
  await db.productionJob.updateMany({
    where: { status: "RUNNING" },
    data: { status: "QUEUED", error: "Interrupted by a worker restart; queued again." },
  });
  const queued = await db.productionJob.findMany({
    where: { status: "QUEUED" },
    select: { id: true, maxAttempts: true },
  });
  for (const job of queued) await enqueueJob(job.id, job.maxAttempts);
  return queued.length;
}

/** Start consuming the queue. Returns the BullMQ worker so callers can close it. */
export function startWorker(db: PrismaClient, handlers: JobHandlers, concurrency = 2): Worker {
  const connection = redisConnection();
  if (!connection) throw new Error("REDIS_URL is not configured; the worker cannot start.");
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const jobId = String((job.data as { jobId?: string }).jobId ?? job.id);
      const outcome = await runJob(db, jobId, handlers);
      log.info("job finished", { jobId, outcome });
      // Throwing makes BullMQ retry with backoff; the row is already back in QUEUED.
      if (outcome === "retry") throw new Error("transient failure; retrying");
      return outcome;
    },
    { connection, concurrency, prefix: queuePrefix() },
  );
  worker.on("error", (error) => log.error("worker error", { error: String(error) }));
  return worker;
}
