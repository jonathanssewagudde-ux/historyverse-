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
    <div className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-[minmax(0,18rem)_1fr]">
      <div className="flex flex-col justify-between gap-6 border-b bg-[radial-gradient(120%_100%_at_0%_0%,oklch(0.78_0.11_80/0.16),transparent_60%)] p-6 sm:p-8 md:border-r md:border-b-0">
        <CalendarDays className="size-6 text-gold" aria-hidden />
        <div>
          <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">On this day</p>
          <p
            className="mt-1 font-serif text-4xl font-semibold sm:text-5xl"
            data-testid="today-date"
          >
            {today ?? "Today"}
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <h3 className="font-sans text-base font-semibold">No events loaded yet</h3>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Events that happened on this date will appear here once the historical database is
          connected. Every entry will come from sourced records with its date precision preserved,
          so an event known only to the year will never be shown on a specific day.
        </p>
      </div>
    </div>
  );
}
