import { CalendarClock, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/home/empty-state";
import { worldEras } from "@/lib/history/eras";
import {
  CONTINENTS,
  isSearchType,
  normaliseContinent,
  SEARCH_TYPES,
  type SearchType,
} from "@/lib/search/query";
import { cn } from "@/lib/utils";
import type { SearchInput, SearchOutput } from "@/server/search/search";

export type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Validate untrusted URL parameters into a search request; unknown values are ignored. */
export function toSearchInput(params: RawParams): SearchInput {
  const type = first(params.type);
  const era = first(params.era);
  const page = Number(first(params.page));
  return {
    q: (first(params.q) ?? "").slice(0, 200),
    type: isSearchType(type) ? (type as SearchType) : undefined,
    era: worldEras.some((e) => e.id === era) ? era : undefined,
    continent: normaliseContinent(first(params.continent)) ?? undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function hrefWith(
  base: "/search" | "/explore",
  input: SearchInput,
  change: Partial<SearchInput>,
): Route {
  const next = { ...input, ...change, page: change.page ?? 1 };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.type) params.set("type", next.type);
  if (next.era) params.set("era", next.era);
  if (next.continent) params.set("continent", next.continent.toLowerCase().replace(/_/g, "-"));
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return (qs ? `${base}?${qs}` : base) as Route;
}

function Chip({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
        active ? "border-transparent bg-lime text-lime-foreground" : "bg-card hover:border-primary",
      )}
    >
      {children}
    </Link>
  );
}

export function SearchFilters({
  base,
  input,
  result,
}: {
  base: "/search" | "/explore";
  input: SearchInput;
  result: SearchOutput;
}) {
  const count = (n: number | undefined) => (
    <span className="font-mono text-xs opacity-70">{n ?? 0}</span>
  );
  return (
    <div className="space-y-3">
      <nav
        aria-label="Filter by type"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <Chip href={hrefWith(base, input, { type: undefined })} active={!input.type}>
          All types
        </Chip>
        {(Object.keys(SEARCH_TYPES) as SearchType[]).map((t) => (
          <Chip key={t} href={hrefWith(base, input, { type: t })} active={input.type === t}>
            {SEARCH_TYPES[t].label} {count(result.facets.type[t])}
          </Chip>
        ))}
      </nav>
      <nav
        aria-label="Filter by era"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <Chip href={hrefWith(base, input, { era: undefined })} active={!input.era}>
          All eras
        </Chip>
        {worldEras.map((e) => (
          <Chip key={e.id} href={hrefWith(base, input, { era: e.id })} active={input.era === e.id}>
            {e.name}
          </Chip>
        ))}
      </nav>
      <nav
        aria-label="Filter by continent"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <Chip href={hrefWith(base, input, { continent: undefined })} active={!input.continent}>
          All continents
        </Chip>
        {CONTINENTS.map((c) => (
          <Chip
            key={c.id}
            href={hrefWith(base, input, { continent: c.id })}
            active={input.continent === c.id}
          >
            {c.label} {count(result.facets.continent[c.id])}
          </Chip>
        ))}
      </nav>
    </div>
  );
}

const typeOf: Record<string, string> = {
  KINGDOM: "Kingdom",
  COUNTRY: "Country",
  BIOGRAPHY: "Person",
  MONARCH: "Monarch",
  PRESIDENT: "President",
};

export function SearchResults({
  base,
  input,
  result,
}: {
  base: "/search" | "/explore";
  input: SearchInput;
  result: SearchOutput;
}) {
  const q = result.query;
  const filtered = Boolean(input.type || input.era || input.continent);

  if (result.hits.length === 0) {
    return (
      <div className="space-y-4">
        {result.didYouMean && (
          <p className="text-lg">
            Did you mean{" "}
            <Link
              href={hrefWith(base, input, { q: result.didYouMean })}
              className="font-bold text-primary underline-offset-4 hover:underline"
            >
              {result.didYouMean}
            </Link>
            ?
          </p>
        )}
        <EmptyState
          icon={SearchX}
          title={q ? `No published article matches “${q}”` : "Nothing here yet"}
        >
          HISTORYVERSE searches only articles that have been sourced and approved by an editor, and{" "}
          {result.indexSize === 1 ? "1 article is" : `${result.indexSize} articles are`} published
          so far.
          {filtered && " Try removing a filter."} Coverage grows as new articles are reviewed.
        </EmptyState>
      </div>
    );
  }

  const status =
    result.mode === "year"
      ? `Articles with events in ${result.yearLabel}`
      : result.mode === "fuzzy"
        ? `No exact matches for “${q}”. Showing close matches.`
        : result.mode === "browse"
          ? `${result.total} published ${result.total === 1 ? "article" : "articles"}`
          : `${result.total} ${result.total === 1 ? "result" : "results"} for “${q}”${result.yearLabel ? ` around ${result.yearLabel}` : ""}`;
  const pages = Math.ceil(result.total / result.pageSize);

  return (
    <div className="space-y-6">
      <p role="status" className="text-sm text-muted-foreground">
        {status}
        {result.didYouMean && (
          <>
            {" "}
            Did you mean{" "}
            <Link
              href={hrefWith(base, input, { q: result.didYouMean })}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {result.didYouMean}
            </Link>
            ?
          </>
        )}
      </p>
      <ol className="space-y-3">
        {result.hits.map((hit) => (
          <li key={hit.path}>
            <article className="flex gap-4 rounded-3xl border bg-card p-4 transition hover:border-primary/60 sm:p-5">
              {hit.hero && (
                // eslint-disable-next-line @next/next/no-img-element -- approved media from the permission-checked route
                <img
                  src={hit.hero}
                  alt=""
                  className="hidden size-24 shrink-0 rounded-2xl object-cover sm:block"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    {typeOf[hit.template] ?? "Article"}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {hit.path}
                  </span>
                </div>
                <h2 className="text-xl leading-snug font-bold">
                  <Link
                    href={hit.path as Route}
                    className="underline-offset-4 hover:text-primary hover:underline"
                  >
                    {hit.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hit.snippet.map((part, i) =>
                    part.match ? (
                      <mark key={i} className="rounded bg-lime/80 px-0.5 text-lime-foreground">
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
                {hit.matchedDates.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {hit.matchedDates.map((d) => (
                      <li key={d.label + d.statement} className="flex items-start gap-2 text-sm">
                        <CalendarClock
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                        <span>
                          <strong className="font-mono text-xs text-primary">{d.label}</strong>{" "}
                          {d.statement}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between">
          {result.page > 1 ? (
            <Link
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              href={hrefWith(base, input, { page: result.page - 1 })}
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-xs text-muted-foreground">
            page {result.page} of {pages}
          </span>
          {result.page < pages ? (
            <Link
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              href={hrefWith(base, input, { page: result.page + 1 })}
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      {result.related.length > 0 && base === "/search" && (
        <section aria-labelledby="related-searches" className="rounded-3xl border bg-card p-5">
          <h2 id="related-searches" className="text-lg font-bold">
            Related searches
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {result.related.map((name) => (
              <li key={name}>
                <Link
                  href={hrefWith("/search", {}, { q: name })}
                  className="inline-block rounded-full border px-3 py-1 text-sm hover:border-primary"
                >
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
