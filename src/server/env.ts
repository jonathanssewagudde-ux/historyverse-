import "server-only";
import { z } from "zod";

/**
 * Server environment, validated with Zod.
 *
 * Design rule: a missing or malformed value for one integration must never take down unrelated
 * features. Each variable is therefore validated independently; invalid values are dropped (treated
 * as unset) and reported as issues, which the integration registry surfaces with setup guidance.
 *
 * Never import this module from client components — secrets live here.
 */

const optionalString = z.string().trim().min(1).optional();
const optionalUrl = z.url().optional();

export const serverEnvSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Core infrastructure
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// connection string")
    .optional(),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, "must be a redis:// or rediss:// URL")
    .optional(),

  // Authentication
  AUTH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  AUTH_GOOGLE_ID: optionalString,
  AUTH_GOOGLE_SECRET: optionalString,

  // Media storage
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,

  // Historical sources
  WIKIMEDIA_USER_AGENT: z
    .string()
    .regex(/\S+\/\S+ \(.+\)/, "must follow Wikimedia's format: AppName/1.0 (contact URL or email)")
    .optional(),
  EUROPEANA_API_KEY: optionalString,
  SMITHSONIAN_API_KEY: optionalString,
  LOC_ENABLED: z.stringbool().default(false),

  // AI: language models
  AI_PROVIDER: z
    .enum(["none", "ollama", "openai-compatible", "anthropic", "openai", "gemini"])
    .default("none"),
  AI_MODEL: optionalString,
  AI_BASE_URL: optionalUrl,
  AI_API_KEY: optionalString,
  EMBEDDING_PROVIDER: z
    .enum(["none", "ollama", "openai-compatible", "openai", "gemini"])
    .default("none"),
  EMBEDDING_MODEL: optionalString,

  // AI: media
  IMAGE_PROVIDER: z.enum(["none", "openai", "gemini", "stability", "comfyui"]).default("none"),
  IMAGE_API_KEY: optionalString,
  IMAGE_BASE_URL: optionalUrl,
  TTS_PROVIDER: z
    .enum(["none", "piper", "espeak", "openai", "elevenlabs", "google"])
    .default("none"),
  TTS_API_KEY: optionalString,
  TTS_BASE_URL: optionalUrl,
  VIDEO_GEN_PROVIDER: z.enum(["none", "runway", "kling", "google"]).default("none"),
  VIDEO_GEN_API_KEY: optionalString,

  // Video production
  FFMPEG_PATH: z.string().default("ffmpeg"),

  // YouTube
  YOUTUBE_OAUTH_CLIENT_ID: optionalString,
  YOUTUBE_OAUTH_CLIENT_SECRET: optionalString,
  YOUTUBE_OAUTH_REDIRECT_URI: optionalUrl,

  // Maps
  MAP_STYLE_URL: optionalUrl,

  // Analytics
  ANALYTICS_PROVIDER: z.enum(["none", "plausible", "posthog", "google"]).default("none"),
  ANALYTICS_KEY: optionalString,

  // Cost controls: monthly ceiling (USD) for all billable providers combined. 0 = never spend.
  AI_MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(0),

  // Comma-separated integration ids an operator has switched off.
  INTEGRATIONS_DISABLED: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
} satisfies Record<string, z.ZodType>;

type Schema = typeof serverEnvSchema;
export type ServerEnv = { [K in keyof Schema]: z.output<Schema[K]> };
export type EnvKey = keyof Schema;

export interface EnvIssue {
  key: EnvKey;
  message: string;
}

export interface ParsedEnv {
  env: ServerEnv;
  issues: EnvIssue[];
}

/** Parse a raw environment record. Pure and side-effect free, so it is directly testable. */
export function parseServerEnv(raw: Record<string, string | undefined>): ParsedEnv {
  const env: Record<string, unknown> = {};
  const issues: EnvIssue[] = [];

  for (const [key, schema] of Object.entries(serverEnvSchema) as [EnvKey, z.ZodType][]) {
    // Treat empty strings as unset, which is how most .env files express "not configured".
    const value = raw[key] === "" ? undefined : raw[key];
    const result = schema.safeParse(value);
    if (result.success) {
      env[key] = result.data;
    } else {
      issues.push({ key, message: result.error.issues[0]?.message ?? "invalid value" });
      // Fall back to the schema's behaviour for an unset value (its default, or undefined).
      const fallback = schema.safeParse(undefined);
      env[key] = fallback.success ? fallback.data : undefined;
    }
  }

  return { env: env as ServerEnv, issues };
}

let cached: ParsedEnv | undefined;

/** Validated server environment for the running process (memoised). */
export function getServerEnv(): ParsedEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
