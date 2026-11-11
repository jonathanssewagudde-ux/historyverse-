/** Plain text of stored article markup: citation markers and emphasis removed. */
export function plainText(body: string): string {
  return body
    .replace(/\[\^\d+\]/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*\n\s*/g, "\n\n")
    .trim();
}

/** Markers wrapped around matched words by the database's ts_headline(). */
export const HIGHLIGHT_START = "[[hl]]";
export const HIGHLIGHT_END = "[[/hl]]";

export type HighlightPart = { text: string; match: boolean };

/** Split a ts_headline() snippet into plain and highlighted parts (rendered as text, never HTML). */
export function splitHighlights(snippet: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let rest = snippet;
  while (rest.length > 0) {
    const start = rest.indexOf(HIGHLIGHT_START);
    if (start === -1) {
      parts.push({ text: rest, match: false });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), match: false });
    const end = rest.indexOf(HIGHLIGHT_END, start);
    if (end === -1) {
      parts.push({ text: rest.slice(start + HIGHLIGHT_START.length), match: false });
      break;
    }
    parts.push({ text: rest.slice(start + HIGHLIGHT_START.length, end), match: true });
    rest = rest.slice(end + HIGHLIGHT_END.length);
  }
  // Merge adjacent highlighted words ("Buganda" "Kingdom") into one run.
  return parts.reduce<HighlightPart[]>((acc, p) => {
    const last = acc.at(-1);
    if (last && last.match && p.match) last.text += p.text;
    else if (p.text) acc.push({ ...p });
    return acc;
  }, []);
}
