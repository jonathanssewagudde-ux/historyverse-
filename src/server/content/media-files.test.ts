import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { commonsFileUrl } from "./media-files";

/** The fixture holds the real upload URLs Commons reported for these files. */
const fixture = JSON.parse(readFileSync("tests/fixtures/commons/Mutesa_I.json", "utf8"));
const realUrl = (title: string) =>
  fixture.query.pages
    .find((p: { title: string }) => p.title === title)
    .imageinfo[0].url.split("?")[0];

describe("commonsFileUrl", () => {
  it("matches the real upload URL for small originals", () => {
    expect(commonsFileUrl("File:Mutesa I.jpg", 150)).toBe(realUrl("File:Mutesa I.jpg"));
    expect(commonsFileUrl("File:Buganda map.jpg", 840)).toBe(realUrl("File:Buganda map.jpg"));
  });

  it("uses a standard-width thumbnail for large images and unknown sizes", () => {
    expect(commonsFileUrl("File:Buganda map.jpg", 4000)).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Buganda_map.jpg/1280px-Buganda_map.jpg",
    );
    expect(commonsFileUrl("File:Buganda map.jpg", null)).toContain("/thumb/b/bd/");
  });

  it("renders SVGs to PNG thumbnails and encodes special characters", () => {
    const url = commonsFileUrl("File:Uganda - Location Map (2013) - UGA - UNOCHA.svg", 960);
    // Like MediaWiki, parentheses stay literal in file URLs.
    expect(url).toMatch(
      /\/thumb\/.+\/1280px-Uganda_-_Location_Map_\(2013\)_-_UGA_-_UNOCHA\.svg\.png$/,
    );
  });
});
