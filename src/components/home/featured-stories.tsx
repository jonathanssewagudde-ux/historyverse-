import { ArrowUpRight } from "lucide-react";

import { StatusPill } from "@/components/home/status-pill";
import { TopicPlate } from "@/components/home/topic-plate";
import type { featuredStories } from "@/content/homepage";
import { cn } from "@/lib/utils";

const kindEmoji: Record<string, string> = { Kingdom: "👑", Country: "🌍", Empire: "🏛️" };

/** Bento layout: one hero tile plus two stacked tiles. */
export function FeaturedStories({ stories }: { stories: typeof featuredStories }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-3 lg:grid-rows-2">
      {stories.map((story, i) => (
        <li key={story.name} className={cn(i === 0 && "lg:col-span-2 lg:row-span-2")}>
          <article
            className={cn(
              "group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-2 transition duration-300 hover:border-primary/60 hover:shadow-[0_30px_80px_-30px_var(--glow)]",
              i === 0 ? "min-h-[26rem]" : "min-h-64",
            )}
          >
            <TopicPlate
              name={story.name}
              monogram={false}
              className={cn("rounded-2xl", i === 0 ? "min-h-56 flex-1" : "h-28")}
            />
            <ArrowUpRight
              aria-hidden
              className="absolute top-5 right-5 size-9 rounded-full bg-background/80 p-2 backdrop-blur transition group-hover:rotate-45"
            />
            <div className={cn("flex flex-col gap-2 px-3 pt-4 pb-3", i === 0 && "sm:px-5 sm:pb-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-0.5 text-xs font-bold text-lime-foreground">
                  <span aria-hidden>{kindEmoji[story.kind] ?? "✦"}</span>
                  {story.kind}
                </span>
                <StatusPill status={story.status} />
              </div>
              <h3
                className={cn(
                  "leading-[1.05] font-extrabold text-balance",
                  i === 0 ? "text-3xl sm:text-5xl" : "text-2xl",
                )}
              >
                {story.name}
              </h3>
              <p className="font-mono text-xs text-muted-foreground">{story.context}</p>
              <p className={cn("max-w-xl text-muted-foreground", i !== 0 && "text-sm")}>
                {story.summary}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
