import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { NavLink } from "@/components/site/nav-link";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  emoji,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  /** Short playful kicker shown above the title, e.g. "unsolved". */
  eyebrow: string;
  emoji?: string;
  title: string;
  description?: string;
  action?: NavItem;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16", className)}
    >
      <Reveal className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground lowercase">
            {emoji && <span aria-hidden>{emoji}</span>}
            {eyebrow}
          </p>
          <h2 id={`${id}-title`} className="text-3xl leading-[1.05] font-extrabold sm:text-5xl">
            {title}
          </h2>
          {description && <p className="mt-3 text-pretty text-muted-foreground">{description}</p>}
        </div>
        {action && (
          <NavLink
            item={action}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            {action.title}
            <ArrowRight className="size-4" aria-hidden />
          </NavLink>
        )}
      </Reveal>
      <Reveal delay={0.08}>{children}</Reveal>
    </section>
  );
}
