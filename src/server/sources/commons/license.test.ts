import { describe, expect, it } from "vitest";
import { resolveCommonsLicense, stripHtml } from "./license";

describe("resolveCommonsLicense", () => {
  it.each([
    [{ license: "pd", shortName: "Public domain" }, "PD", true],
    [{ license: "pd-old-100" }, "PD", true],
    [{ license: "cc0", shortName: "CC0" }, "CC0-1.0", true],
    [{ license: "cc-by-sa-4.0", shortName: "CC BY-SA 4.0" }, "CC-BY-SA-4.0", true],
    [{ license: "cc-by-2.5" }, "CC-BY-2.5", true],
    [{ license: "cc-by-sa-3.0-de" }, "CC-BY-SA-3.0", true],
    [{ license: "cc-by-nc-sa-4.0" }, "CC-BY-NC-SA-4.0", false],
    [{ license: "cc-by-nd-4.0" }, "CC-BY-ND-4.0", false],
  ])("%o → %s", (meta, code, publishable) => {
    const license = resolveCommonsLicense(meta);
    expect(license.code).toBe(code);
    expect(license.publishable).toBe(publishable);
  });

  it("treats anything unrecognised as UNKNOWN and not publishable", () => {
    for (const meta of [{}, { license: "fair use" }, { shortName: "Copyrighted" }, { license: "gfdl" }]) {
      const license = resolveCommonsLicense(meta);
      expect(license.code).toBe("UNKNOWN");
      expect(license.publishable).toBe(false);
    }
  });

  it("derives licence terms from the code", () => {
    expect(resolveCommonsLicense({ license: "cc-by-sa-4.0" })).toMatchObject({
      family: "CC_BY_SA",
      requiresAttribution: true,
      requiresShareAlike: true,
      allowsCommercialUse: true,
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
    });
    expect(resolveCommonsLicense({ license: "cc-by-nc-4.0" }).allowsCommercialUse).toBe(false);
  });
});

describe("stripHtml", () => {
  it("reduces Commons HTML fields to plain text", () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Jane &amp; Co</a>')).toBe("Jane & Co");
    expect(stripHtml("<p>Line one</p>\n<p>Line&nbsp;two</p>")).toBe("Line one Line two");
    expect(stripHtml('<script>alert(1)</script>Safe <b onclick="x()">text</b>')).toBe("Safe text");
    expect(stripHtml('Unknown author<span style="display: none;">Unknown author</span>')).toBe("Unknown author");
    expect(stripHtml(undefined)).toBe("");
  });
});
