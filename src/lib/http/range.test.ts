import { describe, expect, it } from "vitest";

import { parseRange } from "./range";

describe("parseRange", () => {
  it("ignores missing or malformed headers", () => {
    expect(parseRange(null, 100)).toEqual({ kind: "none" });
    expect(parseRange("bytes=-", 100)).toEqual({ kind: "none" });
    expect(parseRange("items=0-1", 100)).toEqual({ kind: "none" });
    expect(parseRange("bytes=0-1,5-6", 100)).toEqual({ kind: "none" });
  });

  it("reads closed, open-ended and suffix ranges", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ kind: "partial", start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ kind: "partial", start: 90, end: 99 });
    expect(parseRange("bytes=95-500", 100)).toEqual({ kind: "partial", start: 95, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ kind: "partial", start: 90, end: 99 });
    expect(parseRange("bytes=-500", 100)).toEqual({ kind: "partial", start: 0, end: 99 });
  });

  it("caps long ranges so large videos stream in chunks", () => {
    expect(parseRange("bytes=0-", 10_000, 1000)).toEqual({ kind: "partial", start: 0, end: 999 });
    expect(parseRange("bytes=500-", 10_000, 1000)).toEqual({
      kind: "partial",
      start: 500,
      end: 1499,
    });
  });

  it("refuses ranges outside the file", () => {
    expect(parseRange("bytes=100-", 100)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=9-3", 100)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=-0", 100)).toEqual({ kind: "unsatisfiable" });
  });
});
