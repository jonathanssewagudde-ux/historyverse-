import "server-only";

import type { MediaKind, MediaReviewStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { mediaPublishBlocker } from "@/server/content/publish";
import type { StorageProvider } from "@/server/providers/contracts";
import { contentKey } from "@/server/storage/local";

type Actor = { id: string; email?: string | null; role: Role };

/** Kinds a person can assign in the library. AI reconstructions are made in the AI Image Studio. */
export const LIBRARY_KINDS = [
  "UNCLASSIFIED",
  "AUTHENTIC_PHOTO",
  "AUTHENTIC_DOCUMENT",
  "ARTWORK",
  "MAP",
  "MODERN_PHOTO",
  "DIAGRAM",
] as const satisfies readonly MediaKind[];
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class MediaAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaAdminError";
  }
}

export interface MediaFilters {
  kind?: string;
  review?: string;
  q?: string;
}

export async function listMedia(db: PrismaClient, filters: MediaFilters = {}) {
  const where: Prisma.MediaAssetWhereInput = { deletedAt: null };
  if (
    filters.kind &&
    (LIBRARY_KINDS as readonly string[]).concat("AI_RECONSTRUCTION").includes(filters.kind)
  )
    where.kind = filters.kind as MediaKind;
  if (filters.review && ["PENDING", "APPROVED", "REJECTED"].includes(filters.review))
    where.reviewStatus = filters.review as MediaReviewStatus;
  const q = filters.q?.trim().slice(0, 100);
  if (q)
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { sourceRef: { contains: q, mode: "insensitive" } },
    ];
  const [assets, licenses] = await Promise.all([
    db.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { license: true, _count: { select: { articles: true } } },
    }),
    db.mediaLicense.findMany({ orderBy: { name: "asc" } }),
  ]);
  return {
    licenses: licenses.map((l) => ({ id: l.id, name: l.name, publishable: l.publishable })),
    assets: assets.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      altText: a.altText,
      description: a.description,
      attribution: a.attribution,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      licenseId: a.licenseId,
      license: a.license.name,
      publishable: a.license.publishable,
      stored: Boolean(a.storageKey),
      previewable: Boolean(a.storageKey && a.mimeType?.startsWith("image/")),
      reviewStatus: a.reviewStatus,
      blocker: mediaPublishBlocker(a),
      articles: a._count.articles,
      isCommons: a.sourceName === "Wikimedia Commons" && Boolean(a.sourceRef),
    })),
  };
}

export type MediaRow = Awaited<ReturnType<typeof listMedia>>["assets"][number];

export interface MediaEdit {
  title: string;
  kind: string;
  altText: string;
  description: string;
  attribution: string;
  licenseId: string;
}

/**
 * Classify and describe an asset. Changing what an approved asset is, or its licence, sends it
 * back to review: an approval covers the asset as it was when it was approved.
 */
export async function updateMedia(db: PrismaClient, actor: Actor, id: string, edit: MediaEdit) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new MediaAdminError("You cannot edit media.");
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset || asset.deletedAt) throw new MediaAdminError("Media not found.");
  if (asset.kind === "AI_RECONSTRUCTION") {
    throw new MediaAdminError("AI reconstructions are managed in the AI Image Studio.");
  }
  if (!(LIBRARY_KINDS as readonly string[]).includes(edit.kind))
    throw new MediaAdminError("Choose what the image is.");
  const title = edit.title.trim();
  const attribution = edit.attribution.trim();
  if (title.length < 3) throw new MediaAdminError("Give the image a title.");
  if (attribution.length < 3)
    throw new MediaAdminError("Give the attribution line (creator, source).");
  const license = await db.mediaLicense.findUnique({ where: { id: edit.licenseId } });
  if (!license) throw new MediaAdminError("Choose a licence.");

  const material = edit.kind !== asset.kind || edit.licenseId !== asset.licenseId;
  const data = {
    title,
    kind: edit.kind as MediaKind,
    altText: edit.altText.trim() || null,
    description: edit.description.trim() || null,
    attribution,
    licenseId: license.id,
    ...(material && asset.reviewStatus === "APPROVED" ? { reviewStatus: "PENDING" as const } : {}),
  };
  await db.mediaAsset.update({ where: { id }, data });
  await recordAudit({
    action: "media.updated",
    actor,
    target: { type: "media", id },
    metadata: {
      kind: [asset.kind, data.kind],
      license: [asset.licenseId, data.licenseId],
      backToReview: material && asset.reviewStatus === "APPROVED",
    },
  });
}

/** Approve or reject an asset for public use. */
export async function reviewMedia(
  db: PrismaClient,
  actor: Actor,
  id: string,
  decision: "APPROVED" | "REJECTED",
) {
  if (!hasPermission(actor.role, "media:approve"))
    throw new MediaAdminError("Only editors can approve media.");
  const asset = await db.mediaAsset.findUnique({ where: { id }, include: { license: true } });
  if (!asset || asset.deletedAt) throw new MediaAdminError("Media not found.");
  if (decision === "APPROVED") {
    const blocker = mediaPublishBlocker(asset);
    if (blocker) throw new MediaAdminError(`Cannot approve: ${blocker}.`);
    if (!asset.altText || asset.altText.trim().length < 5) {
      throw new MediaAdminError("Cannot approve: add alt text describing the image first.");
    }
  }
  await db.mediaAsset.update({ where: { id }, data: { reviewStatus: decision } });
  await recordAudit({
    action: decision === "APPROVED" ? "media.approved" : "media.rejected",
    actor,
    target: { type: "media", id },
    metadata: { kind: asset.kind, license: asset.license.code },
  });
}

/** Recognise the file type from its first bytes; the browser-supplied type is not trusted. */
export function sniffImageType(body: Uint8Array): { mime: string; ext: string } | null {
  const b = body;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { mime: "image/png", ext: "png" };
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return { mime: "image/webp", ext: "webp" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return { mime: "image/gif", ext: "gif" };
  return null;
}

/** Pixel size from PNG/JPEG/GIF headers (best effort; null when unknown). */
export function imageSize(
  body: Uint8Array,
  mime: string,
): { width: number; height: number } | null {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  try {
    if (mime === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (mime === "image/gif")
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < body.length) {
        if (body[i] !== 0xff) return null;
        const marker = body[i + 1]!;
        const length = view.getUint16(i + 2);
        // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
        }
        i += 2 + length;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export interface UploadInput {
  body: Uint8Array;
  title: string;
  kind: string;
  licenseId: string;
  attribution: string;
  altText: string;
  sourceName: string;
  sourceUrl: string;
}

/**
 * Store an uploaded image as a pending library asset. The uploader states the licence and
 * attribution; an editor confirms them when approving.
 */
export async function uploadMedia(
  db: PrismaClient,
  storage: StorageProvider,
  actor: Actor,
  input: UploadInput,
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new MediaAdminError("You cannot upload media.");
  if (input.body.byteLength === 0) throw new MediaAdminError("Choose an image file.");
  if (input.body.byteLength > MAX_UPLOAD_BYTES)
    throw new MediaAdminError("Images must be 10 MB or smaller.");
  const type = sniffImageType(input.body);
  if (!type) throw new MediaAdminError("Only JPEG, PNG, WebP and GIF images can be uploaded.");
  if (!(LIBRARY_KINDS as readonly string[]).includes(input.kind))
    throw new MediaAdminError("Choose what the image is.");
  const title = input.title.trim();
  const attribution = input.attribution.trim();
  const sourceName = input.sourceName.trim();
  if (title.length < 3) throw new MediaAdminError("Give the image a title.");
  if (attribution.length < 3)
    throw new MediaAdminError("Give the attribution line (creator, source).");
  if (sourceName.length < 2) throw new MediaAdminError("Say where the image comes from.");
  let sourceUrl: string | null = null;
  if (input.sourceUrl.trim()) {
    try {
      const url = new URL(input.sourceUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad scheme");
      sourceUrl = url.toString();
    } catch {
      throw new MediaAdminError("The source URL is not a valid web address.");
    }
  }
  const license = await db.mediaLicense.findUnique({ where: { id: input.licenseId } });
  if (!license) throw new MediaAdminError("Choose a licence.");

  const { key, sha256 } = contentKey(input.body, type.ext);
  const duplicate = await db.mediaAsset.findUnique({ where: { checksum: sha256 } });
  if (duplicate)
    throw new MediaAdminError(`This file is already in the library as “${duplicate.title}”.`);

  await storage.put(key, input.body, type.mime);
  const size = imageSize(input.body, type.mime);
  const asset = await db.mediaAsset.create({
    data: {
      kind: input.kind as MediaKind,
      title,
      altText: input.altText.trim() || null,
      attribution,
      sourceName,
      sourceUrl,
      licenseId: license.id,
      storageKey: key,
      checksum: sha256,
      mimeType: type.mime,
      bytes: BigInt(input.body.byteLength),
      width: size?.width ?? null,
      height: size?.height ?? null,
      uploadedById: actor.id,
    },
  });
  await recordAudit({
    action: "media.uploaded",
    actor,
    target: { type: "media", id: asset.id },
    metadata: { bytes: input.body.byteLength, mime: type.mime, license: license.code },
  });
  return asset.id;
}
