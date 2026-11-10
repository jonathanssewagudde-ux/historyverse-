import { cn } from "@/lib/utils";

/** Vivid gradient pairs; picked deterministically per topic so each card keeps its colour. */
const GRADIENTS = [
  ["oklch(0.62 0.24 293)", "oklch(0.7 0.22 355)"], // violet → pink
  ["oklch(0.86 0.2 128)", "oklch(0.8 0.14 200)"], // lime → cyan
  ["oklch(0.72 0.2 355)", "oklch(0.82 0.16 70)"], // pink → amber
  ["oklch(0.75 0.15 220)", "oklch(0.6 0.24 293)"], // cyan → violet
  ["oklch(0.82 0.17 95)", "oklch(0.72 0.21 15)"], // yellow → coral
  ["oklch(0.55 0.2 270)", "oklch(0.85 0.2 135)"], // indigo → lime
] as const;

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
 * Decorative gradient plate used where no licensed image exists yet. Abstract by design (colour
 * field + monogram), so it can never be mistaken for historical imagery.
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
  const [from, to] = GRADIENTS[h % GRADIENTS.length]!;
  const angle = 110 + (h % 5) * 25;

  return (
    <div
      aria-hidden
      className={cn("relative isolate overflow-hidden", className)}
      style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
    >
      <div className="absolute inset-0 bg-grid opacity-40 mix-blend-overlay" />
      <div className="absolute -right-6 -bottom-10 size-40 rounded-full bg-white/25 blur-2xl" />
      {monogram && (
        <span className="absolute bottom-2 left-4 font-display text-6xl leading-none font-extrabold tracking-tighter text-[oklch(0.15_0.02_285)]/85">
          {initials(name)}
        </span>
      )}
    </div>
  );
}
