import { describe, expect, it } from "vitest";
import { compareHistoricalDates } from "./dates";
import { formatEraRange, worldEras } from "./eras";

describe("worldEras", () => {
  it("is contiguous and chronological", () => {
    for (let i = 1; i < worldEras.length; i++) {
      const prev = worldEras[i - 1]!;
      const cur = worldEras[i]!;
      expect(prev.end).toEqual(cur.start);
      expect(compareHistoricalDates(cur.start!, prev.start ?? cur.start!)).toBeGreaterThanOrEqual(
        0,
      );
    }
    expect(worldEras[0]!.start).toBeNull();
    expect(worldEras.at(-1)!.end).toBeNull();
  });

  it("marks pre-1945 boundaries as approximate", () => {
    for (const era of worldEras) {
      for (const d of [era.start, era.end]) {
        if (d && d.year < 1945) expect(d.approximate).toBe(true);
      }
    }
  });

  it("formats ranges", () => {
    expect(worldEras.map(formatEraRange)).toEqual([
      "Before c. 3200 BCE",
      "c. 3200 BCE – c. 500 CE",
      "c. 500 – c. 1500",
      "c. 1500 – c. 1800",
      "c. 1800 – 1945",
      "1945 – present",
    ]);
  });
});
