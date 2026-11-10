import "server-only";

import { getServerEnv } from "@/server/env";
import { ProviderUnavailableError } from "@/server/providers/contracts";
import { createCommonsClient } from "./commons/client";
import { createSourceHttpClient } from "./http";
import { createWikidataClient } from "./wikidata/client";
import { createWikipediaClient } from "./wikipedia/client";

/**
 * Live Wikimedia clients sharing one polite HTTP client. Requires WIKIMEDIA_USER_AGENT, because
 * Wikimedia's policy asks every automated client to identify itself with contact details.
 */
export function createWikimediaSources() {
  const userAgent = getServerEnv().env.WIKIMEDIA_USER_AGENT;
  if (!userAgent) {
    throw new ProviderUnavailableError(
      "wikidata",
      'WIKIMEDIA_USER_AGENT is not configured. Example: "HISTORYVERSE/0.4 (https://your-site.example/contact)".',
    );
  }
  // The action API (used for Commons) is throttled harder than entity data, so allow long waits.
  const http = createSourceHttpClient({
    userAgent,
    minIntervalMs: 1500,
    maxRetries: 6,
    maxBackoffMs: 90_000,
  });
  return {
    wikidata: createWikidataClient(http),
    wikipedia: createWikipediaClient(http),
    commons: createCommonsClient(http),
  };
}
