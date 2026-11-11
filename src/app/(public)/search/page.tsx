import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchCombobox } from "@/components/search/search-combobox";
import {
  SearchFilters,
  SearchResults,
  toSearchInput,
  type RawParams,
} from "@/components/search/search-view";
import { cachedSearch } from "@/server/search/public";

export const metadata: Metadata = {
  title: "Search",
  description: "Search sourced, editor-reviewed articles on HISTORYVERSE.",
  // Result pages are endless variations of one page; keep them out of search engines.
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
        <span aria-hidden>🔎</span> search
      </p>
      <h1 className="text-4xl font-extrabold sm:text-5xl">Search history</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Ask in your own words: a name, a place, a question, or a year (&ldquo;What happened in
        1962?&rdquo;). Results come only from published articles.
      </p>
      <Suspense
        fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
      >
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  const input = toSearchInput(await searchParams);
  const result = await cachedSearch(input);
  const keep = Object.fromEntries(
    Object.entries({
      type: input.type,
      era: input.era,
      continent: input.continent?.toLowerCase().replace(/_/g, "-"),
    }).filter((e): e is [string, string] => Boolean(e[1])),
  );
  return (
    <div className="mt-8 space-y-8">
      <SearchCombobox size="page" defaultValue={input.q} hiddenFields={keep} />
      <SearchFilters base="/search" input={input} result={result} />
      <SearchResults base="/search" input={input} result={result} />
    </div>
  );
}
