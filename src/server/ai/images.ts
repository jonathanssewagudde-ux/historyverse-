import "server-only";

import { getServerEnv, type ServerEnv } from "@/server/env";
import {
  ProviderUnavailableError,
  type CostEstimate,
  type GenerateImageRequest,
  type ImageGenerationProvider,
} from "@/server/providers/contracts";

/** OpenAI-style image APIs accept a fixed set of sizes; pick the one matching the aspect ratio. */
export function openAiSize(width: number, height: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024";
  if (ratio < 0.83) return "1024x1536";
  return "1024x1024";
}

/** Stability's aspect-ratio parameter, nearest to the requested size. */
export function stabilityAspect(width: number, height: number): string {
  const options: [string, number][] = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["4:5", 4 / 5],
    ["5:4", 5 / 4],
  ];
  const ratio = width / height;
  return options.reduce((best, o) =>
    Math.abs(o[1] - ratio) < Math.abs(best[1] - ratio) ? o : best,
  )[0];
}

function estimate(perImage: number, request: GenerateImageRequest): CostEstimate {
  const n = request.variations ?? 1;
  return {
    currency: "USD",
    amount: Number((perImage * n).toFixed(4)),
    basis: `${n} image${n === 1 ? "" : "s"} at $${perImage} each (IMAGE_USD_PER_IMAGE).`,
  };
}

/** OpenAI's Images API, or any server implementing it (`openai-compatible`). */
function openAiImages(env: ServerEnv, perImage: number, baseUrl: string): ImageGenerationProvider {
  const model = env.IMAGE_MODEL!;
  return {
    id: `${env.IMAGE_PROVIDER}:${model}`,
    estimateCost: (request) => estimate(perImage, request),
    async generate(request, signal) {
      // This API has no negative prompt; state the exclusions in the prompt itself.
      const prompt = request.negativePrompt
        ? `${request.prompt}\n\nDo not include: ${request.negativePrompt}`
        : request.prompt;
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(env.IMAGE_API_KEY ? { Authorization: `Bearer ${env.IMAGE_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model,
          prompt,
          n: request.variations ?? 1,
          size: openAiSize(request.width, request.height),
          ...(env.IMAGE_PROVIDER === "openai-compatible" ? { response_format: "b64_json" } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Image generation failed (${res.status}).`);
      const data = (await res.json()) as { data?: { b64_json?: string }[] };
      const images = (data.data ?? []).filter((d) => d.b64_json);
      if (images.length === 0) throw new Error("The image service returned no images.");
      return images.map((d) => ({
        image: new Uint8Array(Buffer.from(d.b64_json!, "base64")),
        mimeType: "image/png",
      }));
    },
  };
}

/** Stability AI's Stable Image API (one image per request). */
function stabilityImages(env: ServerEnv, perImage: number): ImageGenerationProvider {
  const endpoint = `https://api.stability.ai/v2beta/stable-image/generate/${env.IMAGE_MODEL ?? "core"}`;
  return {
    id: `stability:${env.IMAGE_MODEL ?? "core"}`,
    estimateCost: (request) => estimate(perImage, request),
    async generate(request, signal) {
      const out: { image: Uint8Array; mimeType: string }[] = [];
      for (let i = 0; i < (request.variations ?? 1); i++) {
        const form = new FormData();
        form.set("prompt", request.prompt);
        if (request.negativePrompt) form.set("negative_prompt", request.negativePrompt);
        form.set("aspect_ratio", stabilityAspect(request.width, request.height));
        form.set("output_format", "png");
        const res = await fetch(endpoint, {
          method: "POST",
          signal,
          headers: { Authorization: `Bearer ${env.IMAGE_API_KEY}`, Accept: "image/*" },
          body: form,
        });
        if (!res.ok) throw new Error(`Image generation failed (${res.status}).`);
        out.push({ image: new Uint8Array(await res.arrayBuffer()), mimeType: "image/png" });
      }
      return out;
    },
  };
}

export interface ConfiguredImageModel {
  provider: ImageGenerationProvider;
  perImageUsd: number;
}

/** The configured image generator, or ProviderUnavailableError explaining what is missing. */
export function getImageModel(env: ServerEnv = getServerEnv().env): ConfiguredImageModel {
  if (env.IMAGE_PROVIDER === "none") {
    throw new ProviderUnavailableError(
      "image-generation",
      "No image generator is configured (IMAGE_PROVIDER=none).",
    );
  }
  if (env.IMAGE_USD_PER_IMAGE === undefined) {
    throw new ProviderUnavailableError(
      "image-generation",
      "IMAGE_USD_PER_IMAGE is not set, so the cost of images cannot be estimated before generating them.",
    );
  }
  const perImageUsd = env.IMAGE_USD_PER_IMAGE;
  switch (env.IMAGE_PROVIDER) {
    case "openai":
      if (!env.IMAGE_API_KEY || !env.IMAGE_MODEL) {
        throw new ProviderUnavailableError(
          "image-generation",
          "IMAGE_API_KEY and IMAGE_MODEL are required.",
        );
      }
      return {
        provider: openAiImages(env, perImageUsd, env.IMAGE_BASE_URL ?? "https://api.openai.com/v1"),
        perImageUsd,
      };
    case "openai-compatible":
      if (!env.IMAGE_BASE_URL || !env.IMAGE_MODEL) {
        throw new ProviderUnavailableError(
          "image-generation",
          "IMAGE_BASE_URL and IMAGE_MODEL are required.",
        );
      }
      return { provider: openAiImages(env, perImageUsd, env.IMAGE_BASE_URL), perImageUsd };
    case "stability":
      if (!env.IMAGE_API_KEY)
        throw new ProviderUnavailableError("image-generation", "IMAGE_API_KEY is required.");
      return { provider: stabilityImages(env, perImageUsd), perImageUsd };
    case "gemini":
    case "comfyui":
      throw new ProviderUnavailableError(
        "image-generation",
        `The ${env.IMAGE_PROVIDER} adapter is not built yet. Use openai, openai-compatible or stability, or upload a reconstruction made elsewhere.`,
      );
  }
}
