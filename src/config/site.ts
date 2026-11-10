/**
 * Public, non-secret site configuration. Safe to import from client and server code.
 */
export const siteConfig = {
  name: "HISTORYVERSE",
  studioName: "HISTORYVERSE AI Studio",
  tagline: "Every Story. Every Civilization. Every Century.",
  description:
    "An AI-assisted historical knowledge platform: sourced articles, authentic archives, interactive maps and timelines, and documentaries.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "en",
} as const;

/** Interface languages planned for HISTORYVERSE (Milestone 14). English ships first. */
export const supportedLocales = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "pt", name: "Português", dir: "ltr" },
  { code: "sw", name: "Kiswahili", dir: "ltr" },
  { code: "de", name: "Deutsch", dir: "ltr" },
  { code: "zh", name: "中文", dir: "ltr" },
  { code: "hi", name: "हिन्दी", dir: "ltr" },
] as const;

export type LocaleCode = (typeof supportedLocales)[number]["code"];
