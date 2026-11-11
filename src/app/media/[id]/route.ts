import { connection } from "next/server";

import { hasPermission } from "@/lib/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { mediaPublishBlocker } from "@/server/content/publish";
import { getDb } from "@/server/db/client";
import { getStorage } from "@/server/storage";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Serves stored media files.
 *  - Approved, publishable images: public, cacheable.
 *  - Anything else: only to signed-in staff who can review media, never cached; 404 for others
 *    (so the existence of unpublished material is not revealed).
 */
export async function GET(_request: Request, { params }: RouteContext<"/media/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(id)) return notFound();

  const asset = await getDb().mediaAsset.findUnique({ where: { id }, include: { license: true } });
  if (
    !asset ||
    asset.deletedAt ||
    !asset.storageKey ||
    !asset.mimeType ||
    !IMAGE_TYPES.has(asset.mimeType)
  ) {
    return notFound();
  }

  const isPublic = asset.reviewStatus === "APPROVED" && !mediaPublishBlocker(asset);
  if (!isPublic) {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.role, "studio:access")) return notFound();
  }

  const body = await getStorage().get(asset.storageKey);
  if (!body) return notFound();

  return new Response(body as unknown as BodyInit, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Content-addressed files never change; public ones can be cached for a long time.
      "Cache-Control": isPublic
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : "private, no-store",
    },
  });
}
