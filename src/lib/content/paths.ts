/** Public URL of an article, by template. Templates without public pages yet return null. */
export function articlePath(template: string, slug: string): string | null {
  switch (template) {
    case "KINGDOM":
      return `/kingdoms/${slug}`;
    case "COUNTRY":
      return `/countries/${slug}`;
    case "BIOGRAPHY":
    case "MONARCH":
    case "PRESIDENT":
      return `/people/${slug}`;
    default:
      return null;
  }
}

/** Which templates each public section shows. */
export const sectionTemplates = {
  kingdoms: ["KINGDOM"],
  countries: ["COUNTRY"],
  people: ["BIOGRAPHY", "MONARCH", "PRESIDENT"],
} as const;

export type PublicSection = keyof typeof sectionTemplates;
