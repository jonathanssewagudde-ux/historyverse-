import { describe, expect, it } from "vitest";
import {
  InvalidHistoricalDateError,
  centuryOf,
  chronologicalSortKey,
  compareHistoricalDates,
  createHistoricalDate,
  formatHistoricalDate,
  formatHistoricalRange,
  fromAstronomicalYear,
  ordinal,
  parseWikidataTime,
  toAstronomicalYear,
  type HistoricalDate,
} from "./dates";

const JULIAN = "http://www.wikidata.org/entity/Q1985786";
const GREGORIAN = "http://www.wikidata.org/entity/Q1985727";

describe("year numbering", () => {
  it("converts between historical and astronomical years with no year zero", () => {
    expect(toAstronomicalYear(1)).toBe(1);
    expect(toAstronomicalYear(-1)).toBe(0);
    expect(toAstronomicalYear(-44)).toBe(-43);
    expect(fromAstronomicalYear(0)).toBe(-1);
    expect(fromAstronomicalYear(-43)).toBe(-44);
    for (const y of [-3000, -1, 1, 1962])
      expect(fromAstronomicalYear(toAstronomicalYear(y))).toBe(y);
  });

  it("rejects year zero and non-integers", () => {
    expect(() => toAstronomicalYear(0)).toThrow(InvalidHistoricalDateError);
    expect(() => toAstronomicalYear(1.5)).toThrow(InvalidHistoricalDateError);
  });
});

describe("ordinal and century", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [102, "102nd"],
    [111, "111th"],
  ])("ordinal(%i) = %s", (n, expected) => expect(ordinal(n)).toBe(expected));

  it("uses the 1–100 century convention", () => {
    expect(centuryOf(1)).toBe(1);
    expect(centuryOf(100)).toBe(1);
    expect(centuryOf(101)).toBe(2);
    expect(centuryOf(1900)).toBe(19);
    expect(centuryOf(1901)).toBe(20);
    expect(centuryOf(-1)).toBe(-1);
    expect(centuryOf(-500)).toBe(-5);
  });
});

describe("createHistoricalDate", () => {
  it("drops components finer than the precision", () => {
    expect(createHistoricalDate({ year: 1862, month: 7, day: 28, precision: "year" })).toEqual({
      year: 1862,
      precision: "year",
    });
  });

  it("validates months and days, including leap years per calendar", () => {
    expect(() => createHistoricalDate({ year: 1900, month: 13, precision: "month" })).toThrow();
    expect(() =>
      createHistoricalDate({ year: 1900, month: 2, day: 29, precision: "day" }),
    ).toThrow();
    expect(createHistoricalDate({ year: 2000, month: 2, day: 29, precision: "day" }).day).toBe(29);
    // 1900 is a leap year in the Julian calendar.
    expect(
      createHistoricalDate({ year: 1900, month: 2, day: 29, precision: "day", calendar: "julian" })
        .day,
    ).toBe(29);
  });
});

describe("formatHistoricalDate", () => {
  const cases: Array<[HistoricalDate, string]> = [
    [{ year: 1962, month: 10, day: 9, precision: "day" }, "9 October 1962"],
    [{ year: 1962, month: 10, precision: "month" }, "October 1962"],
    [{ year: 1962, precision: "year" }, "1962"],
    [{ year: 79, precision: "year" }, "79 CE"],
    [{ year: -44, precision: "year" }, "44 BCE"],
    [{ year: 1895, precision: "decade" }, "1890s"],
    [{ year: 1850, precision: "century" }, "19th century"],
    [{ year: -450, precision: "century" }, "5th century BCE"],
    [{ year: 1350, precision: "century" }, "14th century"],
    [{ year: -2500, precision: "millennium" }, "3rd millennium BCE"],
    [{ year: 1300, precision: "year", approximate: true }, "c. 1300"],
    [{ year: 1884, precision: "year", uncertain: true }, "1884 (uncertain)"],
  ];
  it.each(cases)("%o → %s", (date, expected) => expect(formatHistoricalDate(date)).toBe(expected));

  it("supports BC/AD style with AD placed before years", () => {
    expect(formatHistoricalDate({ year: 79, precision: "year" }, { eraStyle: "BC/AD" })).toBe(
      "AD 79",
    );
    expect(formatHistoricalDate({ year: -44, precision: "year" }, { eraStyle: "BC/AD" })).toBe(
      "44 BC",
    );
    expect(formatHistoricalDate({ year: 50, precision: "century" }, { eraStyle: "BC/AD" })).toBe(
      "1st century AD",
    );
  });

  it("honours showCommonEra", () => {
    expect(
      formatHistoricalDate({ year: 1962, precision: "year" }, { showCommonEra: "always" }),
    ).toBe("1962 CE");
    expect(formatHistoricalDate({ year: 79, precision: "year" }, { showCommonEra: "never" })).toBe(
      "79",
    );
  });
});

describe("chronological ordering", () => {
  it("orders BCE before CE and coarse periods at their start", () => {
    const dates: HistoricalDate[] = [
      { year: 1850, precision: "year" },
      { year: 1801, precision: "century" },
      { year: -44, month: 3, day: 15, precision: "day" },
      { year: -1, precision: "year" },
      { year: 1, precision: "year" },
      { year: -500, precision: "century" },
      { year: 1962, month: 10, day: 9, precision: "day" },
      { year: 1962, month: 10, precision: "month" },
    ];
    const sorted = [...dates].sort(compareHistoricalDates).map((d) => formatHistoricalDate(d));
    expect(sorted).toEqual([
      "5th century BCE",
      "15 March 44 BCE",
      "1 BCE",
      "1 CE",
      "19th century",
      "1850",
      "October 1962",
      "9 October 1962",
    ]);
  });

  it("starts BCE decades at their earliest year", () => {
    // The 490s BCE run 499 → 490 BCE.
    expect(chronologicalSortKey({ year: -495, precision: "decade" })).toBe(
      chronologicalSortKey({ year: -499, precision: "year" }),
    );
  });
});

describe("formatHistoricalRange", () => {
  it("formats closed, open and era-crossing ranges", () => {
    expect(
      formatHistoricalRange({ year: 1884, precision: "year" }, { year: 1897, precision: "year" }),
    ).toBe("1884 – 1897");
    expect(formatHistoricalRange({ year: 1993, precision: "year" }, null)).toBe("1993 – present");
    expect(
      formatHistoricalRange({ year: -27, precision: "year" }, { year: 14, precision: "year" }),
    ).toBe("27 BCE – 14 CE");
    expect(formatHistoricalRange(null, { year: 1500, precision: "year" })).toBe("? – 1500");
  });
});

describe("parseWikidataTime", () => {
  it("parses day precision (Uganda independence)", () => {
    const d = parseWikidataTime({
      time: "+1962-10-09T00:00:00Z",
      precision: 11,
      calendarmodel: GREGORIAN,
    });
    expect(d).toEqual({ year: 1962, month: 10, day: 9, precision: "day" });
  });

  it("parses BCE Julian dates with historical numbering", () => {
    const d = parseWikidataTime({
      time: "-0044-03-15T00:00:00Z",
      precision: 11,
      calendarmodel: JULIAN,
    });
    expect(formatHistoricalDate(d)).toBe("15 March 44 BCE (Julian)");
  });

  it("parses coarse precisions", () => {
    expect(parseWikidataTime({ time: "+1801-00-00T00:00:00Z", precision: 7 })).toEqual({
      year: 1801,
      precision: "century",
    });
    expect(
      formatHistoricalDate(parseWikidataTime({ time: "+1900-00-00T00:00:00Z", precision: 7 })),
    ).toBe("19th century");
    expect(parseWikidataTime({ time: "+1890-00-00T00:00:00Z", precision: 8 }).precision).toBe(
      "decade",
    );
  });

  it("represents deep-time precisions as approximate years", () => {
    const d = parseWikidataTime({ time: "-300000-00-00T00:00:00Z", precision: 3 });
    expect(formatHistoricalDate(d)).toBe("c. 300000 BCE");
  });

  it("rejects malformed values and year zero", () => {
    expect(() => parseWikidataTime({ time: "1962-10-09", precision: 11 })).toThrow(
      InvalidHistoricalDateError,
    );
    expect(() => parseWikidataTime({ time: "+0000-00-00T00:00:00Z", precision: 9 })).toThrow(
      InvalidHistoricalDateError,
    );
    expect(() => parseWikidataTime({ time: "+1962-00-00T00:00:00Z", precision: 12 })).toThrow(
      InvalidHistoricalDateError,
    );
  });
});
