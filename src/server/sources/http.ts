import "server-only";

import { createLogger } from "@/server/logger";

const log = createLogger("sources.http");

export class SourceRequestError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SourceRequestError";
  }
}

export interface SourceHttpOptions {
  /** Descriptive User-Agent with contact details (required by Wikimedia policy). */
  userAgent: string;
  /** Minimum gap between requests to the same host. */
  minIntervalMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** Upper bound on how long a single Retry-After / backoff wait may be. */
  maxBackoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface SourceHttpClient {
  getJson<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T>;
  /** Binary download (images, audio). Same pacing, retry and failure rules as getJson. */
  getBytes(
    url: string,
    init?: { headers?: Record<string, string>; maxBytes?: number },
  ): Promise<{ body: Uint8Array; contentType: string; finalUrl: string }>;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Seconds or HTTP-date → milliseconds. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * Polite HTTP client for archive and knowledge-base APIs:
 *  - one request at a time per host, spaced by `minIntervalMs`;
 *  - retries transient failures with exponential backoff, honouring `Retry-After`;
 *  - identifies itself with a descriptive User-Agent;
 *  - never fabricates a response: when retries are exhausted it throws.
 */
export function createSourceHttpClient(options: SourceHttpOptions): SourceHttpClient {
  const {
    userAgent,
    minIntervalMs = 1000,
    maxRetries = 4,
    timeoutMs = 30_000,
    maxBackoffMs = 60_000,
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
  } = options;

  if (!userAgent.trim())
    throw new Error("A descriptive User-Agent is required for source requests.");

  const queues = new Map<string, Promise<unknown>>();
  const lastRequestAt = new Map<string, number>();

  async function attempt<T>(
    url: string,
    host: string,
    headers: Record<string, string>,
    read: (response: Response) => Promise<T>,
  ): Promise<T> {
    for (let tryNumber = 0; ; tryNumber++) {
      const wait = (lastRequestAt.get(host) ?? -Infinity) + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastRequestAt.set(host, now());

      let response: Response | undefined;
      let failure: string | undefined;
      try {
        response = await fetchImpl(url, {
          headers: { "User-Agent": userAgent, ...headers },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        failure = error instanceof Error ? error.name : "network error";
      }

      if (response?.ok) return read(response);

      const status = response?.status;
      const retryable = response ? RETRYABLE.has(response.status) : true;
      if (!retryable || tryNumber >= maxRetries) {
        throw new SourceRequestError(
          `Request to ${host} failed (${status ?? failure}) after ${tryNumber + 1} attempt(s).`,
          url,
          status,
        );
      }

      const retryAfter = parseRetryAfter(response?.headers.get("retry-after") ?? null, now());
      const backoff = Math.min(maxBackoffMs, retryAfter ?? minIntervalMs * 2 ** (tryNumber + 1));
      log.warn("retrying source request", {
        host,
        status: status ?? failure,
        waitMs: backoff,
        try: tryNumber + 1,
      });
      await sleep(backoff);
    }
  }

  function enqueue<T>(url: string, run: (host: string) => Promise<T>): Promise<T> {
    const host = new URL(url).host;
    const previous = queues.get(host) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => run(host));
    queues.set(host, next);
    return next;
  }

  return {
    getJson<T>(url: string, init?: { headers?: Record<string, string> }) {
      return enqueue(url, (host) =>
        attempt(
          url,
          host,
          { Accept: "application/json", ...init?.headers },
          async (r) => (await r.json()) as T,
        ),
      );
    },
    getBytes(url, init) {
      const maxBytes = init?.maxBytes ?? 25 * 1024 * 1024;
      return enqueue(url, (host) =>
        attempt(url, host, { Accept: "*/*", ...init?.headers }, async (r) => {
          const tooBig = () =>
            new SourceRequestError(`File larger than ${maxBytes} bytes`, url, r.status);
          if (Number(r.headers.get("content-length") ?? 0) > maxBytes) throw tooBig();
          const body = new Uint8Array(await r.arrayBuffer());
          if (body.byteLength > maxBytes) throw tooBig();
          return {
            body,
            contentType: r.headers.get("content-type") ?? "application/octet-stream",
            finalUrl: r.url || url,
          };
        }),
      );
    },
  };
}
