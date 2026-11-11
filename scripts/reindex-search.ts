/**
 * Rebuild the public search index from the articles table.
 *
 *   pnpm search:reindex
 */
import "./_env";

import { getDb } from "@/server/db/client";
import { reindexAll } from "@/server/search/indexer";

async function main() {
  const db = getDb();
  const result = await reindexAll(db);
  console.warn(
    `Search index rebuilt: ${result.indexed} published article(s) indexed, ${result.removed} not public.`,
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
