import { cn } from "@/lib/utils";

/** HISTORYVERSE wordmark: a gold astrolabe-like mark with letter-spaced serif type. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 sm:gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-6 shrink-0 text-gold sm:size-7"
        aria-hidden
        focusable="false"
      >
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <ellipse
          cx="16"
          cy="16"
          rx="6"
          ry="14.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path d="M1.5 16h29M4 9h24M4 23h24" stroke="currentColor" strokeWidth="1" opacity="0.7" />
        <circle cx="16" cy="16" r="2.25" fill="currentColor" />
      </svg>
      <span className="font-serif text-base font-semibold tracking-[0.12em] whitespace-nowrap text-foreground sm:text-xl sm:tracking-[0.22em]">
        HISTORY<span className="text-gold">VERSE</span>
      </span>
    </span>
  );
}
