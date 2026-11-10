import type { EnvKey, ServerEnv } from "@/server/env";

/**
 * - mandatory-platform: required for HISTORYVERSE to function as specified (e.g. PostgreSQL).
 * - mandatory-external: an external service required for one specific capability (e.g. YouTube uploads).
 * - optional: enhancement; the platform must work fully without it.
 */
export type IntegrationClassification = "mandatory-platform" | "mandatory-external" | "optional";

export type IntegrationCategory =
  | "infrastructure"
  | "authentication"
  | "historical-sources"
  | "ai"
  | "media"
  | "video"
  | "publishing"
  | "maps"
  | "analytics";

/**
 * `connected` and `connection_failed` are only ever set by a real connection test (added per
 * integration in later milestones). Configuration alone never reports `connected`.
 */
export type IntegrationStatus =
  "not_configured" | "configured" | "connected" | "connection_failed" | "disabled";

export interface IntegrationDefinition {
  id: string;
  name: string;
  classification: IntegrationClassification;
  category: IntegrationCategory;
  purpose: string;
  /** Milestone where the integration is implemented. */
  milestone: number;
  capabilities: string[];
  /** Whether using it can incur charges. Billable calls always require explicit approval + budget. */
  billable: boolean;
  /** Env variables this integration reads. Names only; values are never exposed. */
  envKeys: EnvKey[];
  /** Env keys that hold secrets (subset of envKeys). */
  secretEnvKeys?: EnvKey[];
  /** Returns the env keys still missing for this integration to be considered configured. */
  missing: (env: ServerEnv) => EnvKey[];
  /** What keeps working when this integration is unavailable. */
  fallback: string;
  docs?: string;
  /** True once an adapter exists in the codebase. Configuration alone does not make it usable. */
  implemented?: boolean;
}

export interface IntegrationState {
  id: string;
  name: string;
  classification: IntegrationClassification;
  category: IntegrationCategory;
  purpose: string;
  milestone: number;
  capabilities: string[];
  billable: boolean;
  fallback: string;
  implemented: boolean;
  status: IntegrationStatus;
  missingEnv: EnvKey[];
  /** Human-readable configuration problems, e.g. malformed variables. Never contains secret values. */
  errors: string[];
}
