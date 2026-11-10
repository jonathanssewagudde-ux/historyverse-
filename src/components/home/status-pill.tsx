import type { TopicStatus } from "@/content/homepage";
import { cn } from "@/lib/utils";

const labels: Record<TopicStatus, string> = {
  planned: "Planned",
  "in-research": "In research",
  published: "Published",
};

export function StatusPill({ status, className }: { status: TopicStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "published" ? "bg-gold" : "border border-muted-foreground/70",
        )}
      />
      {labels[status]}
    </span>
  );
}
