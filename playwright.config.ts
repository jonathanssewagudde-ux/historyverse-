import { defineConfig, devices } from "@playwright/test";

import { testEnv } from "./tests/support/test-env";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests run against a production build (`next build` must run first, see `pnpm test:e2e`)
 * and a dedicated PostgreSQL test database that is migrated and emptied before each run.
 * The Chromium binary is the one pre-installed alongside the pinned @playwright/test version.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "off" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    // The server under test uses the disposable test database, never the development one.
    env: { ...testEnv, AUTH_URL: baseURL },
  },
});
