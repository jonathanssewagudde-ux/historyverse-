import { connection } from "next/server";

import { clientKey, createRateLimiter } from "@/server/rate-limit";
import { cachedSuggest } from "@/server/search/public";

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** Autocomplete for the search box: published articles only, at most six suggestions. */
export async function GET(request: Request) {
  await connection();
  const limit = limiter.check(clientKey(request.headers));
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2 || q.length > 80) return Response.json({ suggestions: [] });
  try {
    const suggestions = await cachedSuggest(q.trim().toLowerCase());
    return Response.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    // Search must never take the page down: no suggestions rather than an error.
    return Response.json(
      { suggestions: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
