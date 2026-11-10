import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed bg-card/60 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
      <span className="grid size-14 shrink-0 -rotate-6 place-items-center rounded-2xl bg-lime text-lime-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
