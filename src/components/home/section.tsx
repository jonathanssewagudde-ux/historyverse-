import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { NavLink } from "@/components/site/nav-link";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Section({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
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
      className={cn("mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20", className)}
    >
      <Reveal className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            {eyebrow}
          </p>
          <h2 id={`${id}-title`} className="text-3xl leading-tight font-semibold sm:text-4xl">
            {title}
          </h2>
          {description && <p className="mt-3 text-pretty text-muted-foreground">{description}</p>}
        </div>
        {action && (
          <NavLink
            item={action}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-gold hover:underline"
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
