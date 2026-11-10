import type { TopicStatus } from "@/content/homepage";
import { cn } from "@/lib/utils";

const labels: Record<TopicStatus, string> = {
  planned: "planned",
  "in-research": "in research",
  published: "live",
};

/** Sticker-style status tag. */
export function StatusPill({ status, className }: { status: TopicStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] font-medium",
        status === "published"
          ? "bg-lime text-lime-foreground"
          : "border border-dashed border-muted-foreground/50 text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "published" ? "bg-current" : "bg-primary",
        )}
      />
      {labels[status]}
    </span>
  );
}
