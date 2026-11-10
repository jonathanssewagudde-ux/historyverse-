import { describe, expect, it } from "vitest";

import { categories, licenses } from "../../prisma/seed";

describe("reference data", () => {
  it("has unique licence codes and category slugs", () => {
    expect(new Set(licenses.map((l) => l.code)).size).toBe(licenses.length);
    expect(new Set(categories.map((c) => c.slug)).size).toBe(categories.length);
  });

  it("never marks restrictive or unknown licences as publishable", () => {
    for (const license of licenses) {
      const restrictive =
        license.allowsCommercialUse === false ||
        license.allowsDerivatives === false ||
        license.family === "UNKNOWN" ||
        license.family === "RIGHTS_RESERVED";
      if (restrictive) expect(license.publishable, license.code).toBe(false);
    }
  });

  it("requires attribution for every Creative Commons BY licence", () => {
    for (const license of licenses.filter((l) => l.code.startsWith("CC-BY"))) {
      expect(license.requiresAttribution, license.code).toBe(true);
      expect(license.url, license.code).toMatch(/^https:\/\/creativecommons\.org\/licenses\//);
    }
  });
});
