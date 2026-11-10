/**
 * Historical dates.
 *
 * JavaScript `Date` cannot represent most of history well: it has no notion of precision
 * ("sometime in the 14th century"), approximation ("c. 1500"), uncertainty, or the absence of a
 * year 0. HISTORYVERSE stores dates in this structure instead.
 *
 * Year numbering: `year` uses HISTORICAL numbering, as Wikidata does — 1 CE is 1, 1 BCE is -1,
 * and there is no year 0. For arithmetic and ordering, convert to ASTRONOMICAL numbering
 * (1 BCE = 0, 2 BCE = -1) with `toAstronomicalYear`.
 */

export type DatePrecision = "millennium" | "century" | "decade" | "year" | "month" | "day";

export type CalendarModel = "gregorian" | "julian";

export interface HistoricalDate {
  /** Historical year numbering: negative = BCE, never 0. */
  year: number;
  month?: number;
  day?: number;
  precision: DatePrecision;
  /** "circa": the date is an approximation. */
  approximate?: boolean;
  /** Sources disagree or the date is doubtful. */
  uncertain?: boolean;
  calendar?: CalendarModel;
}

export type EraStyle = "BCE/CE" | "BC/AD";

export interface FormatOptions {
  eraStyle?: EraStyle;
  /** When to label CE years: always, never, or only years before 1000 (default). */
  showCommonEra?: "always" | "never" | "auto";
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PRECISION_RANK: Record<DatePrecision, number> = {
  millennium: 0,
  century: 1,
  decade: 2,
  year: 3,
  month: 4,
  day: 5,
};

export class InvalidHistoricalDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHistoricalDateError";
  }
}

export function toAstronomicalYear(historicalYear: number): number {
  if (!Number.isInteger(historicalYear) || historicalYear === 0) {
    throw new InvalidHistoricalDateError(`Invalid historical year: ${historicalYear}`);
  }
  return historicalYear > 0 ? historicalYear : historicalYear + 1;
}

export function fromAstronomicalYear(astronomicalYear: number): number {
  if (!Number.isInteger(astronomicalYear)) {
    throw new InvalidHistoricalDateError(`Invalid astronomical year: ${astronomicalYear}`);
  }
  return astronomicalYear > 0 ? astronomicalYear : astronomicalYear - 1;
}

function daysInMonth(year: number, month: number, calendar: CalendarModel): number {
  const astro = toAstronomicalYear(year);
  const leap =
    calendar === "julian"
      ? astro % 4 === 0
      : (astro % 4 === 0 && astro % 100 !== 0) || astro % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

/** Validate and normalise a date, dropping components finer than its precision. */
export function createHistoricalDate(input: HistoricalDate): HistoricalDate {
  const { year, precision } = input;
  toAstronomicalYear(year); // validates year
  const rank = PRECISION_RANK[precision];
  if (rank === undefined) throw new InvalidHistoricalDateError(`Unknown precision: ${precision}`);

  const date: HistoricalDate = { year, precision };
  if (rank >= PRECISION_RANK.month) {
    const month = input.month;
    if (!month || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new InvalidHistoricalDateError(
        `Month required and must be 1-12 for ${precision} precision`,
      );
    }
    date.month = month;
  }
  if (rank >= PRECISION_RANK.day) {
    const day = input.day;
    const max = daysInMonth(year, date.month!, input.calendar ?? "gregorian");
    if (!day || !Number.isInteger(day) || day < 1 || day > max) {
      throw new InvalidHistoricalDateError(`Day must be 1-${max} for ${year}-${date.month}`);
    }
    date.day = day;
  }
  if (input.approximate) date.approximate = true;
  if (input.uncertain) date.uncertain = true;
  if (input.calendar && input.calendar !== "gregorian") date.calendar = input.calendar;
  return date;
}

/** 1 → "1st", 12 → "12th", 21 → "21st". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Century of a historical year: 1–100 → 1st, 1801–1900 → 19th; -1 to -100 → 1st century BCE.
 * Returned as a signed number (negative = BCE).
 */
export function centuryOf(year: number): number {
  toAstronomicalYear(year);
  const c = Math.ceil(Math.abs(year) / 100);
  return year > 0 ? c : -c;
}

export function millenniumOf(year: number): number {
  toAstronomicalYear(year);
  const m = Math.ceil(Math.abs(year) / 1000);
  return year > 0 ? m : -m;
}

function eraLabels(style: EraStyle) {
  return style === "BC/AD" ? { before: "BC", common: "AD" } : { before: "BCE", common: "CE" };
}

function withEra(
  core: string,
  isBce: boolean,
  magnitude: number,
  opts: FormatOptions,
  prefixAD = true,
): string {
  const style = opts.eraStyle ?? "BCE/CE";
  const labels = eraLabels(style);
  if (isBce) return `${core} ${labels.before}`;
  const mode = opts.showCommonEra ?? "auto";
  const show = mode === "always" || (mode === "auto" && magnitude < 1000);
  if (!show) return core;
  // Convention: "AD 79" precedes a year, "79 CE" follows it; centuries read "1st century AD".
  return style === "BC/AD" && prefixAD ? `${labels.common} ${core}` : `${core} ${labels.common}`;
}

/** Human-readable English rendering. Localised formatting arrives with i18n (Milestone 14). */
export function formatHistoricalDate(date: HistoricalDate, opts: FormatOptions = {}): string {
  const { year, precision } = date;
  const isBce = year < 0;
  const abs = Math.abs(year);
  let text: string;

  switch (precision) {
    case "millennium": {
      const m = Math.abs(millenniumOf(year));
      text = withEra(`${ordinal(m)} millennium`, isBce, m * 1000, opts, false);
      break;
    }
    case "century": {
      const c = Math.abs(centuryOf(year));
      text = withEra(`${ordinal(c)} century`, isBce, c * 100, opts, false);
      break;
    }
    case "decade": {
      const d = Math.floor(abs / 10) * 10;
      text = withEra(`${d}s`, isBce, d, opts, false);
      break;
    }
    case "year":
      text = withEra(String(abs), isBce, abs, opts);
      break;
    case "month":
      text = withEra(`${MONTHS[date.month! - 1]} ${abs}`, isBce, abs, opts, false);
      break;
    case "day":
      text = withEra(`${date.day} ${MONTHS[date.month! - 1]} ${abs}`, isBce, abs, opts, false);
      break;
  }

  if (date.approximate) text = `c. ${text}`;
  if (date.uncertain) text = `${text} (uncertain)`;
  if (date.calendar === "julian") text = `${text} (Julian)`;
  return text;
}

/**
 * Numeric key for chronological ordering (earliest first). Coarse dates sort at the start of their
 * period, so "19th century" sorts before "1850".
 */
export function chronologicalSortKey(date: HistoricalDate): number {
  let astro: number;
  switch (date.precision) {
    case "millennium": {
      const m = millenniumOf(date.year);
      astro = m > 0 ? (m - 1) * 1000 + 1 : toAstronomicalYear(m * 1000);
      break;
    }
    case "century": {
      const c = centuryOf(date.year);
      astro = c > 0 ? (c - 1) * 100 + 1 : toAstronomicalYear(c * 100);
      break;
    }
    case "decade": {
      const d = Math.floor(Math.abs(date.year) / 10) * 10;
      astro = date.year > 0 ? Math.max(d, 1) : toAstronomicalYear(-(d + 9));
      break;
    }
    default:
      astro = toAstronomicalYear(date.year);
  }
  return astro * 10_000 + (date.month ?? 1) * 100 + (date.day ?? 1);
}

export function compareHistoricalDates(a: HistoricalDate, b: HistoricalDate): number {
  return chronologicalSortKey(a) - chronologicalSortKey(b);
}

export function formatHistoricalRange(
  start: HistoricalDate | null,
  end: HistoricalDate | null,
  opts: FormatOptions & { openEndLabel?: string } = {},
): string {
  const startText = start ? formatHistoricalDate(start, opts) : "?";
  if (!end) return `${startText} – ${opts.openEndLabel ?? "present"}`;
  // Ranges that cross the BCE/CE boundary must label both sides.
  const crossesEra = start !== null && start.year < 0 && end.year > 0;
  const endText = formatHistoricalDate(
    end,
    crossesEra ? { ...opts, showCommonEra: "always" } : opts,
  );
  return `${startText} – ${endText}`;
}

// ------------------------------------------------------------------------ Wikidata

const WIKIDATA_PRECISION: Record<number, DatePrecision> = {
  6: "millennium",
  7: "century",
  8: "decade",
  9: "year",
  10: "month",
  11: "day",
};

const CALENDARS: Record<string, CalendarModel> = {
  "http://www.wikidata.org/entity/Q1985727": "gregorian",
  "http://www.wikidata.org/entity/Q1985786": "julian",
};

/**
 * Parse a Wikidata time value, e.g. `{ time: "+1884-10-21T00:00:00Z", precision: 11 }`.
 *
 * Precisions coarser than millennium (0–5: billions to ten-thousands of years) are represented as
 * approximate years, which is how they are meaningfully displayed ("c. 300000 BCE").
 */
export function parseWikidataTime(value: {
  time: string;
  precision: number;
  calendarmodel?: string;
}): HistoricalDate {
  const match = /^([+-])(\d+)-(\d{2})-(\d{2})T/.exec(value.time);
  if (!match) throw new InvalidHistoricalDateError(`Unrecognised Wikidata time: ${value.time}`);
  const [, sign, yearDigits, monthDigits, dayDigits] = match;
  const magnitude = Number(yearDigits);
  if (magnitude === 0)
    throw new InvalidHistoricalDateError(`Year 0 is not a historical year: ${value.time}`);
  const year = sign === "-" ? -magnitude : magnitude;
  const calendar = value.calendarmodel ? CALENDARS[value.calendarmodel] : undefined;

  if (value.precision < 6) {
    return createHistoricalDate({ year, precision: "year", approximate: true, calendar });
  }
  const precision = WIKIDATA_PRECISION[value.precision];
  if (!precision)
    throw new InvalidHistoricalDateError(`Unsupported Wikidata precision: ${value.precision}`);

  return createHistoricalDate({
    year,
    month: Number(monthDigits) || undefined,
    day: Number(dayDigits) || undefined,
    precision,
    calendar,
  });
}
