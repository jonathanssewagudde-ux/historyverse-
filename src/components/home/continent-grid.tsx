import { ArrowUpRight } from "lucide-react";

import { NavLink } from "@/components/site/nav-link";
import type { continents } from "@/content/homepage";

export function ContinentGrid({ items }: { items: typeof continents }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c, i) => (
        <li
          key={c.name}
          className={i === 0 ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : undefined}
        >
          <NavLink
            item={{
              title: c.name,
              href: `/explore?continent=${encodeURIComponent(c.name)}`,
              milestone: 6,
            }}
            className="group flex h-full min-h-32 flex-col justify-between gap-6 rounded-xl border bg-card p-5 transition-colors hover:border-gold/50"
          >
            <span className="flex items-start justify-between">
              <span className="font-serif text-2xl font-semibold">{c.name}</span>
              <ArrowUpRight className="size-4 text-gold opacity-60" aria-hidden />
            </span>
            <span className="text-sm text-muted-foreground">{c.examples}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
