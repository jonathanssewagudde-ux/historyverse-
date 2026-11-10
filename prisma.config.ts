import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma does not read .env files itself. Mirror Next.js precedence: .env.local, then .env.
loadEnv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Not required for `prisma generate`; required for migrate/seed commands.
    url: process.env.DATABASE_URL ?? "",
  },
});
