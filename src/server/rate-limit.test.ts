import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then refuses with a retry time", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 1).allowed).toBe(true);
    expect(limiter.check("a", 2)).toEqual({ allowed: false, retryAfterSeconds: 10 });
    expect(limiter.check("b", 2).allowed).toBe(true);
    expect(limiter.check("a", 10_001).allowed).toBe(true);
  });

  it("reads the client address from proxy headers", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe(
      "203.0.113.5",
    );
    expect(clientKey(new Headers())).toBe("local");
  });
});
