import { Fragment, type ReactNode } from "react";

/**
 * Renders stored article text: blank-line-separated paragraphs, *italic*, **bold** and citation
 * markers `[^n]`. Output is React nodes only (no HTML strings), so article text cannot inject
 * markup. `refs` maps a section-local citation position to the article-wide reference number.
 */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\^\d+\])/g;

function renderInline(text: string, refs: Record<number, number>, keyPrefix: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    const cite = /^\[\^(\d+)\]$/.exec(part);
    if (cite) {
      const n = refs[Number(cite[1])];
      if (!n) return null; // a marker without a citation row is dropped rather than shown broken
      return (
        <sup key={key} className="ml-0.5 font-mono text-[0.7em]">
          <a
            href={`#ref-${n}`}
            aria-label={`Source ${n}`}
            className="text-primary no-underline hover:underline"
          >
            [{n}]
          </a>
        </sup>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function RichText({
  body,
  refs,
  className,
  paragraphClassName,
}: {
  body: string;
  refs: Record<number, number>;
  className?: string;
  paragraphClassName?: string;
}) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i} className={paragraphClassName}>
          {renderInline(p, refs, String(i))}
        </p>
      ))}
    </div>
  );
}
