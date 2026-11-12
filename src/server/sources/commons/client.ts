import "server-only";

import type { SourceHttpClient } from "@/server/sources/http";
import { resolveCommonsLicense, stripHtml, type ResolvedLicense } from "./license";

export interface CommonsFile {
  /** Canonical title including the "File:" prefix. */
  title: string;
  descriptionUrl: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  sha1: string | null;
  description: string | null;
  creator: string | null;
  credit: string | null;
  dateText: string | null;
  license: ResolvedLicense;
  attribution: string;
  /** Rights wording as Commons states it (e.g. a usage-terms note). */
  usageTerms: string | null;
  /** Provider-hosted preview (only present when a thumbnail width was requested). */
  thumbnailUrl: string | null;
}

interface ImageInfoResponse {
  query?: {
    pages?: Array<{
      title: string;
      missing?: boolean;
      imageinfo?: Array<{
        url: string;
        descriptionurl: string;
        mime: string;
        width: number;
        height: number;
        sha1?: string;
        thumburl?: string;
        extmetadata?: Record<string, { value: string } | undefined>;
      }>;
    }>;
  };
}

export function parseCommonsFiles(response: ImageInfoResponse): CommonsFile[] {
  return (response.query?.pages ?? []).flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (page.missing || !info) return [];
    const meta = info.extmetadata ?? {};
    const text = (key: string) => stripHtml(meta[key]?.value) || null;
    const license = resolveCommonsLicense({
      license: meta.License?.value,
      shortName: meta.LicenseShortName?.value,
      url: meta.LicenseUrl?.value,
    });
    const creator = text("Artist");
    return [
      {
        title: page.title,
        descriptionUrl: info.descriptionurl,
        url: info.url,
        mimeType: info.mime,
        width: info.width,
        height: info.height,
        sha1: info.sha1 ?? null,
        description: text("ImageDescription"),
        creator,
        credit: text("Credit"),
        dateText: text("DateTimeOriginal"),
        license,
        attribution: [creator ?? "Unknown author", "via Wikimedia Commons", license.name].join(
          ", ",
        ),
        usageTerms: text("UsageTerms"),
        thumbnailUrl: info.thumburl ?? null,
      },
    ];
  });
}

/** Wikimedia Commons file metadata, including the licence and attribution data needed for reuse. */
export function createCommonsClient(http: SourceHttpClient) {
  return {
    async getFiles(fileNames: string[]): Promise<CommonsFile[]> {
      const out: CommonsFile[] = [];
      for (let i = 0; i < fileNames.length; i += 25) {
        const titles = fileNames
          .slice(i, i + 25)
          .map((n) => (n.startsWith("File:") ? n : `File:${n}`))
          .join("|");
        const url =
          "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo" +
          `&iiprop=${encodeURIComponent("url|size|mime|extmetadata|sha1")}&titles=${encodeURIComponent(titles)}`;
        out.push(...parseCommonsFiles(await http.getJson<ImageInfoResponse>(url)));
      }
      return out;
    },
    /**
     * Search Commons files (images only) by text. Returns full licence metadata for each hit,
     * plus a 320-pixel preview URL, in search-relevance order.
     */
    async search(query: string, limit = 24): Promise<CommonsFile[]> {
      const url =
        "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
        `&generator=search&gsrnamespace=6&gsrlimit=${Math.min(50, limit)}` +
        `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap|drawing`)}` +
        `&prop=imageinfo&iiurlwidth=320&iiprop=${encodeURIComponent("url|size|mime|extmetadata|sha1")}`;
      const data = await http.getJson<
        ImageInfoResponse & { query?: { pages?: { index?: number }[] } }
      >(url);
      const order = new Map(
        (data.query?.pages ?? []).map((p) => [
          (p as { title: string }).title,
          (p as { index?: number }).index ?? 0,
        ]),
      );
      return parseCommonsFiles(data).sort(
        (a, b) => (order.get(a.title) ?? 0) - (order.get(b.title) ?? 0),
      );
    },
  };
}
