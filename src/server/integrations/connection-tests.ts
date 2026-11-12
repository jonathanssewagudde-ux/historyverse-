import "server-only";

import { access } from "node:fs/promises";

import { getServerEnv } from "@/server/env";
import { checkDatabase } from "@/server/db/health";
import { getDb } from "@/server/db/client";
import { createSourceHttpClient } from "@/server/sources/http";
import { createCommonsClient } from "@/server/sources/commons/client";
import { createWikidataClient } from "@/server/sources/wikidata/client";
import { createWikipediaClient } from "@/server/sources/wikipedia/client";
import { getSpeech } from "@/server/ai/speech";
import { pingQueue } from "@/server/jobs/queue";
import { getStorage } from "@/server/storage";
import { runTool } from "@/server/video/ffmpeg";

export interface ConnectionTestResult {
  id: string;
  status: "connected" | "connection_failed" | "not_testable";
  detail: string;
  latencyMs: number | null;
  testedAt: string;
}

/** Errors can carry URLs with credentials or internal hosts; keep a short, safe summary. */
function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  const status = /\b([45]\d\d)\b/.exec(error.message)?.[1];
  const code = (error as { code?: string }).code;
  if (status) return `HTTP ${status}`;
  if (code) return `${error.name} (${code})`;
  return error.message.replace(/https?:\/\/\S+/g, "<url>").slice(0, 160);
}

function wikimediaHttp() {
  const userAgent = getServerEnv().env.WIKIMEDIA_USER_AGENT;
  if (!userAgent) throw new Error("WIKIMEDIA_USER_AGENT is not configured.");
  return createSourceHttpClient({ userAgent, minIntervalMs: 0, maxRetries: 0, maxBackoffMs: 0 });
}

/**
 * Real, free, read-only round-trips. Each test makes the smallest request that proves the
 * integration works end to end; none of them writes outside a throwaway storage probe or spends
 * money.
 */
const TESTS: Record<string, () => Promise<string>> = {
  async postgres() {
    const health = await checkDatabase();
    if (health.status !== "up")
      throw new Error(health.status === "down" ? health.error : "not configured");
    const ext = await getDb().$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm', 'unaccent') ORDER BY 1`;
    return `Query succeeded; extensions: ${ext.map((e) => e.extname).join(", ") || "none"}.`;
  },
  async auth() {
    if (!getServerEnv().env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
    const sessions = await getDb().session.count({ where: { expiresAt: { gt: new Date() } } });
    return `Session store reachable; ${sessions} active session(s).`;
  },
  async storage() {
    const storage = getStorage();
    const key = `probe/connection-test-${process.pid}.txt`;
    const body = new TextEncoder().encode("historyverse storage probe");
    await storage.put(key, body, "text/plain");
    const back = await storage.get(key);
    await storage.delete(key);
    if (!back || back.byteLength !== body.byteLength) throw new Error("Read-back did not match.");
    return `Wrote, read back and deleted a probe file (${storage.id} driver).`;
  },
  async tts() {
    const { provider, voiceId } = getSpeech();
    // Only free local engines are exercised; a paid voice is never charged for a test.
    if (provider.estimateCost({ text: "test", voiceId, language: "en" }).amount > 0) {
      throw new Error(
        "Paid voices are not tested here, to avoid charges. Narrate a scene instead.",
      );
    }
    const audio = await provider.synthesize({
      text: "HISTORYVERSE narration test.",
      voiceId,
      language: "en",
    });
    return `${provider.id} spoke a test phrase (${(audio.durationMs / 1000).toFixed(1)} s of audio).`;
  },
  async ffmpeg() {
    const { env } = getServerEnv();
    const version =
      (await runTool(env.FFMPEG_PATH, ["-hide_banner", "-version"], 30_000)).split("\n")[0] ?? "";
    const filters = await runTool(env.FFMPEG_PATH, ["-hide_banner", "-filters"], 30_000);
    const missing = ["zoompan", "drawtext", "subtitles", "loudnorm"].filter(
      (f) => !new RegExp(`\\s${f}\\s`).test(filters),
    );
    if (missing.length > 0) throw new Error(`FFmpeg lacks filters: ${missing.join(", ")}.`);
    await access(env.VIDEO_FONT_PATH).catch(() => {
      throw new Error(`The video font is missing (${env.VIDEO_FONT_PATH}).`);
    });
    return `${version.replace(/ Copyright.*/, "")}; camera moves, text, captions and loudness available.`;
  },
  async redis() {
    const counts = await pingQueue();
    return `Queue reachable: ${counts.waiting} waiting, ${counts.active} running, ${counts.failed} failed.`;
  },
  async wikidata() {
    const entity = await createWikidataClient(wikimediaHttp()).getEntity("Q1036");
    return `Fetched Q1036 (${entity.labels?.en?.value ?? "no English label"}).`;
  },
  async wikipedia() {
    const summary = await createWikipediaClient(wikimediaHttp()).getSummary("Uganda");
    return `Fetched the summary of “${summary.title}”.`;
  },
  async "wikimedia-commons"() {
    const files = await createCommonsClient(wikimediaHttp()).getFiles(["File:Flag of Uganda.svg"]);
    if (files.length === 0) throw new Error("No file metadata returned.");
    return `Fetched licence metadata for ${files[0]!.title} (${files[0]!.license.name}).`;
  },
};

export const TESTABLE_INTEGRATIONS = Object.keys(TESTS);

export async function testIntegration(id: string): Promise<ConnectionTestResult> {
  const testedAt = new Date().toISOString();
  const test = TESTS[id];
  if (!test) {
    return {
      id,
      status: "not_testable",
      detail: "No adapter exists for this integration yet, so there is nothing to test.",
      latencyMs: null,
      testedAt,
    };
  }
  const started = performance.now();
  try {
    const detail = await test();
    return {
      id,
      status: "connected",
      detail,
      latencyMs: Math.round(performance.now() - started),
      testedAt,
    };
  } catch (error) {
    return {
      id,
      status: "connection_failed",
      detail: safeError(error),
      latencyMs: Math.round(performance.now() - started),
      testedAt,
    };
  }
}
