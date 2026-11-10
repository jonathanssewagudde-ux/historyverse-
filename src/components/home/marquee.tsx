import { cn } from "@/lib/utils";

/**
 * Endless scrolling ticker. Purely decorative (every item also appears in the page content), so it
 * is hidden from assistive technology; reduced-motion users get a static row.
 */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (
    <ul className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-6 whitespace-nowrap">
          <span>{item}</span>
          <span className="text-primary">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div aria-hidden className={cn("overflow-hidden", className)}>
      <div className="flex w-max animate-marquee motion-reduce:animate-none">
        {row}
        {row}
      </div>
    </div>
  );
}
