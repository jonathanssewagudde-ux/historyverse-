import { describe, expect, it } from "vitest";
import * as content from "./homepage";

const topicLists = {
  ancientCivilizations: content.ancientCivilizations,
  monarchs: content.monarchs,
  worldLeaders: content.worldLeaders,
  africanKingdoms: content.africanKingdoms,
  historicalMysteries: content.historicalMysteries,
  famousFigures: content.famousFigures,
  featuredStories: content.featuredStories,
};

describe("homepage curation (editorial rule: names and regions only)", () => {
  it.each(Object.entries(topicLists))("%s contains no dates or numeric claims", (_, topics) => {
    for (const t of topics) {
      expect(t.context, t.name).not.toMatch(/\d/);
      if ("summary" in t) expect(t.summary, t.name).not.toMatch(/\d/);
    }
  });

  it.each(Object.entries(topicLists))("%s marks nothing as published", (_, topics) => {
    // Nothing is published until the article system and editorial review exist.
    for (const t of topics) expect(t.status).not.toBe("published");
  });

  it.each(Object.entries(topicLists))("%s has unique names", (_, topics) => {
    const names = topics.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("lists the seven continents", () => {
    expect(content.continents.map((c) => c.name)).toHaveLength(7);
  });
});
