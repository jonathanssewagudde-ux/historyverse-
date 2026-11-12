import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { notFoundResponse, serveStored } from "@/server/media/serve";
import { getStorage } from "@/server/storage";

const TYPES = new Set(["audio/wav", "audio/mpeg", "application/x-subrip", "text/vtt"]);

/** Music tracks and caption files, for staff. Captions download with a readable file name. */
export async function GET(request: Request, { params }: RouteContext<"/video-assets/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFoundResponse();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "studio:access")) return notFoundResponse();

  const asset = await getDb().videoAsset.findUnique({
    where: { id },
    include: { documentary: { select: { slug: true } } },
  });
  if (!asset?.mimeType || !TYPES.has(asset.mimeType)) return notFoundResponse();
  const caption = asset.kind === "SUBTITLES";
  const ext = asset.mimeType === "text/vtt" ? "vtt" : "srt";
  const download =
    caption && new URL(request.url).searchParams.has("download")
      ? `${asset.documentary?.slug ?? "captions"}-${asset.language ?? "en"}.${ext}`
      : undefined;
  // Caption files are served as plain text so they open safely in a browser tab.
  const type = caption && !download ? "text/plain; charset=utf-8" : asset.mimeType;
  return serveStored(request, getStorage(), asset.storageKey, type, { download });
}
