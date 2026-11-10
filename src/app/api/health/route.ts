import { connection } from "next/server";

import { checkDatabase } from "@/server/db/health";
import packageJson from "../../../../package.json";

/**
 * Liveness/readiness probe for load balancers, uptime checks and the e2e test harness.
 * Deliberately public and minimal: it reports whether dependencies answer, never how they are
 * configured. `status` is "ok" when every configured dependency responds, otherwise "degraded".
 */
export async function GET() {
  await connection(); // always evaluate at request time, never prerender

  const database = await checkDatabase();
  const healthy = database.status !== "down";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "historyverse",
      version: packageJson.version,
      time: new Date().toISOString(),
      checks: { database: database.status },
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
