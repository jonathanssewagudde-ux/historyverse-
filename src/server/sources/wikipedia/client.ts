import "server-only";

import type { SourceHttpClient } from "@/server/sources/http";

export interface WikipediaSummary {
  title: string;
  /** Plain-text lead extract. Licensed CC BY-SA 4.0: a research input, never copied into articles. */
  extract: string;
  url: string;
  revision: string;
  license: "CC BY-SA 4.0";
  retrievedAt: string;
}

export const wikipediaUrl = (title: string, lang = "en") =>
  `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

export function createWikipediaClient(http: SourceHttpClient, lang = "en") {
  return {
    async getSummary(title: string): Promise<WikipediaSummary> {
      const data = await http.getJson<{
        title: string;
        extract: string;
        revision: string;
        content_urls?: { desktop?: { page?: string } };
      }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      return {
        title: data.title,
        extract: data.extract,
        url: data.content_urls?.desktop?.page ?? wikipediaUrl(title, lang),
        revision: data.revision,
        license: "CC BY-SA 4.0",
        retrievedAt: new Date().toISOString(),
      };
    },
  };
}
