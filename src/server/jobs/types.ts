import type { JobType, PrismaClient } from "@/generated/prisma/client";

/** What a job handler can do while it runs. */
export interface JobContext {
  db: PrismaClient;
  jobId: string;
  projectId: string | null;
  input: Record<string, unknown>;
  /** Record progress (0–100) and an optional human-readable step. */
  progress(percent: number, step?: string): Promise<void>;
  /** True once a person has cancelled the job; handlers stop at the next safe point. */
  isCancelled(): Promise<boolean>;
  /**
   * Record money spent, immediately after the paid call returns, so it is counted even if the
   * job fails afterwards (e.g. the output does not pass validation).
   */
  recordCost(usd: number): Promise<void>;
}

export interface JobResult {
  output: Record<string, unknown>;
}

export type JobHandler = (ctx: JobContext) => Promise<JobResult>;
export type JobHandlers = Partial<Record<JobType, JobHandler>>;

/** Thrown by handlers for failures that retrying cannot fix (bad input, missing approval…). */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

export class JobCancelledError extends Error {
  constructor() {
    super("Cancelled by a person.");
    this.name = "JobCancelledError";
  }
}
