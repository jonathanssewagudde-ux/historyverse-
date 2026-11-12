import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv, type ServerEnv } from "@/server/env";
import {
  ProviderUnavailableError,
  type CostEstimate,
  type GenerateTextRequest,
  type GenerateTextResult,
  type LanguageModelProvider,
} from "@/server/providers/contracts";
import { costUsd, estimateTokens, priceFor, type Price } from "./pricing";

const DEFAULT_MAX_OUTPUT = 16_000;

/** Thrown when the model declines a request (safety refusal); retrying will not help. */
export class ModelRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRefusalError";
  }
}

function estimate(price: Price, request: GenerateTextRequest): CostEstimate {
  const input = estimateTokens(
    request.messages.map((m) => m.content).join("\n") + JSON.stringify(request.jsonSchema ?? {}),
  );
  const output = request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT;
  return {
    currency: "USD",
    amount: Number(costUsd(price, input, output).toFixed(4)),
    basis: `≈${input.toLocaleString("en")} input tokens + up to ${output.toLocaleString("en")} output tokens at ${price.basis} ($${price.input}/$${price.output} per million). An upper bound: the full output budget is rarely used.`,
  };
}

/** Claude through the official Anthropic SDK. */
function anthropicProvider(env: ServerEnv, price: Price): LanguageModelProvider {
  const client = new Anthropic({ apiKey: env.AI_API_KEY, maxRetries: 2 });
  const model = env.AI_MODEL!;
  return {
    id: `anthropic:${model}`,
    estimateCost: (request) => estimate(price, request),
    async generate(request, signal) {
      const system = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      // Streaming keeps long drafts clear of HTTP timeouts; finalMessage() assembles the result.
      const stream = client.messages.stream(
        {
          model,
          max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
          ...(system ? { system } : {}),
          messages: request.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          // Grounded drafting is accuracy-sensitive work.
          output_config: {
            effort: "high",
            ...(request.jsonSchema
              ? { format: { type: "json_schema", schema: request.jsonSchema } }
              : {}),
          },
        },
        { signal },
      );
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") {
        const details = message.stop_details;
        throw new ModelRefusalError(
          `The model declined this request${details && "category" in details && details.category ? ` (${details.category})` : ""}.`,
        );
      }
      if (message.stop_reason === "max_tokens") {
        throw new Error(
          "The model ran out of output tokens before finishing; the draft is incomplete.",
        );
      }
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const inputTokens =
        message.usage.input_tokens +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0);
      return {
        text,
        model: message.model,
        usage: { inputTokens, outputTokens: message.usage.output_tokens },
      };
    },
  };
}

/**
 * Any server that speaks the OpenAI chat-completions protocol: a local Ollama server, OpenAI,
 * or another compatible endpoint. Plain HTTP, no SDK.
 */
function chatCompletionsProvider(
  env: ServerEnv,
  price: Price,
  baseUrl: string,
): LanguageModelProvider {
  const model = env.AI_MODEL!;
  return {
    id: `${env.AI_PROVIDER}:${model}`,
    estimateCost: (request) => estimate(price, request),
    async generate(request, signal): Promise<GenerateTextResult> {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(env.AI_API_KEY ? { Authorization: `Bearer ${env.AI_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.jsonSchema
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: { name: "output", schema: request.jsonSchema },
                },
              }
            : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(`Language model request failed (${res.status}).`);
      }
      const data = (await res.json()) as {
        model?: string;
        choices?: {
          message?: { content?: string; refusal?: string | null };
          finish_reason?: string;
        }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const choice = data.choices?.[0];
      if (choice?.message?.refusal)
        throw new ModelRefusalError(`The model declined: ${choice.message.refusal}`);
      if (choice?.finish_reason === "length") {
        throw new Error(
          "The model ran out of output tokens before finishing; the draft is incomplete.",
        );
      }
      return {
        text: choice?.message?.content ?? "",
        model: data.model ?? model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

export interface ConfiguredModel {
  provider: LanguageModelProvider;
  price: Price;
}

/**
 * The configured language model. Throws ProviderUnavailableError (with the reason) when none is
 * configured, so callers never fall back to anything that pretends to generate text.
 */
export function getLanguageModel(env: ServerEnv = getServerEnv().env): ConfiguredModel {
  if (env.AI_PROVIDER === "none") {
    throw new ProviderUnavailableError(
      "llm",
      "No language model is configured (AI_PROVIDER=none).",
    );
  }
  if (!env.AI_MODEL) throw new ProviderUnavailableError("llm", "AI_MODEL is not set.");
  const price = priceFor(env);
  if (!price) {
    throw new ProviderUnavailableError(
      "llm",
      `No price is known for ${env.AI_MODEL}; set AI_INPUT_USD_PER_MTOK and AI_OUTPUT_USD_PER_MTOK so costs can be estimated before spending.`,
    );
  }
  switch (env.AI_PROVIDER) {
    case "anthropic":
      if (!env.AI_API_KEY) throw new ProviderUnavailableError("llm", "AI_API_KEY is not set.");
      return { provider: anthropicProvider(env, price), price };
    case "ollama":
      return {
        provider: chatCompletionsProvider(
          env,
          price,
          env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1",
        ),
        price,
      };
    case "openai":
      if (!env.AI_API_KEY) throw new ProviderUnavailableError("llm", "AI_API_KEY is not set.");
      return {
        provider: chatCompletionsProvider(
          env,
          price,
          env.AI_BASE_URL ?? "https://api.openai.com/v1",
        ),
        price,
      };
    case "openai-compatible":
      if (!env.AI_BASE_URL) throw new ProviderUnavailableError("llm", "AI_BASE_URL is not set.");
      return { provider: chatCompletionsProvider(env, price, env.AI_BASE_URL), price };
    case "gemini":
      throw new ProviderUnavailableError(
        "llm",
        "There is no native Gemini adapter yet. Use AI_PROVIDER=openai-compatible with Gemini's OpenAI-compatible endpoint.",
      );
  }
}
