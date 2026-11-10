import { describe, expect, it, vi } from "vitest";
import { createSourceHttpClient, parseRetryAfter, SourceRequestError } from "./http";

function harness(
  responses: Array<Response | Error>,
  opts: { minIntervalMs?: number; maxRetries?: number } = {},
) {
  let clock = 0;
  const sleeps: number[] = [];
  const calls: { url: string; at: number; ua: string | null }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), at: clock, ua: new Headers(init?.headers).get("user-agent") });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const client = createSourceHttpClient({
    userAgent: "HISTORYVERSE-test/1.0 (test@example.invalid)",
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...opts,
  });
  return { client, sleeps, calls };
}

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("22", 0)).toBe(22_000);
    expect(
      parseRetryAfter("Wed, 21 Oct 2026 07:28:10 GMT", Date.parse("2026-10-21T07:28:00Z")),
    ).toBe(10_000);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});

describe("source HTTP client", () => {
  it("sends the descriptive User-Agent and returns JSON", async () => {
    const { client, calls } = harness([json({ ok: true })]);
    await expect(client.getJson("https://example.org/a")).resolves.toEqual({ ok: true });
    expect(calls[0]!.ua).toBe("HISTORYVERSE-test/1.0 (test@example.invalid)");
  });

  it("refuses to run without a User-Agent", () => {
    expect(() => createSourceHttpClient({ userAgent: "  " })).toThrow(/User-Agent/);
  });

  it("honours Retry-After on 429 and then succeeds", async () => {
    const { client, sleeps, calls } = harness([
      new Response("slow down", { status: 429, headers: { "retry-after": "22" } }),
      json({ id: "Q1036" }),
    ]);
    await expect(client.getJson("https://example.org/a")).resolves.toEqual({ id: "Q1036" });
    expect(sleeps).toContain(22_000);
    expect(calls).toHaveLength(2);
  });

  it("backs off exponentially on server errors and network failures", async () => {
    const { client, sleeps } = harness(
      [new Response("", { status: 503 }), new Error("ECONNRESET"), json({ ok: 1 })],
      { minIntervalMs: 100 },
    );
    await client.getJson("https://example.org/a");
    expect(sleeps.filter((s) => s >= 200)).toEqual([200, 400]);
  });

  it("gives up after the retry budget and never invents a response", async () => {
    const { client, calls } = harness(
      [
        new Response("", { status: 503 }),
        new Response("", { status: 503 }),
        new Response("", { status: 503 }),
      ],
      { maxRetries: 2, minIntervalMs: 1 },
    );
    const error = await client.getJson("https://example.org/a").catch((e: SourceRequestError) => e);
    expect(error).toBeInstanceOf(SourceRequestError);
    expect(error).toMatchObject({ status: 503 });
    expect(calls).toHaveLength(3);
  });

  it("does not retry client errors such as 404", async () => {
    const { client, calls } = harness([new Response("", { status: 404 })]);
    await expect(client.getJson("https://example.org/missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(calls).toHaveLength(1);
  });

  it("spaces requests to the same host but not across hosts", async () => {
    const { client, calls } = harness([json(1), json(2), json(3)], { minIntervalMs: 1000 });
    await Promise.all([
      client.getJson("https://a.example/1"),
      client.getJson("https://a.example/2"),
      client.getJson("https://b.example/1"),
    ]);
    const a = calls.filter((c) => c.url.includes("a.example")).map((c) => c.at);
    expect(a[1]! - a[0]!).toBeGreaterThanOrEqual(1000);
  });
});
