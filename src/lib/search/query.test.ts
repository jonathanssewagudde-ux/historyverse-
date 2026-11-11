import { describe, expect, it } from "vitest";

import { eraBounds, normaliseContinent, parseQuery } from "./query";
import { plainText, splitHighlights } from "./text";

describe("parseQuery", () => {
  it.each([
    ["History of the Mali Empire", { text: "History of the Mali Empire", year: null }],
    ["What happened in 1962?", { text: "", year: 1962, yearLabel: "1962" }],
    ["Who ruled France in 1804?", { text: "ruled France", year: 1804 }],
    ["1888", { text: "", year: 1888 }],
    ["Rome in 44 BCE", { text: "Rome", year: -43, yearLabel: "44 BCE" }],
    ["Buganda 1900 agreement", { text: "Buganda agreement", year: 1900 }],
  ])("%s", (input, expected) => expect(parseQuery(input)).toMatchObject(expected));

  it("does not treat short numbers as years unless an era is given", () => {
    expect(parseQuery("World War 1").year).toBeNull();
    expect(parseQuery("Kabaka 35").year).toBeNull();
    expect(parseQuery("79 AD")).toMatchObject({ year: 79, yearLabel: "79" });
  });

  it("caps very long input", () => {
    expect(parseQuery("a".repeat(500)).text.length).toBe(200);
  });
});

describe("eraBounds", () => {
  it("uses astronomical years and open ends", () => {
    expect(eraBounds("prehistory")).toEqual({ from: null, to: -3199 });
    expect(eraBounds("modern")).toEqual({ from: 1800, to: 1945 });
    expect(eraBounds("contemporary")).toEqual({ from: 1945, to: null });
    expect(eraBounds("nope")).toBeNull();
  });
});

describe("normaliseContinent", () => {
  it.each([
    ["Africa", "AFRICA"],
    ["north-america", "NORTH_AMERICA"],
    ["South America", "SOUTH_AMERICA"],
    ["Atlantis", null],
    [undefined, null],
  ])("%s → %s", (input, expected) => expect(normaliseContinent(input)).toBe(expected));
});

describe("text helpers", () => {
  it("strips citation markers and emphasis", () => {
    expect(plainText("Its ruler is the *kabaka*.[^1] **Restored** in 1993.[^2]")).toBe(
      "Its ruler is the kabaka. Restored in 1993.",
    );
  });

  it("splits highlighted snippets and merges adjacent matches", () => {
    expect(splitHighlights("The [[hl]]Buganda[[/hl]] [[hl]]Agreement[[/hl]] of 1900")).toEqual([
      { text: "The ", match: false },
      { text: "Buganda", match: true },
      { text: " ", match: false },
      { text: "Agreement", match: true },
      { text: " of 1900", match: false },
    ]);
    expect(splitHighlights("no markers")).toEqual([{ text: "no markers", match: false }]);
    expect(splitHighlights("broken [[hl]]tail")).toEqual([
      { text: "broken ", match: false },
      { text: "tail", match: false },
    ]);
  });
});
