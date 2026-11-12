import { describe, expect, it } from "vitest";

import {
  estimateMp3DurationMs,
  estimateSpeechSeconds,
  narrationText,
  parseWav,
  pcmToWav,
  sniffAudio,
} from "@/server/audio/audio";
import { sceneRanges } from "./documentaries";
import { planScenes } from "./structure";

describe("audio helpers", () => {
  it("writes and reads WAV files, including duration", () => {
    const wav = pcmToWav(new Uint8Array(22_050 * 2 * 2), 22_050); // two seconds of 16-bit mono
    expect(parseWav(wav)).toEqual({
      sampleRate: 22_050,
      channels: 1,
      bitsPerSample: 16,
      durationMs: 2000,
    });
    expect(sniffAudio(wav)).toEqual({ mime: "audio/wav", ext: "wav" });
    expect(
      parseWav(new TextEncoder().encode("not a wav file at all, definitely not one")),
    ).toBeNull();
  });

  it("estimates an MP3's duration from its frame bitrate", () => {
    // A 128 kbit/s MPEG-1 Layer III frame header followed by 16,000 bytes = 1 second.
    const mp3 = new Uint8Array(16_000);
    mp3.set([0xff, 0xfb, 0x90, 0x00]);
    expect(estimateMp3DurationMs(mp3)).toBe(1000);
    expect(sniffAudio(mp3)).toEqual({ mime: "audio/mpeg", ext: "mp3" });
  });

  it("prepares text for speech: no markers, and the pronunciation guide applied to whole words", () => {
    expect(
      narrationText("The *Kabaka* of Buganda ruled[^1]. Kabakas [@s1|p. 2] followed.", {
        Kabaka: "kah-BAH-kah",
        Buganda: "boo-GAHN-dah",
      }),
    ).toBe("The kah-BAH-kah of boo-GAHN-dah ruled. Kabakas followed.");
    expect(estimateSpeechSeconds("one two three four five six seven eight nine ten")).toBe(4);
  });
});

describe("scene planning", () => {
  const section = (kind: string, heading: string | null, body: string, positions: number[]) => ({
    kind,
    heading,
    body,
    citations: positions.map((p) => ({ id: `${kind}-${p}`, position: p })),
  });

  const plan = planScenes({
    title: "The History of Testland",
    sections: [
      section("INTRODUCTION", null, "Testland lies by a lake.[^1]\n\nIt is old.[^2]", [1, 2]),
      section(
        "LEGACY",
        "Legacy",
        "Testland still has a king.[^1]\n\nIts story matters.[^2]",
        [1, 2],
      ),
      section("OVERVIEW", "Origins: two accounts", "Tradition tells of a hunter.[^1]", [1]),
      section("PEOPLE", "Rulers", "A long paragraph. ".repeat(60) + "[^1]", [1]),
      section("FURTHER_READING", "Further reading", "*A book*.", []),
    ],
    keyDates: [
      { label: "1900", statement: "An agreement is signed.", citationIds: ["c-1900"] },
      { label: "1966", statement: "A crisis.", citationIds: ["c-1966"] },
    ],
    assets: [{ id: "m1", title: "Engraving", kind: "ARTWORK" }],
  });

  it("orders scenes by the documentary structure, from hook to conclusion", () => {
    expect(plan.map((s) => s.beat)).toEqual([
      "hook",
      "background",
      "origins",
      "figures",
      "figures",
      "turning-points",
      "consequences",
      "conclusion",
    ]);
    expect(plan[0]).toMatchObject({
      narration: "Testland lies by a lake.",
      onScreenText: "The History of Testland",
    });
    expect(plan.at(-1)!.narration).toBe("Its story matters.");
  });

  it("keeps each paragraph's own citations, splits long ones, and skips further reading", () => {
    expect(plan[0]!.citationIds).toEqual(["INTRODUCTION-1"]);
    const figures = plan.filter((s) => s.beat === "figures");
    expect(figures.every((s) => s.citationIds.join() === "PEOPLE-1")).toBe(true);
    expect(figures.every((s) => s.narration.split(" ").length <= 90)).toBe(true);
    expect(plan.some((s) => s.narration.includes("A book"))).toBe(false);
  });

  it("turns cited key dates into turning points and assigns images", () => {
    const turning = plan.find((s) => s.beat === "turning-points")!;
    expect(turning).toMatchObject({
      narration: "1900. An agreement is signed. 1966. A crisis.",
      citationIds: ["c-1900", "c-1966"],
      onScreenText: "1900 – 1966",
    });
    expect(plan.every((s) => s.assets[0]?.mediaId === "m1")).toBe(true);
    expect(plan[0]!.visualDescription).toBe("Historical artwork: Engraving");
    expect(
      planScenes({
        title: "t",
        sections: [section("OVERVIEW", null, "Text.[^1]", [1])],
        keyDates: [],
        assets: [],
      })[0]!.visualDescription,
    ).toMatch(/Needs an image/);
  });
});

describe("approval messages", () => {
  it("groups scene numbers into ranges", () => {
    expect(sceneRanges([1, 2, 3, 5, 7, 8])).toBe("1–3, 5, 7–8");
    expect(sceneRanges([4])).toBe("4");
  });
});
