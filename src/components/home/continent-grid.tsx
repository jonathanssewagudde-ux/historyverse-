import { ArrowUpRight } from "lucide-react";

import { NavLink } from "@/components/site/nav-link";
import type { continents } from "@/content/homepage";
import { cn } from "@/lib/utils";

const emoji: Record<string, string> = {
  Africa: "🌍",
  Asia: "🌏",
  Europe: "🌍",
  "North America": "🌎",
  "South America": "🌎",
  Oceania: "🌏",
  Antarctica: "🧊",
};

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
            className={cn(
              "group flex h-full min-h-36 flex-col justify-between gap-6 rounded-3xl border p-5 transition duration-300 hover:-translate-y-1",
              i === 0
                ? "bg-gradient-to-br from-primary to-pink text-[oklch(0.99_0_0)]"
                : "bg-card hover:border-primary/60",
            )}
          >
            <span className="flex items-start justify-between">
              <span aria-hidden className="text-3xl">
                {emoji[c.name]}
              </span>
              <ArrowUpRight className="size-5 opacity-70" aria-hidden />
            </span>
            <span>
              <span className="block font-display text-2xl font-extrabold">{c.name}</span>
              <span
                className={cn(
                  "mt-1 block text-sm",
                  i === 0 ? "opacity-90" : "text-muted-foreground",
                )}
              >
                {c.examples}
              </span>
            </span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
