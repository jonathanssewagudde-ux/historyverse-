import { Compass, Map } from "lucide-react";

import { Graticule } from "@/components/home/graticule";
import { NavLink } from "@/components/site/nav-link";
import { buttonVariants } from "@/components/ui/button";

/** Bento: big globe tile + three coverage-goal tiles. Goals, not counts of published content. */
export function ExploreWorld() {
  return (
    <div className="grid gap-3 lg:grid-cols-4 lg:grid-rows-2">
      <div className="relative isolate flex min-h-80 flex-col justify-between overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 lg:col-span-2 lg:row-span-2">
        <Graticule className="pointer-events-none absolute -right-24 -bottom-24 -z-10 w-[26rem] opacity-80" />
        <p className="max-w-sm text-muted-foreground">
          The map and country pages will connect every place to its people, events and
          documentaries.
        </p>
        <div className="flex flex-wrap gap-2">
          <NavLink
            item={{ title: "Open the map", href: "/map", milestone: 13 }}
            className={buttonVariants({ variant: "default", size: "lg" })}
          >
            <Map aria-hidden /> Open the map
          </NavLink>
          <NavLink
            item={{ title: "Browse countries", href: "/countries", milestone: 5 }}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Compass aria-hidden /> Browse countries
          </NavLink>
        </div>
      </div>
      <div className="flex flex-col justify-end rounded-3xl bg-lime p-6 text-lime-foreground lg:col-span-2">
        <p className="font-display text-7xl leading-none font-extrabold tracking-tighter">193</p>
        <p className="mt-2 font-semibold">UN member states: the coverage goal</p>
      </div>
      <div className="flex flex-col justify-end rounded-3xl border bg-card p-6">
        <p aria-hidden className="text-gradient font-display text-5xl font-extrabold">
          +
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Observer states, territories and historical states
        </p>
      </div>
      <div className="flex flex-col justify-end rounded-3xl border bg-card p-6">
        <p aria-hidden className="text-gradient font-display text-5xl font-extrabold">
          ∞
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Kingdoms, empires and civilizations, added as they are sourced. These are goals, not a
          count of published pages.
        </p>
      </div>
    </div>
  );
}
