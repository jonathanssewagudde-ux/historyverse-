"use client";

import { Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Suggestion = { title: string; path: string; template: string; via: string | null };

const typeLabel: Record<string, string> = {
  KINGDOM: "Kingdom",
  COUNTRY: "Country",
  BIOGRAPHY: "Person",
  MONARCH: "Monarch",
  PRESIDENT: "President",
};

/**
 * Search input with autocomplete (WAI-ARIA combobox pattern). It is a plain GET form to /search,
 * so it works without JavaScript; with JavaScript it adds suggestions from published articles.
 */
export function SearchCombobox({
  defaultValue = "",
  size = "hero",
  autoFocus,
  hiddenFields,
}: {
  defaultValue?: string;
  size?: "hero" | "page";
  autoFocus?: boolean;
  /** Current filters to keep when searching again from the results page. */
  hiddenFields?: Record<string, string>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputId = useId();
  const listId = useId();
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      requestRef.current?.abort();
      return;
    }
    const timer = setTimeout(async () => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions);
        setActive(-1);
      } catch {
        // aborted or offline: keep the plain search working
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const visible = open && query.trim().length >= 2 && suggestions.length > 0;
  const optionId = (i: number) => `${listId}-option-${i}`;

  function go(s: Suggestion) {
    setOpen(false);
    router.push(s.path as Route);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && visible && active >= 0) {
      e.preventDefault();
      go(suggestions[active]!);
    } else if (e.key === "Escape") {
      if (visible) {
        e.preventDefault();
        setOpen(false);
      } else setQuery("");
    }
  }

  const hero = size === "hero";

  return (
    <form
      role="search"
      aria-label="Search history"
      action="/search"
      method="get"
      className={cn(
        "relative w-full",
        hero &&
          "rounded-full bg-gradient-to-r from-primary via-pink to-cyan p-[2px] shadow-[0_20px_60px_-15px_var(--glow)]",
      )}
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={inputId} className="sr-only">
        Search any country, person, kingdom, or historical event
      </label>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 size-5 -translate-y-1/2 text-muted-foreground",
          hero ? "left-5" : "left-4",
        )}
        aria-hidden
      />
      <input
        id={inputId}
        type="search"
        name="q"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={visible && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        maxLength={200}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Search any country, person, kingdom, or historical event..."
        className={cn(
          "w-full bg-background text-base outline-none placeholder:text-muted-foreground",
          hero
            ? "h-14 rounded-full pr-14 pl-12 focus-visible:ring-4 focus-visible:ring-lime/40 sm:h-16 sm:pr-28 sm:pl-13 sm:text-lg"
            : "h-12 rounded-full border border-input pr-28 pl-11 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
        )}
      />
      <Button
        type="submit"
        variant="lime"
        className={cn(
          "absolute top-1/2 right-2 -translate-y-1/2",
          hero ? "size-10 px-0 sm:h-12 sm:w-auto sm:px-6" : "h-9 px-4",
        )}
      >
        <span className={cn(hero && "sr-only sm:not-sr-only")}>search</span>
        <span aria-hidden>→</span>
      </Button>

      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!visible}
        className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-3xl border bg-popover p-1.5 text-left shadow-[0_20px_60px_-20px_var(--glow)]"
      >
        {suggestions.map((s, i) => (
          <li
            key={s.path}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // Keep focus in the input so the list is not dismissed before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(s)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-2.5",
              i === active && "bg-accent",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{s.title}</span>
              {s.via && (
                <span className="block truncate text-xs text-muted-foreground">
                  mentions {s.via}
                </span>
              )}
            </span>
            <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
              {typeLabel[s.template] ?? "Article"}
            </span>
          </li>
        ))}
      </ul>
    </form>
  );
}
