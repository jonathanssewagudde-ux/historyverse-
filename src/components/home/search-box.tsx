import type { Route } from "next";
import Link from "next/link";

import { SearchCombobox } from "@/components/search/search-combobox";

/** Homepage search: the shared search combobox plus a few starting points. */
export function SearchBox({ suggestions }: { suggestions: string[] }) {
  return (
    <div id="search" className="w-full max-w-2xl scroll-mt-28">
      <SearchCombobox size="hero" />
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">try →</span>
        {suggestions.map((s) => (
          <Link
            key={s}
            href={`/search?q=${encodeURIComponent(s)}` as Route}
            className="rounded-full border bg-card/70 px-3.5 py-1.5 text-sm font-medium backdrop-blur transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
          >
            {s}
          </Link>
        ))}
      </div>
    </div>
  );
}
