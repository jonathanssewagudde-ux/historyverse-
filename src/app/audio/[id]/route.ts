import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getStorage } from "@/server/storage";

const AUDIO_TYPES = new Set(["audio/wav", "audio/mpeg"]);
const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Narration audio for the Studio. Only signed-in staff can listen: narration is unpublished
 * production material. Supports byte ranges so players can seek.
 */
export async function GET(request: Request, { params }: RouteContext<"/audio/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFound();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "studio:access")) return notFound();

  const take = await getDb().voiceover.findUnique({ where: { id } });
  if (!take?.storageKey || !take.mimeType || !AUDIO_TYPES.has(take.mimeType)) return notFound();
  const body = await getStorage().get(take.storageKey);
  if (!body) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": take.mimeType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const size = body.byteLength;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const slice = body.subarray(start, end + 1);
    return new Response(slice as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }
  return new Response(body as unknown as BodyInit, {
    headers: { ...headers, "Content-Length": String(body.byteLength) },
  });
}
