import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/server/env";
import { ProviderUnavailableError } from "@/server/providers/contracts";

const globalForDb = globalThis as unknown as { __historyverseDb?: PrismaClient };

export function isDatabaseConfigured(): boolean {
  return Boolean(getServerEnv().env.DATABASE_URL);
}

/**
 * The Prisma client, created on first use. Throws ProviderUnavailableError when DATABASE_URL is
 * missing so callers (and pages) can degrade gracefully instead of crashing at import time.
 * Cached on globalThis so dev-server hot reloads do not open a new pool each time.
 */
export function getDb(): PrismaClient {
  if (globalForDb.__historyverseDb) return globalForDb.__historyverseDb;

  const url = getServerEnv().env.DATABASE_URL;
  if (!url) {
    throw new ProviderUnavailableError(
      "postgres",
      "DATABASE_URL is not configured. Set it in .env.local (see .env.example).",
    );
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  globalForDb.__historyverseDb = client;
  return client;
}
