import { describe, expect, it } from "vitest";
import { compileCitations } from "./citations";

describe("compileCitations", () => {
  it("numbers markers and reuses positions for identical citations", () => {
    const { body, citations } = compileCitations(
      "One.[@loc|Trade] Two.[@wd] Three.[@loc|Trade] Four.[@loc|Colonial era]",
    );
    expect(body).toBe("One.[^1] Two.[^2] Three.[^1] Four.[^3]");
    expect(citations).toEqual([
      { sourceKey: "loc", locator: "Trade" },
      { sourceKey: "wd", locator: null },
      { sourceKey: "loc", locator: "Colonial era" },
    ]);
  });

  it("leaves text without markers unchanged", () => {
    expect(compileCitations("No citations here.")).toEqual({ body: "No citations here.", citations: [] });
  });
});
