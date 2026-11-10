"use client";

import { CalendarDays } from "lucide-react";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date());
}

/**
 * Today's date comes from the visitor's browser (the page shell is prerendered, so the server cannot
 * know it). Events are shown only once sourced records exist; nothing is invented to fill the space.
 */
export function TodayInHistory() {
  const today = useSyncExternalStore(noop, todayLabel, () => null);

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="flex rotate-[-1.5deg] flex-col justify-between gap-8 rounded-3xl bg-gradient-to-br from-primary to-pink p-6 text-[oklch(0.99_0_0)] shadow-[0_25px_60px_-25px_var(--glow)] sm:p-8">
        <CalendarDays className="size-7" aria-hidden />
        <div>
          <p className="font-mono text-xs">on this day</p>
          <p
            className="mt-1 font-display text-5xl leading-none font-extrabold tracking-tight"
            data-testid="today-date"
          >
            {today ?? "Today"}
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-3xl border border-dashed bg-card/60 p-6 sm:p-8">
        <h3 className="text-xl font-bold">No events loaded yet</h3>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Events that happened on this date will appear here once the historical database is
          connected. Every entry will come from sourced records with its date precision preserved,
          so an event known only to the year will never be shown on a specific day.
        </p>
      </div>
    </div>
  );
}
