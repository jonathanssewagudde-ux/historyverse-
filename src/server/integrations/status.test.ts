import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/server/env";
import { integrations } from "./registry";
import { resolveIntegrationStates } from "./status";

const stateOf = (raw: Record<string, string>, id: string) => {
  const state = resolveIntegrationStates(parseServerEnv(raw)).find((s) => s.id === id);
  if (!state) throw new Error(`unknown integration ${id}`);
  return state;
};

describe("integration registry", () => {
  it("has unique ids and declares every env key it checks", () => {
    const ids = integrations.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const { env } = parseServerEnv({});
    for (const def of integrations) {
      for (const key of def.missing(env)) expect(def.envKeys).toContain(key);
      for (const key of def.secretEnvKeys ?? []) expect(def.envKeys).toContain(key);
    }
  });

  it("covers every mandatory capability from the specification", () => {
    const mandatory = integrations.filter((i) => i.classification !== "optional").map((i) => i.id);
    expect(mandatory).toEqual(
      expect.arrayContaining([
        "postgres",
        "auth",
        "storage",
        "redis",
        "ffmpeg",
        "remotion",
        "wikidata",
        "wikipedia",
        "wikimedia-commons",
        "llm",
        "tts",
        "youtube",
      ]),
    );
  });

  it("marks every billable integration as an AI provider", () => {
    for (const def of integrations.filter((i) => i.billable)) expect(def.category).toBe("ai");
  });
});

describe("resolveIntegrationStates", () => {
  it("reports not_configured with the missing variable names", () => {
    const db = stateOf({}, "postgres");
    expect(db.status).toBe("not_configured");
    expect(db.missingEnv).toEqual(["DATABASE_URL"]);
  });

  it("reports configured when requirements are met, but never connected", () => {
    const db = stateOf({ DATABASE_URL: "postgresql://localhost:5432/historyverse" }, "postgres");
    expect(db.status).toBe("configured");
    expect(db.missingEnv).toEqual([]);
  });

  it("only reports integrations as implemented once their milestone has shipped", () => {
    const states = resolveIntegrationStates(parseServerEnv({}));
    const implemented = states.filter((s) => s.implemented).map((s) => s.id);
    expect(implemented.sort()).toEqual([
      "auth",
      "google-signin",
      "llm",
      "postgres",
      "redis",
      "storage",
      "tts",
      "wikidata",
      "wikimedia-commons",
      "wikipedia",
    ]);
    for (const s of states.filter((x) => x.implemented))
      expect(s.milestone).toBeLessThanOrEqual(10);
  });

  it("needs both a secret and a database for authentication", () => {
    expect(stateOf({ AUTH_SECRET: "x".repeat(40) }, "auth").missingEnv).toEqual(["DATABASE_URL"]);
    expect(
      stateOf({ AUTH_SECRET: "x".repeat(40), DATABASE_URL: "postgresql://localhost/db" }, "auth")
        .status,
    ).toBe("configured");
  });

  it("requires credentials for the selected AI provider", () => {
    expect(stateOf({}, "llm").missingEnv).toEqual(["AI_PROVIDER"]);
    expect(stateOf({ AI_PROVIDER: "anthropic" }, "llm").missingEnv).toEqual([
      "AI_API_KEY",
      "AI_MODEL",
    ]);
    expect(stateOf({ AI_PROVIDER: "ollama", AI_MODEL: "llama3.1" }, "llm").status).toBe(
      "configured",
    );
    // A paid model without a known price cannot be used: costs must be estimable first.
    expect(
      stateOf({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "some-model" }, "llm").missingEnv,
    ).toEqual(["AI_INPUT_USD_PER_MTOK", "AI_OUTPUT_USD_PER_MTOK"]);
    expect(
      stateOf({ AI_PROVIDER: "anthropic", AI_API_KEY: "k", AI_MODEL: "claude-opus-5-5" }, "llm")
        .status,
    ).toBe("configured");
  });

  it("allows key-free local TTS engines", () => {
    expect(stateOf({ TTS_PROVIDER: "espeak" }, "tts").status).toBe("configured");
    // Piper needs a voice model file.
    expect(stateOf({ TTS_PROVIDER: "piper" }, "tts").missingEnv).toEqual(["PIPER_MODEL"]);
    expect(stateOf({ TTS_PROVIDER: "piper", PIPER_MODEL: "/voices/v.onnx" }, "tts").status).toBe(
      "configured",
    );
    // Paid speech needs a price before anything is spoken.
    expect(
      stateOf({ TTS_PROVIDER: "openai", TTS_API_KEY: "k", TTS_MODEL: "m" }, "tts").missingEnv,
    ).toEqual(["TTS_USD_PER_MILLION_CHARS"]);
    expect(stateOf({ TTS_PROVIDER: "elevenlabs" }, "tts").status).toBe("not_configured");
  });

  it("switches storage requirements by driver", () => {
    expect(stateOf({}, "storage").status).toBe("configured");
    const s3 = stateOf({ STORAGE_DRIVER: "s3", S3_BUCKET: "media" }, "storage");
    expect(s3.status).toBe("not_configured");
    expect(s3.missingEnv).toEqual(["S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
  });

  it("honours operator-disabled integrations", () => {
    expect(
      stateOf({ INTEGRATIONS_DISABLED: "postgres", DATABASE_URL: "postgres://x/y" }, "postgres")
        .status,
    ).toBe("disabled");
  });

  it("surfaces malformed values as errors without leaking them", () => {
    const db = stateOf({ DATABASE_URL: "mysql://user:hunter2@host/db" }, "postgres");
    expect(db.status).toBe("not_configured");
    expect(db.errors).toHaveLength(1);
    expect(db.errors[0]).toMatch(/^DATABASE_URL:/);
    expect(JSON.stringify(db)).not.toContain("hunter2");
  });
});
