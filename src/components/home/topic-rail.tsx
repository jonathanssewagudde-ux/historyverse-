import { StatusPill } from "@/components/home/status-pill";
import { TopicPlate } from "@/components/home/topic-plate";
import type { Topic } from "@/content/homepage";

/** Swipeable rail on phones; a bento grid from the small breakpoint up. */
export function TopicRail({ topics, label }: { topics: Topic[]; label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="-mx-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-0 sm:overflow-visible sm:px-0"
    >
      <ul className="flex snap-x snap-mandatory gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {topics.map((topic) => (
          <li key={topic.name} className="w-[70%] shrink-0 snap-start sm:w-auto">
            <article className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-2 transition duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_20px_50px_-20px_var(--glow)]">
              <TopicPlate name={topic.name} className="aspect-[16/10] rounded-2xl" />
              <div className="flex flex-1 flex-col gap-1 px-2 pt-3 pb-2">
                <h3 className="text-lg leading-snug font-bold">{topic.name}</h3>
                <p className="text-sm text-muted-foreground">{topic.context}</p>
                <StatusPill status={topic.status} className="mt-auto" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
