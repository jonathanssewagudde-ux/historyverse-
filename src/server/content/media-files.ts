import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { StorageProvider } from "@/server/providers/contracts";
import type { SourceHttpClient } from "@/server/sources/http";
import { contentKey } from "@/server/storage/local";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Commons serves a rendered thumbnail of any image (SVG → PNG) at a requested width. */
export function commonsThumbnailUrl(sourceRef: string, width = 1600): string {
  const name = sourceRef.replace(/^File:/, "").replace(/ /g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`;
}

export interface FetchResult {
  mediaId: string;
  status: "stored" | "already-stored" | "failed" | "skipped";
  detail?: string;
}

/**
 * Download Commons files for the given media assets into storage. Files are content-addressed,
 * so re-running is cheap and never duplicates data. Only image types are accepted.
 */
export async function fetchCommonsMedia(
  deps: { db: PrismaClient; storage: StorageProvider; http: SourceHttpClient },
  mediaIds: string[],
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  for (const id of mediaIds) {
    const asset = await deps.db.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.sourceName !== "Wikimedia Commons" || !asset.sourceRef) {
      results.push({ mediaId: id, status: "skipped", detail: "not a Wikimedia Commons asset" });
      continue;
    }
    if (asset.storageKey && (await deps.storage.get(asset.storageKey))) {
      results.push({ mediaId: id, status: "already-stored" });
      continue;
    }
    try {
      const file = await deps.http.getBytes(commonsThumbnailUrl(asset.sourceRef));
      const mime = file.contentType.split(";")[0]!.trim().toLowerCase();
      const ext = EXTENSIONS[mime];
      if (!ext) throw new Error(`unexpected content type ${mime}`);
      const { key, sha256 } = contentKey(file.body, ext);
      await deps.storage.put(key, file.body, mime);
      await deps.db.mediaAsset.update({
        where: { id },
        data: {
          storageKey: key,
          checksum: sha256,
          mimeType: mime,
          bytes: BigInt(file.body.byteLength),
        },
      });
      results.push({ mediaId: id, status: "stored" });
    } catch (error) {
      results.push({
        mediaId: id,
        status: "failed",
        detail: error instanceof Error ? error.message : "error",
      });
    }
  }
  return results;
}
