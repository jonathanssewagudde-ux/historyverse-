import { defineConfig } from "vitest/config";

import defaults from "./tests/support/test-env.json" with { type: "json" };

const testEnv = {
  ...defaults,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? defaults.DATABASE_URL,
};

/**
 * Integration tests run against a real PostgreSQL database (historyverse_test) with all
 * migrations applied. They are kept separate from unit tests because they need the database.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    env: { ...testEnv, NODE_ENV: "test" },
    alias: { "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname },
    // One database is shared, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
