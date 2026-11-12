import { describe, expect, it } from "vitest";

import { buildCues, chunkCaption, toSrt, toVtt } from "./captions";

describe("chunkCaption", () => {
  it("keeps every chunk to two lines of at most 42 characters", () => {
    const text =
      "Buganda grew from a small state on the northern shore of Lake Victoria into the largest kingdom in the region, with a royal court, a parliament of chiefs, and a navy of canoes.";
    const chunks = chunkCaption(text);
    expect(chunks.join(" ")).toBe(text);
    for (const chunk of chunks) {
      const cue = buildCues([{ start: 0, spokenSeconds: 1, text: chunk }])[0]!;
      expect(cue.lines.length).toBeLessThanOrEqual(2);
      expect(cue.lines.every((l) => l.length <= 42)).toBe(true);
    }
  });

  it("starts a new caption after a sentence ends once a line is full", () => {
    expect(
      chunkCaption(
        "The kingdom was founded in the fourteenth century. Its first king was Kato Kintu.",
      ),
    ).toEqual([
      "The kingdom was founded in the fourteenth century.",
      "Its first king was Kato Kintu.",
    ]);
    // Short sentences stay together.
    expect(chunkCaption("It rained. Then it stopped.")).toEqual(["It rained. Then it stopped."]);
  });
});

describe("buildCues", () => {
  it("shares each scene's spoken time by length and starts each scene on time", () => {
    const cues = buildCues([
      {
        start: 0,
        spokenSeconds: 4,
        text: "First sentence is here and runs on long enough. Second one.",
      },
      { start: 6, spokenSeconds: 2, text: "Next scene." },
    ]);
    expect(cues[0]!.start).toBe(0);
    expect(cues[1]!.end).toBeCloseTo(4);
    expect(cues[0]!.end - cues[0]!.start).toBeGreaterThan(cues[1]!.end - cues[1]!.start);
    expect(cues[2]).toEqual({ start: 6, end: 8, lines: ["Next scene."] });
  });

  it("makes no cues for an empty scene", () => {
    expect(buildCues([{ start: 0, spokenSeconds: 3, text: "  " }])).toEqual([]);
  });
});

describe("caption files", () => {
  const cues = [
    { start: 0, end: 1.5, lines: ["Hello"] },
    { start: 3661.25, end: 3662.004, lines: ["Line one", "line two"] },
  ];

  it("writes SubRip", () => {
    expect(toSrt(cues)).toBe(
      "1\n00:00:00,000 --> 00:00:01,500\nHello\n\n2\n01:01:01,250 --> 01:01:02,004\nLine one\nline two\n",
    );
  });

  it("writes WebVTT", () => {
    expect(toVtt(cues)).toBe(
      "WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nHello\n\n01:01:01.250 --> 01:01:02.004\nLine one\nline two\n",
    );
  });
});
