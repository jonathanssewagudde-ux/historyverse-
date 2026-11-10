import { StatusPill } from "@/components/home/status-pill";
import { TopicPlate } from "@/components/home/topic-plate";
import type { Topic } from "@/content/homepage";

/** Horizontal, snap-scrolling rail on phones; a grid from the small breakpoint up. */
export function TopicRail({ topics, label }: { topics: Topic[]; label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0 sm:overflow-visible sm:px-0"
    >
      <ul className="flex snap-x snap-mandatory gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {topics.map((topic) => (
          <li key={topic.name} className="w-[68%] shrink-0 snap-start sm:w-auto">
            <article className="group flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-gold/50">
              <TopicPlate name={topic.name} className="aspect-[16/10]" />
              <div className="flex flex-1 flex-col gap-1 p-4">
                <h3 className="text-xl leading-snug font-semibold">{topic.name}</h3>
                <p className="text-sm text-muted-foreground">{topic.context}</p>
                <StatusPill status={topic.status} className="mt-auto pt-3" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
