import { StatusPill } from "@/components/home/status-pill";
import { TopicPlate } from "@/components/home/topic-plate";
import { Badge } from "@/components/ui/badge";
import type { featuredStories } from "@/content/homepage";
import { cn } from "@/lib/utils";

export function FeaturedStories({ stories }: { stories: typeof featuredStories }) {
  return (
    <ul className="grid gap-5 lg:grid-cols-3 lg:grid-rows-2">
      {stories.map((story, i) => (
        <li key={story.name} className={cn(i === 0 && "lg:col-span-2 lg:row-span-2")}>
          <article className="group relative flex h-full min-h-72 flex-col justify-end overflow-hidden rounded-2xl border bg-card">
            <TopicPlate name={story.name} monogram={false} className="absolute inset-0" />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[oklch(0.14_0.03_260)] via-[oklch(0.14_0.03_260/0.6)] to-transparent"
            />
            <div className={cn("relative p-6 text-[oklch(0.95_0.02_88)]", i === 0 && "sm:p-10")}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className="border-[oklch(0.78_0.11_80/0.6)] text-[oklch(0.82_0.11_80)]"
                >
                  {story.kind}
                </Badge>
                <StatusPill status={story.status} className="text-[oklch(0.85_0.02_88)]" />
              </div>
              <h3
                className={cn(
                  "leading-tight font-semibold text-balance",
                  i === 0 ? "text-3xl sm:text-5xl" : "text-2xl",
                )}
              >
                {story.name}
              </h3>
              <p className="mt-1 text-sm text-[oklch(0.82_0.02_88)]">{story.context}</p>
              <p className={cn("mt-3 max-w-xl text-[oklch(0.88_0.02_88)]", i !== 0 && "text-sm")}>
                {story.summary}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
