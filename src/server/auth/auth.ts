import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { siteConfig } from "@/config/site";
import { recordAudit } from "@/server/audit";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { ProviderUnavailableError } from "@/server/providers/contracts";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

function createAuth() {
  const { env } = getServerEnv();
  if (!env.AUTH_SECRET) {
    throw new ProviderUnavailableError(
      "auth",
      "AUTH_SECRET is not configured. Generate one with `openssl rand -base64 32`.",
    );
  }
  const googleConfigured = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  const production = env.NODE_ENV === "production";

  return betterAuth({
    appName: siteConfig.name,
    baseURL: siteConfig.url,
    secret: env.AUTH_SECRET,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    telemetry: { enabled: false },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      autoSignIn: true,
      // Email delivery is not configured yet, so verification and reset emails cannot be sent.
      requireEmailVerification: false,
    },

    socialProviders: googleConfigured
      ? { google: { clientId: env.AUTH_GOOGLE_ID!, clientSecret: env.AUTH_GOOGLE_SECRET! } }
      : undefined,

    user: {
      additionalFields: {
        // `input: false`: a client can never set or change its own role through the auth API.
        role: { type: "string", input: false, defaultValue: "USER" },
        bio: { type: "string", required: false },
        locale: { type: "string", required: false, defaultValue: "en" },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 14, // 14 days
      updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    },

    rateLimit: {
      enabled: production && env.AUTH_RATE_LIMIT_ENABLED,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 10, max: 5 },
        "/change-password": { window: 60 * 10, max: 5 },
      },
    },

    advanced: {
      cookiePrefix: "hv",
      useSecureCookies: production && siteConfig.url.startsWith("https://"),
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await recordAudit({
              action: "user.registered",
              actor: { id: user.id, email: user.email, role: "USER" },
              target: { type: "user", id: user.id },
            });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await recordAudit({
              action: "session.created",
              actor: { id: session.userId },
              target: { type: "session", id: session.id },
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
            });
          },
        },
      },
    },

    // Must stay last: lets server actions set auth cookies.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { __historyverseAuth?: Auth };

/** Lazily created so a missing secret or database only affects auth, never the public site. */
export function getAuth(): Auth {
  globalForAuth.__historyverseAuth ??= createAuth();
  return globalForAuth.__historyverseAuth;
}

export function isAuthConfigured(): boolean {
  const { env } = getServerEnv();
  return Boolean(env.AUTH_SECRET && env.DATABASE_URL);
}
