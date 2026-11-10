import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCommonsFiles } from "./client";

/** Real Wikimedia Commons API response captured for two public-domain files. */
const fixture = JSON.parse(readFileSync("tests/fixtures/commons/Mutesa_I.json", "utf8"));

describe("parseCommonsFiles (real Commons data)", () => {
  const files = parseCommonsFiles(fixture);

  it("reads licence, creator and dimensions", () => {
    const portrait = files.find((f) => f.title === "File:Mutesa I.jpg")!;
    expect(portrait.license).toMatchObject({
      code: "PD",
      publishable: true,
      requiresAttribution: false,
    });
    expect(portrait.creator).toBe("Unknown author");
    expect(portrait.mimeType).toBe("image/jpeg");
    expect(portrait.width).toBeGreaterThan(0);
    expect(portrait.descriptionUrl).toContain("commons.wikimedia.org/wiki/File:Mutesa_I.jpg");
    expect(portrait.attribution).toBe("Unknown author, via Wikimedia Commons, Public domain");
  });

  it("keeps the source's own date text rather than interpreting it", () => {
    expect(files.find((f) => f.title === "File:Buganda map.jpg")!.dateText).toBe("1910-01-25");
    expect(files.find((f) => f.title === "File:Mutesa I.jpg")!.dateText).toBe("Unknown date");
  });

  it("skips missing files and empty responses", () => {
    expect(
      parseCommonsFiles({ query: { pages: [{ title: "File:Nope.jpg", missing: true }] } }),
    ).toEqual([]);
    expect(parseCommonsFiles({})).toEqual([]);
  });
});
