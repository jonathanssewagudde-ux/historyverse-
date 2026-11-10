import { config as loadEnv } from "dotenv";

// Scripts run outside Next.js, so load env files the same way Next does.
loadEnv({ path: [".env.local", ".env"], quiet: true });
