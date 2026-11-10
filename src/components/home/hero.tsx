import { Graticule } from "@/components/home/graticule";
import { SearchBox } from "@/components/home/search-box";
import { suggestedSearches } from "@/content/homepage";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden border-b border-border/60"
    >
      {/* Atmosphere: night-sky gradient and a warm horizon glow. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(90%_60%_at_70%_30%,oklch(0.78_0.11_80/0.10),transparent_70%),radial-gradient(70%_50%_at_10%_100%,oklch(0.55_0.09_55/0.12),transparent_70%)]"
      />
      <Graticule className="absolute top-1/2 -right-40 -z-10 w-[min(110vw,820px)] -translate-y-1/2 opacity-70 sm:-right-24 lg:right-[-6%] lg:opacity-90" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-transparent lg:via-background/60"
      />

      <div className="mx-auto flex min-h-[calc(92svh-4rem)] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6">
        <p className="mb-5 animate-in text-xs font-semibold tracking-[0.35em] text-gold uppercase duration-700 fade-in">
          The world&apos;s story, sourced
        </p>
        <h1
          id="hero-title"
          className="max-w-4xl animate-in text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance uppercase duration-700 fade-in slide-in-from-bottom-4 sm:text-6xl lg:text-7xl"
        >
          Discover the story <span className="text-gold">of our world</span>
        </h1>
        <p className="mt-6 max-w-2xl animate-in text-lg text-pretty text-muted-foreground delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-4 sm:text-xl">
          Every civilization. Every extraordinary life. Every event that shaped humanity.
        </p>
        <div className="mt-10 animate-in delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
          <SearchBox suggestions={suggestedSearches.slice(0, 4)} />
        </div>
      </div>
    </section>
  );
}
