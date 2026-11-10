import { execFileSync } from "node:child_process";

import { migrateTestDatabase, truncateAll } from "../tests/support/database";
import { TEST_DATABASE_URL } from "../tests/support/test-env";

/** Start every e2e run from a migrated, empty test database with reference data seeded. */
export default async function globalSetup() {
  migrateTestDatabase();
  await truncateAll();
  execFileSync("pnpm", ["db:seed"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
