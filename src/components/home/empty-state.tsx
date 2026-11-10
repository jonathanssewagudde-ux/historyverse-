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
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/40 p-6 sm:flex-row sm:items-center sm:gap-5 sm:p-8">
      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold/40 text-gold">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h3 className="font-sans text-base font-semibold">{title}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
