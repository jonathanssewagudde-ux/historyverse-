import { Compass, Map } from "lucide-react";

import { Graticule } from "@/components/home/graticule";
import { NavLink } from "@/components/site/nav-link";
import { buttonVariants } from "@/components/ui/button";

const goals = [
  { figure: "193", label: "UN member states" },
  { figure: "+", label: "Observer states, territories and historical states" },
  { figure: "∞", label: "Kingdoms, empires and civilizations, added as they are sourced" },
];

export function ExploreWorld() {
  return (
    <div className="relative isolate grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[3fr_2fr]">
      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-10">
        <p className="text-sm text-muted-foreground">
          The map and country pages will connect every place to its people, events and
          documentaries. These are HISTORYVERSE&apos;s{" "}
          <strong className="text-foreground">coverage goals</strong>, not a count of what has been
          published.
        </p>
        <dl className="grid gap-4 sm:grid-cols-3">
          {goals.map((g) => (
            <div
              key={g.label}
              className="flex flex-col-reverse justify-end border-l border-gold/40 pl-4"
            >
              <dt className="text-sm text-muted-foreground">{g.label}</dt>
              <dd className="font-serif text-4xl font-semibold text-gold">{g.figure}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <NavLink
            item={{ title: "Open the map", href: "/map", milestone: 13 }}
            className={buttonVariants({ variant: "default" })}
          >
            <Map aria-hidden /> Open the map
          </NavLink>
          <NavLink
            item={{ title: "Browse countries", href: "/countries", milestone: 5 }}
            className={buttonVariants({ variant: "outline" })}
          >
            <Compass aria-hidden /> Browse countries
          </NavLink>
        </div>
      </div>
      <div aria-hidden className="relative min-h-64 overflow-hidden lg:min-h-full">
        <Graticule className="absolute top-1/2 left-1/2 w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-80" />
      </div>
    </div>
  );
}
