/**
 * HTTP byte ranges (RFC 9110 §14) for media players. One range only; open-ended ranges are
 * capped so a "bytes=0-" request never loads a whole video into memory.
 */

export const MAX_RANGE_BYTES = 4 * 1024 * 1024;

export type RangeResult =
  { kind: "none" } | { kind: "unsatisfiable" } | { kind: "partial"; start: number; end: number };

export function parseRange(
  header: string | null,
  size: number,
  maxBytes = MAX_RANGE_BYTES,
): RangeResult {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match || (!match[1] && !match[2])) return { kind: "none" };
  let start: number;
  let end: number;
  if (!match[1]) {
    // Suffix range: the last N bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return { kind: "unsatisfiable" };
  return { kind: "partial", start, end: Math.min(end, start + maxBytes - 1) };
}
