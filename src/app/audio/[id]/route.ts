import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { notFoundResponse, serveStored } from "@/server/media/serve";
import { getStorage } from "@/server/storage";

const AUDIO_TYPES = new Set(["audio/wav", "audio/mpeg"]);

/**
 * Narration audio for the Studio. Only signed-in staff can listen: narration is unpublished
 * production material. Supports byte ranges so players can seek.
 */
export async function GET(request: Request, { params }: RouteContext<"/audio/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFoundResponse();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "studio:access")) return notFoundResponse();

  const take = await getDb().voiceover.findUnique({ where: { id } });
  if (!take?.storageKey || !take.mimeType || !AUDIO_TYPES.has(take.mimeType)) {
    return notFoundResponse();
  }
  return serveStored(request, getStorage(), take.storageKey, take.mimeType);
}
