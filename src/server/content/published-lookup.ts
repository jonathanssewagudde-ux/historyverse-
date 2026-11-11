import pg from "pg";

import { sectionTemplates, type PublicSection } from "@/lib/content/paths";

/**
 * Minimal "is this slug published in this section?" check for the request proxy. Deliberately
 * tiny: one indexed query, its own small pool, no ORM. Returns null when the answer is unknown
 * (database not configured or unreachable) so the caller can let the page decide instead.
 */
const globalForPool = globalThis as unknown as { __historyverseLookupPool?: pg.Pool };

function pool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  globalForPool.__historyverseLookupPool ??= new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return globalForPool.__historyverseLookupPool;
}

export async function isPublishedInSection(
  section: PublicSection,
  slug: string,
): Promise<boolean | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return false;
  const p = pool();
  if (!p) return null;
  try {
    const { rowCount } = await p.query(
      `SELECT 1 FROM "articles"
        WHERE "slug" = $1 AND "status" IN ('PUBLISHED', 'UPDATED') AND "deletedAt" IS NULL
          AND "template"::text = ANY($2::text[])
        LIMIT 1`,
      [slug, sectionTemplates[section]],
    );
    return (rowCount ?? 0) > 0;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        scope: "proxy.article-lookup",
        message: "lookup failed; page will decide",
        error: error instanceof Error ? error.name : "error",
      }),
    );
    return null;
  }
}
