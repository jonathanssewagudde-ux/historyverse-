import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { createJob, JobServiceError, userIdOf } from "@/server/jobs/service";
import { JobCancelledError, PermanentJobError, type JobHandler } from "@/server/jobs/types";
import type { CommonsFile } from "@/server/sources/commons/client";
import type { SourceHttpClient } from "@/server/sources/http";

type Actor = { id: string; email?: string | null; role: Role };

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}

export interface DiscoveryDeps {
  commons: { search(query: string, limit?: number): Promise<CommonsFile[]> };
  http: SourceHttpClient;
  locEnabled: boolean;
  now?: () => Date;
}

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/svg+xml",
]);

/**
 * Library of Congress items with images. Search results do not carry a licence, so every item
 * is recorded with an UNKNOWN licence and the reviewer reads the item's rights advisory.
 */
async function searchLocImages(http: SourceHttpClient, query: string) {
  const url = `https://www.loc.gov/photos/?q=${encodeURIComponent(query)}&fo=json&c=12`;
  const data = await http.getJson<{
    results?: {
      title?: string;
      url?: string;
      id?: string;
      date?: string;
      image_url?: string[];
      description?: string[];
    }[];
  }>(url);
  return (data.results ?? [])
    .map((r) => ({
      title: r.title ?? "",
      url: r.url ?? r.id ?? "",
      date: r.date ?? null,
      thumbnail: r.image_url?.[0]?.replace(/#.*$/, "") ?? null,
      description: r.description?.[0] ?? null,
    }))
    .filter((r) => r.title && /^https:\/\/www\.loc\.gov\/(item|pictures|resource)\//.test(r.url));
}

/**
 * Pipeline step 3: find archival images for the project's subject. Free sources only; nothing
 * enters the media library until a person selects an image and confirms its licence.
 */
export function createMediaSearchHandler(deps: DiscoveryDeps): JobHandler {
  return async (ctx) => {
    const { db } = ctx;
    const now = deps.now ?? (() => new Date());
    if (!ctx.projectId) throw new PermanentJobError("Media searches belong to a project.");
    const project = await db.contentProject.findUniqueOrThrow({
      where: { id: ctx.projectId },
      include: { primaryEntity: { include: { aliases: true } } },
    });
    if (!project.primaryEntity)
      throw new PermanentJobError("Research has not identified the subject yet.");
    const query = (ctx.input.query as string | undefined)?.trim() || project.primaryEntity.name;
    const warnings: string[] = [];
    let found = 0;

    await ctx.progress(10, `Searching Wikimedia Commons for “${query}”`);
    const files = await deps.commons.search(query, 30);
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.mimeType)) continue;
      await db.mediaCandidate.upsert({
        where: {
          projectId_provider_sourceRef: {
            projectId: project.id,
            provider: "commons",
            sourceRef: file.title,
          },
        },
        create: {
          projectId: project.id,
          provider: "commons",
          sourceRef: file.title,
          title: file.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
          sourceUrl: file.descriptionUrl,
          thumbnailUrl: file.thumbnailUrl,
          mimeType: file.mimeType,
          width: file.width,
          height: file.height,
          creator: file.creator,
          dateText: file.dateText,
          description: file.description?.slice(0, 1000) ?? null,
          licenseCode: file.license.code,
          licenseName: file.license.name,
          rightsStatement: file.usageTerms,
          attribution: file.attribution,
          retrievedAt: now(),
        },
        // Refresh what the archive says, never a person's decision.
        update: {
          thumbnailUrl: file.thumbnailUrl,
          licenseCode: file.license.code,
          licenseName: file.license.name,
          rightsStatement: file.usageTerms,
          attribution: file.attribution,
          retrievedAt: now(),
        },
      });
      found += 1;
    }
    if (await ctx.isCancelled()) throw new JobCancelledError();

    if (deps.locEnabled) {
      await ctx.progress(60, "Searching the Library of Congress");
      try {
        for (const item of await searchLocImages(deps.http, query)) {
          await db.mediaCandidate.upsert({
            where: {
              projectId_provider_sourceRef: {
                projectId: project.id,
                provider: "loc",
                sourceRef: item.url,
              },
            },
            create: {
              projectId: project.id,
              provider: "loc",
              sourceRef: item.url,
              title: item.title.slice(0, 300),
              sourceUrl: item.url,
              thumbnailUrl: item.thumbnail,
              dateText: item.date,
              description: item.description?.slice(0, 1000) ?? null,
              licenseCode: "UNKNOWN",
              licenseName: "Not stated in search results",
              rightsStatement: "Read the Rights Advisory on the item page before selecting.",
              attribution: "Library of Congress",
              retrievedAt: now(),
            },
            update: { thumbnailUrl: item.thumbnail, retrievedAt: now() },
          });
          found += 1;
        }
      } catch (error) {
        warnings.push(
          `Library of Congress could not be searched: ${(error as Error).message.slice(0, 160)}`,
        );
      }
    }

    return { output: { query, found, warnings } };
  };
}

export async function requestMediaSearch(
  db: PrismaClient,
  actor: Actor,
  projectId: string,
  query = "",
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new DiscoveryError("You cannot search for media.");
  const project = await db.contentProject.findUnique({ where: { id: projectId } });
  if (!project) throw new DiscoveryError("Project not found.");
  if (!project.primaryEntityId)
    throw new DiscoveryError("Run research first: the subject is not known yet.");
  try {
    return await createJob(db, actor, {
      projectId,
      type: "MEDIA_SEARCH",
      input: query.trim() ? { query: query.trim().slice(0, 120) } : {},
    });
  } catch (error) {
    if (error instanceof JobServiceError) throw new DiscoveryError(error.message);
    throw error;
  }
}

/**
 * Select a discovered image: the person confirms they checked the licence on the source page.
 * It enters the media library as an unclassified, pending asset linked to the subject; it can be
 * shown to readers only after classification, download and editor approval, like any asset.
 */
export async function selectCandidate(
  db: PrismaClient,
  actor: Actor,
  candidateId: string,
  input: { licenseConfirmed: boolean; note?: string },
) {
  if (!hasPermission(actor.role, "media:upload")) throw new DiscoveryError("You cannot add media.");
  if (!input.licenseConfirmed) {
    throw new DiscoveryError("Confirm that you checked the licence on the source page.");
  }
  const candidate = await db.mediaCandidate.findUnique({
    where: { id: candidateId },
    include: { project: true },
  });
  if (!candidate) throw new DiscoveryError("Image not found.");
  if (candidate.status === "SELECTED")
    throw new DiscoveryError("This image is already in the library.");
  const license =
    (await db.mediaLicense.findUnique({ where: { code: candidate.licenseCode } })) ??
    (await db.mediaLicense.findUniqueOrThrow({ where: { code: "UNKNOWN" } }));
  const sourceName = candidate.provider === "commons" ? "Wikimedia Commons" : "Library of Congress";
  const now = new Date();
  const verifiedBy = userIdOf(actor);

  const mediaId = await db.$transaction(async (tx) => {
    const existing = await tx.mediaAsset.findUnique({
      where: { sourceName_sourceRef: { sourceName, sourceRef: candidate.sourceRef } },
    });
    const asset =
      existing ??
      (await tx.mediaAsset.create({
        data: {
          kind: "UNCLASSIFIED",
          title: candidate.title.slice(0, 300),
          description: candidate.description,
          creator: candidate.creator,
          sourceName,
          sourceUrl: candidate.sourceUrl,
          sourceRef: candidate.sourceRef,
          licenseId: license.id,
          attribution: candidate.attribution,
          mimeType: candidate.mimeType,
          width: candidate.width,
          height: candidate.height,
          uploadedById: verifiedBy,
          licenseVerifiedAt: now,
          licenseVerifiedById: verifiedBy,
        },
      }));
    if (existing && !existing.licenseVerifiedAt) {
      await tx.mediaAsset.update({
        where: { id: existing.id },
        data: { licenseVerifiedAt: now, licenseVerifiedById: verifiedBy },
      });
    }
    if (candidate.project.primaryEntityId) {
      await tx.entityMedia.upsert({
        where: {
          entityId_mediaId: { entityId: candidate.project.primaryEntityId, mediaId: asset.id },
        },
        create: { entityId: candidate.project.primaryEntityId, mediaId: asset.id, role: "gallery" },
        update: {},
      });
    }
    await tx.mediaCandidate.update({
      where: { id: candidate.id },
      data: {
        status: "SELECTED",
        mediaId: asset.id,
        reviewedById: verifiedBy,
        reviewedAt: now,
        note: input.note?.trim() || candidate.note,
      },
    });
    return asset.id;
  });

  await recordAudit({
    action: "media_candidate.selected",
    actor,
    target: { type: "media", id: mediaId },
    metadata: { candidateId, license: license.code, sourceRef: candidate.sourceRef },
  });
  return { mediaId, license: license.code, publishable: license.publishable };
}

export async function rejectCandidate(
  db: PrismaClient,
  actor: Actor,
  candidateId: string,
  note: string,
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new DiscoveryError("You cannot review media.");
  if (note.trim().length < 3) throw new DiscoveryError("Say briefly why the image is rejected.");
  const candidate = await db.mediaCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new DiscoveryError("Image not found.");
  if (candidate.status === "SELECTED") {
    throw new DiscoveryError("This image is already in the library; reject it there instead.");
  }
  await db.mediaCandidate.update({
    where: { id: candidateId },
    data: {
      status: "REJECTED",
      reviewedById: userIdOf(actor),
      reviewedAt: new Date(),
      note: note.trim(),
    },
  });
  await recordAudit({
    action: "media_candidate.rejected",
    actor,
    target: { type: "media_candidate", id: candidateId },
    metadata: { note: note.trim() },
  });
}
