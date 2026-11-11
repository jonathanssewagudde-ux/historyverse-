import "server-only";

import { createHash } from "node:crypto";

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

/** One of Wikimedia's standard thumbnail widths; other widths may be refused. */
export const THUMBNAIL_WIDTH = 1280;

/**
 * Direct URL of a Commons file on upload.wikimedia.org. Files live under a path derived from the
 * MD5 of their underscored name, e.g. "Mutesa_I.jpg" → /6/6e/Mutesa_I.jpg. Going straight to the
 * upload server avoids a redirect through commons.wikimedia.org (one request instead of two).
 *
 * The original is used when it is small enough; larger images and SVGs (which browsers should
 * not be served from our storage as-is) use a rendered thumbnail of a standard width.
 */
export function commonsFileUrl(sourceRef: string, originalWidth: number | null): string {
  const name = sourceRef.replace(/^File:/, "").replace(/ /g, "_");
  const hash = createHash("md5").update(name).digest("hex");
  const dir = `${hash[0]}/${hash.slice(0, 2)}`;
  const encoded = encodeURIComponent(name);
  const isSvg = /\.svg$/i.test(name);
  if (!isSvg && originalWidth !== null && originalWidth <= THUMBNAIL_WIDTH) {
    return `https://upload.wikimedia.org/wikipedia/commons/${dir}/${encoded}`;
  }
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${encoded}/${THUMBNAIL_WIDTH}px-${encoded}${isSvg ? ".png" : ""}`;
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
      const file = await deps.http.getBytes(commonsFileUrl(asset.sourceRef, asset.width));
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
