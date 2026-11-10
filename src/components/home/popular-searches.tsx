import { Search } from "lucide-react";

import { NavLink } from "@/components/site/nav-link";

export function PopularSearches({ searches }: { searches: string[] }) {
  return (
    <div>
      <ul className="flex flex-wrap gap-2.5">
        {searches.map((q) => (
          <li key={q}>
            <NavLink
              item={{ title: q, href: `/search?q=${encodeURIComponent(q)}`, milestone: 6 }}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary"
            >
              <Search className="size-3.5 text-primary" aria-hidden />
              {q}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-xs text-muted-foreground">
        These are suggested starting points. Once search launches, this list will be ranked by real
        search activity.
      </p>
    </div>
  );
}
