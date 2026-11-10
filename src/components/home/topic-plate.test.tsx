import { describe, expect, it } from "vitest";
import { initials } from "./topic-plate";

describe("initials", () => {
  it.each([
    ["Ancient Egypt", "E"],
    ["Indus Valley Civilisation", "IC"],
    ["Mutesa I", "M"],
    ["Elizabeth I", "E"],
    ["Kingdom of Buganda", "B"],
    ["The Fate of the Library of Alexandria", "FA"],
    ["Bunyoro-Kitara", "BK"],
    ["Nelson Mandela", "NM"],
    ["Ibn Sina", "IS"],
  ])("%s → %s", (name, expected) => expect(initials(name)).toBe(expected));
});
