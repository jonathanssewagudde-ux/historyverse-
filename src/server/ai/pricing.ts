import type { ServerEnv } from "@/server/env";

export interface Price {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens (thinking tokens are billed as output). */
  output: number;
  /** Where the price came from, shown with every estimate. */
  basis: string;
}

/**
 * Anthropic first-party list prices (USD per million tokens) for current Claude models, as
 * published at the time of writing. AI_INPUT_USD_PER_MTOK / AI_OUTPUT_USD_PER_MTOK override
 * them, so a price change never needs a code change.
 */
const CLAUDE_PRICES: Record<string, { input: number; output: number }> = {
  "claude-fable-5-2": { input: 8, output: 40 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/**
 * The price that cost estimates use, or null when it is unknown. An unknown price makes the
 * provider unusable rather than free: spending is never estimated as zero by accident.
 */
export function priceFor(
  env: Pick<
    ServerEnv,
    "AI_PROVIDER" | "AI_MODEL" | "AI_INPUT_USD_PER_MTOK" | "AI_OUTPUT_USD_PER_MTOK"
  >,
): Price | null {
  if (env.AI_INPUT_USD_PER_MTOK !== undefined && env.AI_OUTPUT_USD_PER_MTOK !== undefined) {
    return {
      input: env.AI_INPUT_USD_PER_MTOK,
      output: env.AI_OUTPUT_USD_PER_MTOK,
      basis: "configured price (AI_INPUT_USD_PER_MTOK / AI_OUTPUT_USD_PER_MTOK)",
    };
  }
  // A local Ollama server costs nothing per token.
  if (env.AI_PROVIDER === "ollama")
    return { input: 0, output: 0, basis: "local model (no charge)" };
  if (env.AI_PROVIDER === "anthropic" && env.AI_MODEL && CLAUDE_PRICES[env.AI_MODEL]) {
    return { ...CLAUDE_PRICES[env.AI_MODEL]!, basis: `Anthropic list price for ${env.AI_MODEL}` };
  }
  return null;
}

/** Cost in USD for a token count at a price. */
export function costUsd(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

/**
 * Conservative input-token estimate without calling any API: about one token per three
 * characters overestimates typical English and historical names, so approvals err high.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
