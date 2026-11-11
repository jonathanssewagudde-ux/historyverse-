/**
 * Download the image files of an article's media from Wikimedia Commons into storage.
 *
 *   pnpm media:fetch --article buganda
 */
import "./_env";

import { fetchCommonsMedia } from "@/server/content/media-files";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { createSourceHttpClient } from "@/server/sources/http";
import { getStorage } from "@/server/storage";

async function main() {
  const [flag, slug] = process.argv.slice(2);
  if (flag !== "--article" || !slug) throw new Error("Usage: pnpm media:fetch --article <slug>");
  const userAgent = getServerEnv().env.WIKIMEDIA_USER_AGENT;
  if (!userAgent) throw new Error("WIKIMEDIA_USER_AGENT is not configured.");

  const db = getDb();
  const article = await db.article.findUnique({ where: { slug }, include: { media: true } });
  if (!article) throw new Error(`No article with slug "${slug}".`);

  const http = createSourceHttpClient({
    userAgent,
    minIntervalMs: 3000,
    maxRetries: 8,
    maxBackoffMs: 120_000,
  });
  const results = await fetchCommonsMedia(
    { db, storage: getStorage(), http },
    article.media.map((m) => m.mediaId),
  );
  for (const r of results)
    console.warn(`${r.status.padEnd(15)} ${r.mediaId}${r.detail ? ` (${r.detail})` : ""}`);
  await db.$disconnect();
  if (results.some((r) => r.status === "failed")) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
