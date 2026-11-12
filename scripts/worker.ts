/**
 * Background worker: runs research and drafting jobs from the Redis queue.
 *
 *   pnpm worker
 *
 * Needs REDIS_URL, DATABASE_URL and WIKIMEDIA_USER_AGENT. On start it re-queues jobs that were
 * waiting or interrupted, so nothing is lost when the worker or Redis restarts.
 */
import "./_env";

import { getDb } from "@/server/db/client";
import { createJobHandlers } from "@/server/jobs/handlers";
import { getQueue } from "@/server/jobs/queue";
import { recoverJobs, startWorker } from "@/server/jobs/worker";

async function main() {
  const db = getDb();
  const handlers = createJobHandlers();
  const recovered = await recoverJobs(db);
  const worker = startWorker(db, handlers, Number(process.env.WORKER_CONCURRENCY ?? 2));
  console.warn(`HISTORYVERSE worker started; ${recovered} job(s) queued from the database.`);

  const stop = async (signal: string) => {
    console.warn(`${signal}: finishing the current jobs, then stopping…`);
    await worker.close();
    await getQueue()?.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
