import type { Metadata } from "next";
import { Suspense } from "react";

import {
  SearchFilters,
  SearchResults,
  toSearchInput,
  type RawParams,
} from "@/components/search/search-view";
import { cachedSearch } from "@/server/search/public";

export const metadata: Metadata = {
  title: "Explore",
  description: "Browse published HISTORYVERSE articles by type, era and continent.",
};

export default function ExplorePage({ searchParams }: PageProps<"/explore">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
        <span aria-hidden>🧭</span> explore
      </p>
      <h1 className="text-4xl font-extrabold sm:text-5xl">Explore</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Browse every published article by type, era and continent. Era boundaries are approximate
        conventions.
      </p>
      <Suspense
        fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
      >
        <ExploreContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ExploreContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  // Explore is browsing only: any text query belongs on /search.
  const input = { ...toSearchInput(await searchParams), q: "" };
  const result = await cachedSearch(input);
  return (
    <div className="mt-8 space-y-8">
      <SearchFilters base="/explore" input={input} result={result} />
      <SearchResults base="/explore" input={input} result={result} />
    </div>
  );
}
