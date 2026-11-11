import "server-only";

/**
 * Small in-memory fixed-window rate limiter for cheap public endpoints (e.g. autocomplete).
 * Per process only: with several app instances each enforces its own limit. Distributed limits
 * (Redis) arrive with the job infrastructure in Milestone 8.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = 0;

  return {
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
      if (now - lastSweep > windowMs) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        lastSweep = now;
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      entry.count += 1;
      return entry.count <= limit
        ? { allowed: true, retryAfterSeconds: 0 }
        : { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    },
  };
}

/** Best-effort client key. Only trust X-Forwarded-For behind a proxy you control. */
export function clientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local"
  );
}
