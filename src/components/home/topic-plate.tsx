import { cn } from "@/lib/utils";

const HUES = [78, 62, 48, 255, 265, 35];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ROMAN_NUMERAL = /^[IVXLC]+$/;

/** First and last significant capitalised words: "Indus Valley Civilisation" → "IC", "Mutesa I" → "M". */
export function initials(name: string): string {
  const words = name
    .replace(/^(The|Kingdom of|Ancient)\s+/i, "")
    .split(/[\s-]+/)
    .filter((w) => /^[A-ZÀ-Ý]/.test(w) && !ROMAN_NUMERAL.test(w));
  if (words.length === 0) return "";
  const first = words[0]![0]!;
  return words.length === 1 ? first : first + words.at(-1)![0];
}

/**
 * Decorative typographic plate used where no licensed image exists yet. It is abstract by design
 * (monogram + engraved rings) so it can never be mistaken for historical imagery.
 */
export function TopicPlate({
  name,
  className,
  monogram = true,
}: {
  name: string;
  className?: string;
  monogram?: boolean;
}) {
  const h = hash(name);
  const hue = HUES[h % HUES.length];
  const rotate = (h % 7) * 13;

  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, oklch(0.42 0.07 ${hue} / 0.55), transparent 60%), linear-gradient(160deg, oklch(0.27 0.04 ${hue}), oklch(0.17 0.03 260))`,
      }}
    >
      <svg
        viewBox="0 0 200 150"
        className="absolute inset-0 size-full text-gold opacity-35"
        preserveAspectRatio="xMidYMid slice"
      >
        <g transform={`rotate(${rotate} 150 75)`} fill="none" stroke="currentColor">
          <circle cx="150" cy="75" r="70" strokeWidth="0.6" />
          <circle cx="150" cy="75" r="52" strokeWidth="0.4" strokeDasharray="1 3" />
          <circle cx="150" cy="75" r="34" strokeWidth="0.6" />
          <path d="M80 75h140M150 5v140" strokeWidth="0.4" />
        </g>
      </svg>
      {monogram && (
        <span className="absolute bottom-3 left-4 font-serif text-5xl leading-none font-semibold text-[oklch(0.92_0.05_85)] opacity-90">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
