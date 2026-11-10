/**
 * Import Wikidata items as draft entities.
 *
 *   pnpm ingest:wikidata --dataset data/datasets/uganda-buganda.json --media
 *   pnpm ingest:wikidata Q1036 Q473748:KINGDOM --follow-kin 1
 */
import "./_env";

import { readFileSync } from "node:fs";

import { getDb } from "@/server/db/client";
import { importFromWikidata, type ImportSeed } from "@/server/ingestion/wikidata-import";
import { createWikimediaSources } from "@/server/sources";
import { isQid } from "@/server/sources/wikidata/client";
import type { ImportKind } from "@/server/sources/wikidata/mapper";

function parseArgs(argv: string[]) {
  const seeds: ImportSeed[] = [];
  let followKin: number | undefined;
  let maxEntities: number | undefined;
  let withMedia = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--media") withMedia = true;
    else if (arg === "--follow-kin") followKin = Number(argv[++i]);
    else if (arg === "--max") maxEntities = Number(argv[++i]);
    else if (arg === "--dataset") {
      const dataset = JSON.parse(readFileSync(argv[++i]!, "utf8")) as {
        seeds: ImportSeed[];
        followKin?: number;
        maxEntities?: number;
      };
      seeds.push(...dataset.seeds.map(({ qid, kind }) => ({ qid, kind })));
      followKin ??= dataset.followKin;
      maxEntities ??= dataset.maxEntities;
    } else {
      const [qid, kind] = arg.split(":");
      if (!qid || !isQid(qid)) throw new Error(`Not a Wikidata id: ${arg}`);
      seeds.push({ qid, kind: kind as ImportKind | undefined });
    }
  }
  if (seeds.length === 0)
    throw new Error(
      "Usage: pnpm ingest:wikidata [--dataset file.json] [Q123[:KIND] …] [--follow-kin N] [--max N] [--media]",
    );
  return { seeds, followKin, maxEntities, withMedia };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = getDb();
  const sources = createWikimediaSources();
  const report = await importFromWikidata(
    { db, wikidata: sources.wikidata, commons: sources.commons },
    options,
  );
  const { warnings, failed, ...summary } = report;
  console.warn(
    JSON.stringify(
      {
        ...summary,
        created: summary.created.length,
        updated: summary.updated.length,
        protectedFromOverwrite: summary.protectedFromOverwrite.length,
      },
      null,
      2,
    ),
  );
  for (const f of failed) console.error(`FAILED ${f.qid}: ${f.error}`);
  for (const w of warnings) console.warn(`warning ${w.qid}: ${w.message}`);
  await db.$disconnect();
  if (failed.length > 0 && report.created.length + report.updated.length === 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
