import { Marquee } from "@/components/home/marquee";
import { SearchBox } from "@/components/home/search-box";
import { africanKingdoms, ancientCivilizations, suggestedSearches } from "@/content/homepage";

const tickerItems = [...africanKingdoms, ...ancientCivilizations].map((t) => t.name);

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate -mt-[4.5rem] overflow-hidden pt-[4.5rem]"
    >
      {/* Neon atmosphere: drifting colour blobs over a faint grid. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]"
      />
      <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden">
        <div className="absolute -top-32 left-[10%] size-[28rem] animate-blob rounded-full bg-primary/35 blur-[100px]" />
        <div className="absolute top-20 right-[5%] size-[24rem] animate-blob rounded-full bg-pink/30 blur-[100px] [animation-delay:-6s]" />
        <div className="absolute bottom-0 left-[40%] size-[22rem] animate-blob rounded-full bg-cyan/25 blur-[110px] [animation-delay:-12s]" />
      </div>

      <div className="mx-auto flex min-h-[calc(88svh-4.5rem)] max-w-7xl flex-col items-center justify-center px-4 pt-16 pb-12 text-center sm:px-6">
        <p className="mb-6 inline-flex -rotate-2 animate-in items-center gap-2 rounded-full bg-lime px-4 py-1.5 text-sm font-bold text-lime-foreground shadow-[0_10px_30px_-10px_var(--lime)] duration-700 zoom-in-95 fade-in">
          <span aria-hidden>✦</span> history, but make it make sense
        </p>
        <h1
          id="hero-title"
          className="max-w-5xl animate-in text-[2.9rem] leading-[0.95] font-extrabold tracking-tighter text-balance duration-700 fade-in slide-in-from-bottom-4 sm:text-7xl lg:text-[6.5rem]"
        >
          Discover the story of <span className="text-gradient">our world</span>
        </h1>
        <p className="mt-6 max-w-2xl animate-in text-lg text-pretty text-muted-foreground delay-150 duration-700 fill-mode-both fade-in slide-in-from-bottom-4 sm:text-xl">
          Every civilization. Every extraordinary life. Every event that shaped humanity.
        </p>
        <div className="mt-10 flex w-full animate-in justify-center delay-300 duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
          <SearchBox suggestions={suggestedSearches.slice(0, 4)} />
        </div>
      </div>

      <Marquee
        items={tickerItems}
        className="border-y bg-card/50 py-3 font-display text-lg font-bold text-muted-foreground backdrop-blur"
      />
    </section>
  );
}
