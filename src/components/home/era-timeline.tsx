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
    <div className="rounded-3xl border bg-card p-3 sm:p-6">
      <div
        role="tablist"
        aria-label="Historical eras"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1.5 rounded-[1.75rem] bg-muted p-1.5"
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
            className={cn(
              "relative flex-1 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === active ? "text-lime-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i === active && (
              <motion.span
                layoutId="era-pill"
                aria-hidden
                className="absolute inset-0 rounded-full bg-lime"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative">{e.name}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${era.id}`}
        className="mt-4 min-h-40 p-3 sm:p-4"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={era.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <p
              className="inline-block rounded-full border px-3 py-1 font-mono text-sm text-primary"
              data-testid="era-range"
            >
              {formatEraRange(era)}
            </p>
            <h3 className="mt-3 text-4xl font-extrabold sm:text-5xl">{era.name}</h3>
            <p className="mt-3 max-w-2xl text-muted-foreground">{era.summary}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mx-3 mt-2 mb-2 border-t pt-4 text-xs text-muted-foreground sm:mx-4">
        These era boundaries are approximate teaching conventions that come largely from European
        historiography. Their meaning varies by region. The full interactive timeline arrives in
        Milestone 13.
      </p>
    </div>
  );
}
