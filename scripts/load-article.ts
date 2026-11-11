/**
 * Load an article data file into the database as a DRAFT.
 *
 *   pnpm article:load data/articles/buganda-kingdom.json
 */
import "./_env";

import { readFileSync } from "node:fs";

import { ArticleLoadError, loadArticle } from "@/server/content/load-article";
import { getDb } from "@/server/db/client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm article:load <file.json>");
  const db = getDb();
  const report = await loadArticle(db, JSON.parse(readFileSync(file, "utf8")));
  const { warnings, ...summary } = report;
  console.warn(JSON.stringify(summary, null, 2));
  for (const w of warnings) console.warn(`warning: ${w}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(
    error instanceof ArticleLoadError || error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
