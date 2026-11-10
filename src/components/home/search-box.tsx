"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { isRouteAvailable } from "@/config/navigation";

/**
 * Homepage search. Until the search engine ships (Milestone 6) it says so plainly instead of
 * pretending to search. Once `/search` is an available route, submissions navigate there.
 */
export function SearchBox({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const inputId = useId();
  const noticeId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    if (isRouteAvailable("/search")) {
      router.push(`/search?q=${encodeURIComponent(q)}` as Route);
      return;
    }
    setNotice(
      "Search is not open yet. It launches with the historical database in Milestone 6, and results will come only from sourced records.",
    );
  }

  return (
    <div id="search" className="w-full max-w-2xl scroll-mt-28">
      <form
        role="search"
        aria-label="Search history"
        onSubmit={submit}
        className="relative rounded-full bg-gradient-to-r from-primary via-pink to-cyan p-[2px] shadow-[0_20px_60px_-15px_var(--glow)]"
      >
        <label htmlFor={inputId} className="sr-only">
          Search any country, person, kingdom, or historical event
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          name="q"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNotice(null);
          }}
          aria-describedby={notice ? noticeId : undefined}
          placeholder="Search any country, person, kingdom, or historical event..."
          className="h-14 w-full rounded-full bg-background pr-14 pl-12 text-base transition outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-lime/40 sm:h-16 sm:pr-28 sm:pl-13 sm:text-lg"
        />
        <Button
          type="submit"
          variant="lime"
          className="absolute top-1/2 right-2 size-10 -translate-y-1/2 px-0 sm:h-12 sm:w-auto sm:px-6"
        >
          <span className="sr-only sm:not-sr-only">search</span>
          <span aria-hidden>→</span>
        </Button>
      </form>

      <p
        id={noticeId}
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 text-sm font-medium text-muted-foreground"
      >
        {notice}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">try →</span>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuery(s);
              setNotice(null);
              inputRef.current?.focus();
            }}
            className="rounded-full border bg-card/70 px-3.5 py-1.5 text-sm font-medium backdrop-blur transition hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
