/**
 * Start a "Generate History Project" from the command line (operator tool).
 *
 *   pnpm project:create "The Complete History of the Buganda Kingdom" --qid Q473748
 *
 * The budget is always $0 here: paid steps need an administrator's approval in the Studio.
 */
import "./_env";

import { getDb } from "@/server/db/client";
import { createProject } from "@/server/research/projects";

async function main() {
  const args = process.argv.slice(2);
  const qidIndex = args.indexOf("--qid");
  const qid = qidIndex >= 0 ? (args[qidIndex + 1] ?? "") : "";
  const topic = args
    .filter((_, i) => qidIndex < 0 || (i !== qidIndex && i !== qidIndex + 1))
    .join(" ");
  if (!topic) throw new Error('Usage: pnpm project:create "Topic" [--qid Q123]');
  const db = getDb();
  const { project, queued } = await createProject(
    db,
    { id: "system:cli", role: "SUPER_ADMINISTRATOR" },
    { topic, subjectQid: qid, budgetUsd: 0 },
  );
  console.warn(
    `Project ${project.slug} (${project.id}) created; research ${queued ? "queued" : "waiting for a worker (REDIS_URL not set)"}.`,
  );
  await db.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
