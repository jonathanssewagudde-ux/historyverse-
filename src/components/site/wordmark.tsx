import { cn } from "@/lib/utils";

/** HISTORYVERSE wordmark: a four-point spark in the brand gradient plus lowercase grotesk type. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden focusable="false">
        <defs>
          <linearGradient id="hv-spark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary)" />
            <stop offset="0.6" stopColor="var(--pink)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z"
          fill="url(#hv-spark)"
        />
      </svg>
      <span className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap lowercase sm:text-xl">
        history<span className="text-primary">verse</span>
      </span>
    </span>
  );
}
