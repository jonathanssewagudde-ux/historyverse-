import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/server/env";
import { getImageModel, openAiSize, stabilityAspect } from "./images";

const env = (raw: Record<string, string>) => parseServerEnv(raw).env;

describe("image generation adapters", () => {
  it("maps requested sizes to what each API accepts", () => {
    expect(openAiSize(1536, 1024)).toBe("1536x1024");
    expect(openAiSize(1024, 1536)).toBe("1024x1536");
    expect(openAiSize(1000, 1000)).toBe("1024x1024");
    expect(stabilityAspect(1920, 1080)).toBe("16:9");
    expect(stabilityAspect(1536, 1024)).toBe("3:2");
    expect(stabilityAspect(800, 1000)).toBe("4:5");
  });

  it("refuses to work without a price, so nothing is generated at an unknown cost", () => {
    expect(() => getImageModel(env({}))).toThrow(/No image generator is configured/);
    expect(() =>
      getImageModel(env({ IMAGE_PROVIDER: "openai", IMAGE_API_KEY: "k", IMAGE_MODEL: "m" })),
    ).toThrow(/IMAGE_USD_PER_IMAGE is not set/);
    expect(() =>
      getImageModel(env({ IMAGE_PROVIDER: "comfyui", IMAGE_USD_PER_IMAGE: "0" })),
    ).toThrow(/not built yet/);
  });

  it("estimates cost per image before anything runs", () => {
    const { provider } = getImageModel(
      env({
        IMAGE_PROVIDER: "openai",
        IMAGE_API_KEY: "k",
        IMAGE_MODEL: "m",
        IMAGE_USD_PER_IMAGE: "0.04",
      }),
    );
    expect(
      provider.estimateCost({ prompt: "p", width: 1536, height: 1024, variations: 3 }),
    ).toMatchObject({
      amount: 0.12,
    });
    const local = getImageModel(
      env({
        IMAGE_PROVIDER: "openai-compatible",
        IMAGE_BASE_URL: "http://127.0.0.1:7860/v1",
        IMAGE_MODEL: "sd",
        IMAGE_USD_PER_IMAGE: "0",
      }),
    );
    expect(local.provider.estimateCost({ prompt: "p", width: 1, height: 1 }).amount).toBe(0);
  });
});
