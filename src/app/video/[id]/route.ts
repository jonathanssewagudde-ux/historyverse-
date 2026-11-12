import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { notFoundResponse, serveStored } from "@/server/media/serve";
import { getStorage } from "@/server/storage";

/**
 * A rendered documentary for staff review. Renders are unpublished until an administrator
 * approves publication, so they are never public. `?download=1` saves the MP4.
 */
export async function GET(request: Request, { params }: RouteContext<"/video/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFoundResponse();
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "studio:access")) return notFoundResponse();

  const render = await getDb().videoRender.findUnique({
    where: { id },
    include: { documentary: { select: { slug: true } } },
  });
  if (render?.status !== "SUCCEEDED" || !render.storageKey) return notFoundResponse();
  const download = new URL(request.url).searchParams.has("download")
    ? `${render.documentary.slug}-${render.format.toLowerCase()}.mp4`
    : undefined;
  return serveStored(request, getStorage(), render.storageKey, "video/mp4", { download });
}
