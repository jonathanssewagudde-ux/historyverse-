import "server-only";

import { getDb, isDatabaseConfigured } from "./client";

export type DatabaseHealth =
  | { status: "not_configured" }
  | { status: "up"; latencyMs: number }
  | { status: "down"; error: string };

/** Real round-trip to PostgreSQL. Never reports "up" without a successful query. */
export async function checkDatabase(timeoutMs = 3000): Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) return { status: "not_configured" };
  const started = performance.now();
  try {
    await Promise.race([
      getDb().$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { status: "up", latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    // Connection errors can embed the connection string; report only the error class/code.
    const code = (error as { code?: string }).code;
    const name = error instanceof Error ? error.name : "Error";
    const timedOut = error instanceof Error && error.message.startsWith("timed out");
    return { status: "down", error: timedOut ? (error as Error).message : code ? `${name} (${code})` : name };
  }
}
