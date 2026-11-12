import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { notFoundResponse, serveStored } from "@/server/media/serve";
import { getStorage } from "@/server/storage";

/** Generated thumbnails, for staff (they are published with the video, never before). */
export async function GET(request: Request, { params }: RouteContext<"/thumbnails/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFoundResponse();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "studio:access")) return notFoundResponse();

  const thumb = await getDb().thumbnail.findUnique({ where: { id } });
  if (!thumb?.storageKey) return notFoundResponse();
  return serveStored(request, getStorage(), thumb.storageKey, "image/jpeg");
}
