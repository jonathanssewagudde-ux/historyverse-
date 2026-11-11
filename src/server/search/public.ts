import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { tags } from "@/server/content/public";
import { getDb } from "@/server/db/client";
import {
  searchArticles,
  suggest,
  type SearchInput,
  type SearchOutput,
  type Suggestion,
} from "./search";

/** Cached per distinct query; publishing or unpublishing anything refreshes all results. */
export async function cachedSearch(input: SearchInput): Promise<SearchOutput> {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return searchArticles(getDb(), input);
}

export async function cachedSuggest(q: string): Promise<Suggestion[]> {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return suggest(getDb(), q);
}
