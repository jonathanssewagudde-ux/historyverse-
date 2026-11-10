import { connection } from "next/server";

import packageJson from "../../../../package.json";

/**
 * Liveness probe for load balancers, uptime checks and the e2e test harness.
 * Deliberately public and minimal: integration details are only exposed in the admin dashboard.
 * Dependency checks (database, Redis) are added in the milestones that introduce them.
 */
export async function GET() {
  await connection(); // always evaluate at request time, never prerender
  return Response.json(
    {
      status: "ok",
      service: "historyverse",
      version: packageJson.version,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
