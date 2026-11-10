import "server-only";

import type { HistoricalDate as DateRow } from "@/generated/prisma/client";
import {
  formatHistoricalDate,
  formatHistoricalRange,
  type HistoricalDate,
} from "@/lib/history/dates";

/** Database row → domain date. The inverse of the importer's `dateData`. */
export function fromDateRow(row: DateRow): HistoricalDate {
  return {
    year: row.year,
    month: row.month ?? undefined,
    day: row.day ?? undefined,
    precision: row.precision.toLowerCase() as HistoricalDate["precision"],
    approximate: row.approximate || undefined,
    uncertain: row.uncertain || undefined,
    calendar: row.calendar === "JULIAN" ? "julian" : undefined,
  };
}

export function formatDateRow(row: DateRow | null): string | null {
  return row ? formatHistoricalDate(fromDateRow(row)) : null;
}

/** "1837 – 19 October 1884", "1962 –" (no end recorded), or null when nothing is known. */
export function formatDateRowRange(start: DateRow | null, end: DateRow | null): string | null {
  if (!start && !end) return null;
  if (start && !end) return `${formatHistoricalDate(fromDateRow(start))} –`;
  return formatHistoricalRange(start ? fromDateRow(start) : null, end ? fromDateRow(end) : null);
}
