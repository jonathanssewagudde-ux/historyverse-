/**
 * Maps Wikimedia Commons licence metadata to HISTORYVERSE licence records. Pure and conservative:
 * anything not positively recognised becomes UNKNOWN, which is never publishable.
 */

export interface ResolvedLicense {
  code: string;
  name: string;
  family: "PUBLIC_DOMAIN" | "CC0" | "CC_BY" | "CC_BY_SA" | "CC_BY_NC" | "CC_BY_ND" | "UNKNOWN";
  url: string | null;
  requiresAttribution: boolean;
  allowsCommercialUse: boolean;
  allowsDerivatives: boolean;
  requiresShareAlike: boolean;
  publishable: boolean;
}

export const UNKNOWN_LICENSE: ResolvedLicense = {
  code: "UNKNOWN",
  name: "Unknown / not yet determined",
  family: "UNKNOWN",
  url: null,
  requiresAttribution: true,
  allowsCommercialUse: false,
  allowsDerivatives: false,
  requiresShareAlike: false,
  publishable: false,
};

const CC = "https://creativecommons.org";

export function resolveCommonsLicense(meta: { license?: string; shortName?: string; url?: string }): ResolvedLicense {
  const raw = (meta.license || meta.shortName || "").trim().toLowerCase().replace(/_/g, "-");
  const short = (meta.shortName || "").trim().toLowerCase();

  if (raw === "cc0" || short.startsWith("cc0")) {
    return { code: "CC0-1.0", name: "CC0 1.0 Universal", family: "CC0", url: `${CC}/publicdomain/zero/1.0/`, requiresAttribution: false, allowsCommercialUse: true, allowsDerivatives: true, requiresShareAlike: false, publishable: true };
  }
  if (raw === "pd" || raw.startsWith("pd-") || short === "public domain") {
    return { code: "PD", name: "Public domain", family: "PUBLIC_DOMAIN", url: `${CC}/publicdomain/mark/1.0/`, requiresAttribution: false, allowsCommercialUse: true, allowsDerivatives: true, requiresShareAlike: false, publishable: true };
  }

  // Creative Commons: "cc-by-sa-4.0", "cc-by-2.5", "cc-by-nc-nd-3.0", optionally with a jurisdiction.
  const match = /^cc-(by(?:-nc)?(?:-nd)?(?:-sa)?)-(\d\.\d)(?:-[a-z]{2,})?$/.exec(raw);
  if (!match) return UNKNOWN_LICENSE;
  const [, terms, version] = match as unknown as [string, string, string];
  const nc = terms.includes("-nc");
  const nd = terms.includes("-nd");
  const sa = terms.includes("-sa");
  const family = nc ? "CC_BY_NC" : nd ? "CC_BY_ND" : sa ? "CC_BY_SA" : "CC_BY";
  return {
    code: `CC-${terms.toUpperCase()}-${version}`,
    name: `CC ${terms.toUpperCase()} ${version}`,
    family,
    url: meta.url?.startsWith("http") ? meta.url.replace(/^http:/, "https:") : `${CC}/licenses/${terms}/${version}/`,
    requiresAttribution: true,
    allowsCommercialUse: !nc,
    allowsDerivatives: !nd,
    requiresShareAlike: sa,
    // HISTORYVERSE edits images and publishes to YouTube, so NC and ND material is not publishable.
    publishable: !nc && !nd,
  };
}

/** Commons metadata fields contain HTML. Reduce to plain text without interpreting any markup. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    // Commons repeats some values in hidden spans for machine readers; drop them.
    .replace(/<(\w+)[^>]*display:\s*none[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
