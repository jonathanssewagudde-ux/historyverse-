import "server-only";

import type { SourceHttpClient } from "@/server/sources/http";
import { isQid } from "@/server/sources/wikidata/client";
import { wikipediaUrl } from "@/server/sources/wikipedia/client";

/**
 * Free, keyless research sources. Every function returns provenance (URL, retrieval time) with
 * its results, and none of them interprets the content: that is the reviewer's job.
 */

export interface WikidataHit {
  qid: string;
  label: string;
  description: string | null;
}

/** Wikidata's own entity search (labels and aliases), best match first. */
export async function searchWikidata(
  http: SourceHttpClient,
  query: string,
  limit = 5,
): Promise<WikidataHit[]> {
  const url =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&uselang=en&type=item" +
    `&limit=${limit}&search=${encodeURIComponent(query)}`;
  const data = await http.getJson<{
    search?: { id: string; label?: string; description?: string }[];
  }>(url);
  return (data.search ?? [])
    .filter((h) => isQid(h.id))
    .map((h) => ({ qid: h.id, label: h.label ?? h.id, description: h.description ?? null }));
}

export interface WikipediaSection {
  heading: string;
  text: string;
}

export interface WikipediaArticleText {
  title: string;
  url: string;
  sections: WikipediaSection[];
  retrievedAt: string;
}

const MAX_SECTION_CHARS = 2400;
const SKIP_SECTIONS =
  /^(see also|references|notes|further reading|external links|bibliography|sources|citations|gallery)$/i;

/** Split TextExtracts plain text ("== Heading ==" markers) into sections. Exported for tests. */
export function splitSections(extract: string): WikipediaSection[] {
  const sections: WikipediaSection[] = [];
  let heading = "Introduction";
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text && !SKIP_SECTIONS.test(heading)) {
      sections.push({
        heading,
        text: text.length > MAX_SECTION_CHARS ? `${text.slice(0, MAX_SECTION_CHARS)} …` : text,
      });
    }
    buffer = [];
  };
  for (const line of extract.split("\n")) {
    const match = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line.trim());
    if (match) {
      flush();
      heading = match[2]!;
    } else buffer.push(line);
  }
  flush();
  return sections;
}

/** Plain text of a Wikipedia article by section (CC BY-SA 4.0: research input only). */
export async function getWikipediaText(
  http: SourceHttpClient,
  title: string,
  lang = "en",
): Promise<WikipediaArticleText | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts` +
    `&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(title)}`;
  const data = await http.getJson<{
    query?: { pages?: { title: string; missing?: boolean; extract?: string }[] };
  }>(url);
  const page = data.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  return {
    title: page.title,
    url: wikipediaUrl(page.title, lang),
    sections: splitSections(page.extract).slice(0, 14),
    retrievedAt: new Date().toISOString(),
  };
}

export interface BookHit {
  title: string;
  authors: string[];
  firstPublished: number | null;
  url: string;
  isbn: string | null;
}

/** Books on the topic from the Open Library catalogue (Internet Archive). */
export async function searchOpenLibrary(
  http: SourceHttpClient,
  query: string,
  limit = 10,
): Promise<BookHit[]> {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}` +
    "&fields=key,title,author_name,first_publish_year,isbn";
  const data = await http.getJson<{
    docs?: {
      key: string;
      title: string;
      author_name?: string[];
      first_publish_year?: number;
      isbn?: string[];
    }[];
  }>(url);
  return (data.docs ?? [])
    .filter((d) => d.key?.startsWith("/works/") && d.title)
    .map((d) => ({
      title: d.title,
      authors: d.author_name?.slice(0, 5) ?? [],
      firstPublished: d.first_publish_year ?? null,
      url: `https://openlibrary.org${d.key}`,
      isbn: d.isbn?.[0] ?? null,
    }));
}

export interface ArchiveHit {
  title: string;
  date: string | null;
  formats: string[];
  url: string;
}

/** Items in the Library of Congress collections (documents, maps, photographs, books). */
export async function searchLibraryOfCongress(
  http: SourceHttpClient,
  query: string,
  limit = 10,
): Promise<ArchiveHit[]> {
  const url = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=${limit}`;
  const data = await http.getJson<{
    results?: {
      title?: string;
      date?: string;
      original_format?: string[];
      id?: string;
      url?: string;
    }[];
  }>(url);
  return (data.results ?? [])
    .map((r) => ({
      title: r.title ?? "",
      date: r.date ?? null,
      formats: r.original_format ?? [],
      url: r.url ?? r.id ?? "",
    }))
    .filter((r) => r.title && /^https:\/\/www\.loc\.gov\//.test(r.url));
}
