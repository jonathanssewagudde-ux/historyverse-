import { timingSafeEqual } from "node:crypto";

import { revalidateTag } from "next/cache";

import { tags } from "@/server/content/public";
import { runDuePublications } from "@/server/content/schedule";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer /, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Publishes approved, due articles. Call it from any scheduler (e.g. every 5 minutes):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/publish
 * Disabled (404) unless CRON_SECRET is configured.
 */
export async function POST(request: Request) {
  const secret = getServerEnv().env.CRON_SECRET;
  if (!secret) return json({ error: "Not found" }, 404);
  if (!authorized(request, secret)) return json({ error: "Unauthorized" }, 401);
  const run = await runDuePublications(getDb());
  for (const { slug } of run.published) revalidateTag(tags.article(slug), { expire: 0 });
  if (run.published.length > 0) revalidateTag(tags.articles, { expire: 0 });
  return json(run);
}
