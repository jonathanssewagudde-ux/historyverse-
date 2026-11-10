"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, useState } from "react";

import { formatEraRange, worldEras } from "@/lib/history/eras";
import { cn } from "@/lib/utils";

/** Accessible tabbed era explorer (WAI-ARIA tabs pattern, arrow-key navigation). */
export function EraTimeline() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const era = worldEras[active]!;

  function onKeyDown(e: React.KeyboardEvent) {
    const last = worldEras.length - 1;
    const next =
      e.key === "ArrowRight"
        ? active === last
          ? 0
          : active + 1
        : e.key === "ArrowLeft"
          ? active === 0
            ? last
            : active - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-8">
      <div className="relative">
        <div aria-hidden className="absolute top-[1.15rem] right-4 left-4 h-px bg-border" />
        <motion.div
          aria-hidden
          className="absolute top-[1.15rem] left-4 h-px bg-gold"
          animate={{
            width: `calc(${(active / (worldEras.length - 1)) * 100}% - ${(active / (worldEras.length - 1)) * 2}rem)`,
          }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
        <div
          role="tablist"
          aria-label="Historical eras"
          onKeyDown={onKeyDown}
          className="relative grid grid-cols-3 gap-y-4 sm:grid-cols-6"
        >
          {worldEras.map((e, i) => (
            <button
              key={e.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${e.id}`}
              aria-selected={i === active}
              aria-controls={`${baseId}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className="group flex flex-col items-center gap-2 rounded-md px-1 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  "size-3 rounded-full border-2 transition-colors",
                  i <= active ? "border-gold bg-gold" : "border-muted-foreground/60 bg-card",
                  i === active && "ring-4 ring-gold/25",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium sm:text-sm",
                  i === active
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {e.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${era.id}`}
        className="mt-8 min-h-36"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={era.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-sm font-medium tracking-wider text-gold" data-testid="era-range">
              {formatEraRange(era)}
            </p>
            <h3 className="mt-1 text-3xl font-semibold">{era.name}</h3>
            <p className="mt-3 max-w-2xl text-muted-foreground">{era.summary}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
        These era boundaries are approximate teaching conventions that come largely from European
        historiography. Their meaning varies by region. The full interactive timeline arrives in
        Milestone 13.
      </p>
    </div>
  );
}
