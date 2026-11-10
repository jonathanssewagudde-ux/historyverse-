import "server-only";
import { getServerEnv, type ParsedEnv } from "@/server/env";
import { integrations } from "./registry";
import type { IntegrationDefinition, IntegrationState } from "./types";

/**
 * Derive each integration's status from configuration only. This never contacts external services,
 * so it can only report `not_configured`, `configured` or `disabled`; live connection tests that can
 * report `connected` / `connection_failed` are added per integration in their milestones.
 */
export function resolveIntegrationStates(
  parsed: ParsedEnv,
  definitions: IntegrationDefinition[] = integrations,
): IntegrationState[] {
  const { env, issues } = parsed;
  const disabled = new Set(env.INTEGRATIONS_DISABLED);

  return definitions.map((def) => {
    const errors = issues
      .filter((issue) => def.envKeys.includes(issue.key))
      .map((issue) => `${issue.key}: ${issue.message}`);
    const missingEnv = def.missing(env);
    const status = disabled.has(def.id)
      ? "disabled"
      : missingEnv.length === 0 && errors.length === 0
        ? "configured"
        : "not_configured";

    return {
      id: def.id,
      name: def.name,
      classification: def.classification,
      category: def.category,
      purpose: def.purpose,
      milestone: def.milestone,
      capabilities: def.capabilities,
      billable: def.billable,
      fallback: def.fallback,
      implemented: def.implemented ?? false,
      status,
      missingEnv,
      errors,
    };
  });
}

export function getIntegrationStates(): IntegrationState[] {
  return resolveIntegrationStates(getServerEnv());
}
