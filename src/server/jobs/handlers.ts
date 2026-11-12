import "server-only";

import { getImageModel } from "@/server/ai/images";
import { getLanguageModel } from "@/server/ai/providers";
import { getServerEnv } from "@/server/env";
import { createMediaSearchHandler } from "@/server/media/discovery";
import { createImageGenerationHandler } from "@/server/media/reconstructions";
import { createDraftHandler } from "@/server/research/draft-job";
import { createResearchHandler } from "@/server/research/research-job";
import { createWikimediaSources } from "@/server/sources";
import { createSourceHttpClient } from "@/server/sources/http";
import { getStorage } from "@/server/storage";
import type { JobHandlers } from "./types";

/** The handlers a worker runs, wired to the live (free) sources and the configured model. */
export function createJobHandlers(): JobHandlers {
  const { env } = getServerEnv();
  const wikimedia = createWikimediaSources();
  const http = createSourceHttpClient({
    userAgent: env.WIKIMEDIA_USER_AGENT!,
    minIntervalMs: 1500,
    maxRetries: 6,
    maxBackoffMs: 90_000,
  });
  return {
    RESEARCH: createResearchHandler({
      http,
      wikidata: wikimedia.wikidata,
      commons: wikimedia.commons,
      locEnabled: env.LOC_ENABLED,
    }),
    ARTICLE_DRAFT: createDraftHandler(() => getLanguageModel()),
    MEDIA_SEARCH: createMediaSearchHandler({
      commons: wikimedia.commons,
      http,
      locEnabled: env.LOC_ENABLED,
    }),
    IMAGE_GENERATION: createImageGenerationHandler(() => getImageModel(), getStorage),
  };
}
