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
      <form role="search" aria-label="Search history" onSubmit={submit} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search any country, person, kingdom, or historical event
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
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
          className="h-14 w-full rounded-full border border-gold/35 bg-card/80 pr-28 pl-12 text-base shadow-[0_0_0_1px_oklch(0.78_0.11_80/0.08),0_20px_60px_-20px_oklch(0.78_0.11_80/0.35)] backdrop-blur transition outline-none placeholder:text-muted-foreground/80 focus-visible:border-gold focus-visible:ring-4 focus-visible:ring-gold/20 sm:h-16 sm:text-lg"
        />
        <Button
          type="submit"
          className="absolute top-1/2 right-2 h-10 -translate-y-1/2 rounded-full px-5 sm:h-12 sm:px-6"
        >
          Search
        </Button>
      </form>

      <p
        id={noticeId}
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 text-sm text-muted-foreground"
      >
        {notice}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Try</span>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setQuery(s);
              setNotice(null);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-border bg-card/60 px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-gold/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
