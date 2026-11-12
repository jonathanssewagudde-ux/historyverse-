import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseWav, pcmToWav } from "@/server/audio/audio";
import { getServerEnv, type ServerEnv } from "@/server/env";
import {
  ProviderUnavailableError,
  type CostEstimate,
  type SpeechProvider,
  type SynthesizeSpeechRequest,
  type Voice,
} from "@/server/providers/contracts";

/** Run a local program with text on stdin; resolves when it exits successfully. */
function run(command: string, args: string[], input: string, timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${path.basename(command)} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new ProviderUnavailableError("tts", `${command} is not installed.`)
          : error,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else
        reject(new Error(`${path.basename(command)} exited with ${code}: ${stderr.slice(0, 200)}`));
    });
    child.stdin.end(input);
  });
}

async function withTempWav<T>(fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "hv-tts-"));
  try {
    return await fn(path.join(dir, "out.wav"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function wavResult(body: Uint8Array) {
  const info = parseWav(body);
  if (!info) throw new Error("The speech engine did not produce a WAV file.");
  return { audio: body, mimeType: "audio/wav", durationMs: info.durationMs };
}

const free = (): CostEstimate => ({
  currency: "USD",
  amount: 0,
  basis: "Local speech engine (no charge).",
});

/** eSpeak NG: free, local, robotic but intelligible; good for drafts and timing. */
function espeakProvider(env: ServerEnv): SpeechProvider {
  return {
    id: "espeak",
    async listVoices(): Promise<Voice[]> {
      const out = await run(env.ESPEAK_PATH, ["--voices=en"], "");
      return out
        .split("\n")
        .slice(1)
        .map((line) => line.trim().split(/\s+/))
        .filter((cols) => cols.length >= 4)
        .map((cols) => ({
          id: cols[1]!,
          name: cols[3]!.replace(/_/g, " "),
          language: cols[1]!,
          synthetic: true as const,
        }));
    },
    estimateCost: free,
    async synthesize(request) {
      const wpm = Math.round(165 * (request.speed ?? 1));
      return withTempWav(async (file) => {
        await run(
          env.ESPEAK_PATH,
          ["-v", request.voiceId || "en-gb", "-s", String(wpm), "-w", file, "--stdin"],
          request.text,
        );
        return wavResult(new Uint8Array(await readFile(file)));
      });
    },
  };
}

/** Piper: free, local neural voices. Each voice model has its own licence (see its model card). */
function piperProvider(env: ServerEnv): SpeechProvider {
  const model = env.PIPER_MODEL!;
  return {
    id: "piper",
    async listVoices() {
      return [
        {
          id: path.basename(model, ".onnx"),
          name: path.basename(model, ".onnx"),
          language: "en",
          synthetic: true,
        },
      ];
    },
    estimateCost: free,
    async synthesize(request) {
      // Piper's length scale is the inverse of speed.
      const lengthScale = (1 / (request.speed ?? 1)).toFixed(2);
      return withTempWav(async (file) => {
        await run(
          env.PIPER_PATH,
          ["-m", model, "-f", file, "--length-scale", lengthScale],
          request.text,
        );
        return wavResult(new Uint8Array(await readFile(file)));
      });
    },
  };
}

function paidEstimate(env: ServerEnv) {
  return (request: SynthesizeSpeechRequest): CostEstimate => {
    const price = env.TTS_USD_PER_MILLION_CHARS!;
    return {
      currency: "USD",
      amount: Number(((request.text.length * price) / 1_000_000).toFixed(4)),
      basis: `${request.text.length.toLocaleString("en")} characters at $${price} per million (TTS_USD_PER_MILLION_CHARS).`,
    };
  };
}

/** OpenAI speech API (stock synthetic voices only). */
function openAiSpeech(env: ServerEnv): SpeechProvider {
  return {
    id: `openai:${env.TTS_MODEL}`,
    async listVoices() {
      return env.TTS_VOICE
        ? [{ id: env.TTS_VOICE, name: env.TTS_VOICE, language: "en", synthetic: true }]
        : [];
    },
    estimateCost: paidEstimate(env),
    async synthesize(request, signal) {
      const res = await fetch(
        `${(env.TTS_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/audio/speech`,
        {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.TTS_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.TTS_MODEL,
            voice: request.voiceId,
            input: request.text,
            speed: request.speed ?? 1,
            response_format: "wav",
          }),
        },
      );
      if (!res.ok) throw new Error(`Speech synthesis failed (${res.status}).`);
      return wavResult(new Uint8Array(await res.arrayBuffer()));
    },
  };
}

/** ElevenLabs (stock voices; raw 22.05 kHz PCM wrapped in WAV here). */
function elevenLabsSpeech(env: ServerEnv): SpeechProvider {
  return {
    id: `elevenlabs:${env.TTS_MODEL ?? "default"}`,
    async listVoices() {
      return env.TTS_VOICE
        ? [{ id: env.TTS_VOICE, name: env.TTS_VOICE, language: "en", synthetic: true }]
        : [];
    },
    estimateCost: paidEstimate(env),
    async synthesize(request, signal) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(request.voiceId)}?output_format=pcm_22050`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "xi-api-key": env.TTS_API_KEY! },
          body: JSON.stringify({
            text: request.text,
            ...(env.TTS_MODEL ? { model_id: env.TTS_MODEL } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error(`Speech synthesis failed (${res.status}).`);
      return wavResult(pcmToWav(new Uint8Array(await res.arrayBuffer()), 22_050));
    },
  };
}

export interface ConfiguredSpeech {
  provider: SpeechProvider;
  voiceId: string;
  /** What is known about the voice's licence; null means nobody has stated it. */
  voiceLicense: string | null;
}

/** The configured narration engine, or ProviderUnavailableError explaining what is missing. */
export function getSpeech(env: ServerEnv = getServerEnv().env): ConfiguredSpeech {
  switch (env.TTS_PROVIDER) {
    case "none":
      throw new ProviderUnavailableError(
        "tts",
        "No narration engine is configured (TTS_PROVIDER=none).",
      );
    case "espeak":
      return {
        provider: espeakProvider(env),
        voiceId: env.TTS_VOICE ?? "en-gb",
        voiceLicense:
          env.TTS_VOICE_LICENSE ??
          "eSpeak NG synthetic voice (formant synthesis; no recorded-voice dataset)",
      };
    case "piper":
      if (!env.PIPER_MODEL)
        throw new ProviderUnavailableError("tts", "PIPER_MODEL (a .onnx voice file) is not set.");
      return {
        provider: piperProvider(env),
        voiceId: path.basename(env.PIPER_MODEL, ".onnx"),
        voiceLicense: env.TTS_VOICE_LICENSE ?? null,
      };
    case "openai":
    case "elevenlabs":
      if (!env.TTS_API_KEY) throw new ProviderUnavailableError("tts", "TTS_API_KEY is not set.");
      if (env.TTS_USD_PER_MILLION_CHARS === undefined) {
        throw new ProviderUnavailableError(
          "tts",
          "TTS_USD_PER_MILLION_CHARS is not set, so the cost of narration cannot be estimated before speaking.",
        );
      }
      if (env.TTS_PROVIDER === "openai" && !env.TTS_MODEL)
        throw new ProviderUnavailableError("tts", "TTS_MODEL is not set.");
      if (env.TTS_PROVIDER === "elevenlabs" && !env.TTS_VOICE)
        throw new ProviderUnavailableError("tts", "TTS_VOICE is not set.");
      return {
        provider: env.TTS_PROVIDER === "openai" ? openAiSpeech(env) : elevenLabsSpeech(env),
        voiceId: env.TTS_VOICE ?? "alloy",
        voiceLicense:
          env.TTS_VOICE_LICENSE ??
          `Stock synthetic voice under the ${env.TTS_PROVIDER} terms of service`,
      };
    case "google":
      throw new ProviderUnavailableError(
        "tts",
        "There is no Google speech adapter yet. Use espeak, piper, openai or elevenlabs.",
      );
  }
}
