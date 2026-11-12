import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { getImageModel, type ConfiguredImageModel } from "@/server/ai/images";
import { recordAudit } from "@/server/audit";
import { formatDateRowRange } from "@/server/history/date-row";
import { createJob, JobServiceError, userIdOf } from "@/server/jobs/service";
import { PermanentJobError, type JobHandler } from "@/server/jobs/types";
import { ProviderUnavailableError, type StorageProvider } from "@/server/providers/contracts";
import { contentKey } from "@/server/storage/local";
import { imageSize, MAX_UPLOAD_BYTES, sniffImageType } from "@/server/admin/media";

type Actor = { id: string; email?: string | null; role: Role };

export class ReconstructionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconstructionError";
  }
}

export const DEFAULT_NEGATIVE_PROMPT =
  "text, captions, watermarks, logos, modern clothing, modern buildings, vehicles, electric lights, plastic, photographic portrait of a real identifiable person";

const EDITABLE = ["PROMPT_DRAFT", "FAILED", "REJECTED"] as const;

export interface ReconstructionInput {
  projectId?: string | null;
  entityId?: string | null;
  prompt: string;
  negativePrompt: string;
  evidenceNotes: string;
  interpretationNotes: string;
  sources: { sourceId: string; note: string }[];
}

/**
 * A reconstruction prompt must say what rests on evidence (with at least one cited source and
 * what it supports) and what is interpretation. These notes travel with every image made from it.
 */
function validate(input: ReconstructionInput) {
  const prompt = input.prompt.trim();
  if (prompt.length < 20 || prompt.length > 3000)
    throw new ReconstructionError("The prompt must be 20 to 3,000 characters.");
  if (/\[[^\]]*describe[^\]]*\]/i.test(prompt)) {
    throw new ReconstructionError(
      "Replace the [describe …] placeholders with what the sources say.",
    );
  }
  if (input.evidenceNotes.trim().length < 20) {
    throw new ReconstructionError(
      "Explain what in the scene rests on evidence (at least a sentence).",
    );
  }
  if (input.interpretationNotes.trim().length < 10) {
    throw new ReconstructionError(
      "Say what is artistic interpretation where the evidence is silent.",
    );
  }
  const sources = input.sources.filter((s) => s.sourceId);
  if (sources.length === 0)
    throw new ReconstructionError("Link at least one source the scene is based on.");
  if (sources.some((s) => s.note.trim().length < 5)) {
    throw new ReconstructionError("For each linked source, note what it tells us about the scene.");
  }
  if (!input.projectId && !input.entityId)
    throw new ReconstructionError("Choose the project or subject this depicts.");
  return { prompt, sources };
}

export async function saveReconstruction(
  db: PrismaClient,
  actor: Actor,
  input: ReconstructionInput,
  reconstructionId?: string,
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new ReconstructionError("You cannot write reconstruction prompts.");
  const { prompt, sources } = validate(input);
  let entityId = input.entityId || null;
  if (input.projectId) {
    const project = await db.contentProject.findUnique({ where: { id: input.projectId } });
    if (!project) throw new ReconstructionError("Project not found.");
    entityId ??= project.primaryEntityId;
  }
  const data = {
    projectId: input.projectId || null,
    entityId,
    prompt,
    negativePrompt: input.negativePrompt.trim() || null,
    evidenceNotes: input.evidenceNotes.trim(),
    interpretationNotes: input.interpretationNotes.trim(),
  };
  const id = await db.$transaction(async (tx) => {
    let rid: string;
    if (reconstructionId) {
      const existing = await tx.aIReconstruction.findUnique({ where: { id: reconstructionId } });
      if (!existing) throw new ReconstructionError("Reconstruction not found.");
      if (!(EDITABLE as readonly string[]).includes(existing.status)) {
        throw new ReconstructionError(
          "Images were already made from this prompt. Start a new prompt to change it.",
        );
      }
      await tx.aIReconstruction.update({
        where: { id: reconstructionId },
        data: { ...data, status: "PROMPT_DRAFT" },
      });
      await tx.reconstructionSource.deleteMany({ where: { reconstructionId } });
      rid = reconstructionId;
    } else {
      rid = (await tx.aIReconstruction.create({ data: { ...data, createdById: userIdOf(actor) } }))
        .id;
    }
    await tx.reconstructionSource.createMany({
      data: sources.map((s) => ({
        reconstructionId: rid,
        sourceId: s.sourceId,
        note: s.note.trim(),
      })),
    });
    return rid;
  });
  await recordAudit({
    action: reconstructionId ? "reconstruction.prompt_updated" : "reconstruction.prompt_created",
    actor,
    target: { type: "reconstruction", id },
    metadata: { projectId: data.projectId, sources: sources.length },
  });
  return id;
}

/**
 * A starting prompt built only from what is known about the subject: name, kind, place and
 * period. The details of the scene are left as placeholders the person must fill from sources.
 */
export async function suggestPrompt(db: PrismaClient, projectId: string) {
  const project = await db.contentProject.findUnique({
    where: { id: projectId },
    include: {
      primaryEntity: {
        include: {
          startDate: true,
          endDate: true,
          relationsFrom: { where: { type: "LOCATED_IN" }, include: { to: true } },
        },
      },
    },
  });
  const subject = project?.primaryEntity;
  if (!subject) throw new ReconstructionError("Run research first: the subject is not known yet.");
  const period = formatDateRowRange(subject.startDate, subject.endDate);
  const place = subject.relationsFrom.map((r) => r.to.name).join(", ");
  const prompt = [
    `Historically grounded documentary illustration of ${subject.name}${place ? `, ${place}` : ""}${period ? `, during ${period}` : ""}.`,
    "Scene: [describe the setting from the sources].",
    "People and clothing: [describe what the sources record].",
    "Buildings and objects: [describe what the sources record].",
    "Style: painterly documentary illustration, natural light, muted colours, no text.",
  ].join("\n");
  return { prompt, negativePrompt: DEFAULT_NEGATIVE_PROMPT };
}

const RECON_LICENSE = "HV-ORIGINAL";

async function storeReconstructionImage(
  db: PrismaClient | Prisma.TransactionClient,
  storage: StorageProvider,
  input: {
    reconstructionId: string;
    index: number;
    body: Uint8Array;
    subjectName: string;
    attribution: string;
    prompt: string;
    uploadedById: string | null;
  },
) {
  const type = sniffImageType(input.body);
  if (!type) throw new ReconstructionError("The image is not a JPEG, PNG, WebP or GIF file.");
  const { key, sha256 } = contentKey(input.body, type.ext, "reconstructions");
  await storage.put(key, input.body, type.mime);
  const size = imageSize(input.body, type.mime);
  const license = await db.mediaLicense.findUniqueOrThrow({ where: { code: RECON_LICENSE } });
  return db.mediaAsset.create({
    data: {
      kind: "AI_RECONSTRUCTION",
      title: `AI reconstruction: ${input.subjectName}${input.index > 0 ? ` (${input.index + 1})` : ""}`,
      // A placeholder that says what it is; a person describes the actual picture before approval.
      altText: null,
      description: `Generated from the prompt: ${input.prompt.slice(0, 800)}`,
      sourceName: "HISTORYVERSE AI Image Studio",
      sourceRef: `reconstruction:${input.reconstructionId}:${input.index}:${sha256.slice(0, 12)}`,
      licenseId: license.id,
      attribution: input.attribution,
      storageKey: key,
      checksum: sha256,
      mimeType: type.mime,
      bytes: BigInt(input.body.byteLength),
      width: size?.width ?? null,
      height: size?.height ?? null,
      uploadedById: input.uploadedById,
    },
  });
}

/**
 * Ask for images from an approved prompt. Generation costs money with most providers, so it
 * waits for an administrator's approval within the project's budget, like any paid job.
 */
export async function requestGeneration(
  db: PrismaClient,
  actor: Actor,
  reconstructionId: string,
  variations: number,
  model: () => ConfiguredImageModel = () => getImageModel(),
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new ReconstructionError("You cannot generate images.");
  if (!Number.isInteger(variations) || variations < 1 || variations > 4) {
    throw new ReconstructionError("Ask for 1 to 4 images.");
  }
  const recon = await db.aIReconstruction.findUnique({ where: { id: reconstructionId } });
  if (!recon) throw new ReconstructionError("Reconstruction not found.");
  if (!recon.projectId)
    throw new ReconstructionError(
      "Generation is budgeted per project; link the prompt to a project.",
    );
  if (recon.status !== "PROMPT_DRAFT" && recon.status !== "FAILED") {
    throw new ReconstructionError("Images have already been requested from this prompt.");
  }
  let configured: ConfiguredImageModel;
  try {
    configured = model();
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw new ReconstructionError(error.message);
    throw error;
  }
  const estimate = configured.provider.estimateCost({
    prompt: recon.prompt,
    negativePrompt: recon.negativePrompt ?? undefined,
    width: 1536,
    height: 1024,
    variations,
  });
  try {
    const { job, queued } = await createJob(db, actor, {
      projectId: recon.projectId,
      type: "IMAGE_GENERATION",
      input: {
        reconstructionId,
        variations,
        model: configured.provider.id,
        estimateBasis: estimate.basis,
      },
      costEstimateUsd: estimate.amount,
      maxAttempts: estimate.amount > 0 ? 1 : 2,
    });
    await db.aIReconstruction.update({
      where: { id: reconstructionId },
      data: { status: "QUEUED" },
    });
    return { job, queued, estimate };
  } catch (error) {
    if (error instanceof JobServiceError) throw new ReconstructionError(error.message);
    throw error;
  }
}

/** The IMAGE_GENERATION job: generate, store each image labelled as a reconstruction, record cost. */
export function createImageGenerationHandler(
  getModel: () => ConfiguredImageModel,
  getStorage: () => StorageProvider,
): JobHandler {
  return async (ctx) => {
    const { db } = ctx;
    const reconstructionId = String(ctx.input.reconstructionId ?? "");
    const variations = Number(ctx.input.variations ?? 1);
    const job = await db.productionJob.findUniqueOrThrow({ where: { id: ctx.jobId } });
    if (Number(job.costEstimateUsd ?? 0) > 0 && !job.approvedAt) {
      throw new PermanentJobError("The cost of these images was not approved.");
    }
    const recon = await db.aIReconstruction.findUnique({
      where: { id: reconstructionId },
      include: { sources: true, entity: true },
    });
    if (!recon) throw new PermanentJobError("The reconstruction prompt no longer exists.");
    const { provider, perImageUsd } = getModel();
    await db.aIReconstruction.update({
      where: { id: recon.id },
      data: { status: "GENERATING", provider: provider.id },
    });
    await ctx.progress(10, `Generating ${variations} image(s) with ${provider.id}`);

    let images: { image: Uint8Array; mimeType: string }[];
    try {
      images = await provider.generate({
        prompt: recon.prompt,
        negativePrompt: recon.negativePrompt ?? undefined,
        width: 1536,
        height: 1024,
        variations,
      });
    } catch (error) {
      await db.aIReconstruction.update({ where: { id: recon.id }, data: { status: "FAILED" } });
      throw error;
    }
    // Charged per image returned.
    const cost = perImageUsd * images.length;
    await ctx.recordCost(cost);

    await ctx.progress(70, "Storing the images, labelled as AI reconstructions");
    const storage = getStorage();
    const subjectName = recon.entity?.name ?? "historical scene";
    const attribution = `AI-generated historical reconstruction by HISTORYVERSE (${provider.id}). Not an authentic image.`;
    const mediaIds: string[] = [];
    for (const [index, img] of images.entries()) {
      const asset = await storeReconstructionImage(db, storage, {
        reconstructionId: recon.id,
        index,
        body: img.image,
        subjectName,
        attribution,
        prompt: recon.prompt,
        uploadedById: null,
      });
      mediaIds.push(asset.id);
      const perImage = new Prisma.Decimal((cost / images.length).toFixed(4));
      if (index === 0) {
        await db.aIReconstruction.update({
          where: { id: recon.id },
          data: { mediaId: asset.id, status: "GENERATED", model: provider.id, costUsd: perImage },
        });
      } else {
        // Further images are variations sharing the same prompt and evidence.
        await db.aIReconstruction.create({
          data: {
            mediaId: asset.id,
            parentId: recon.id,
            entityId: recon.entityId,
            projectId: recon.projectId,
            prompt: recon.prompt,
            negativePrompt: recon.negativePrompt,
            evidenceNotes: recon.evidenceNotes,
            interpretationNotes: recon.interpretationNotes,
            provider: provider.id,
            model: provider.id,
            status: "GENERATED",
            costUsd: perImage,
            createdById: recon.createdById,
            sources: { create: recon.sources.map((s) => ({ sourceId: s.sourceId, note: s.note })) },
          },
        });
      }
      if (recon.entityId) {
        await db.entityMedia.upsert({
          where: { entityId_mediaId: { entityId: recon.entityId, mediaId: asset.id } },
          create: { entityId: recon.entityId, mediaId: asset.id, role: "reconstruction" },
          update: {},
        });
      }
    }
    return { output: { reconstructionId: recon.id, mediaIds, costUsd: Number(cost.toFixed(4)) } };
  };
}

/** Attach an image made with another tool to a prompt. It is labelled exactly like generated ones. */
export async function uploadReconstruction(
  db: PrismaClient,
  storage: StorageProvider,
  actor: Actor,
  reconstructionId: string,
  input: { body: Uint8Array; toolName: string },
) {
  if (!hasPermission(actor.role, "media:upload"))
    throw new ReconstructionError("You cannot upload images.");
  const tool = input.toolName.trim();
  if (tool.length < 2) throw new ReconstructionError("Name the tool the image was made with.");
  if (input.body.byteLength === 0 || input.body.byteLength > MAX_UPLOAD_BYTES) {
    throw new ReconstructionError("Choose an image of 10 MB or less.");
  }
  const recon = await db.aIReconstruction.findUnique({
    where: { id: reconstructionId },
    include: { entity: true },
  });
  if (!recon) throw new ReconstructionError("Reconstruction not found.");
  if (recon.mediaId)
    throw new ReconstructionError(
      "This prompt already has an image; start a new prompt for another.",
    );
  if (!(EDITABLE as readonly string[]).includes(recon.status)) {
    throw new ReconstructionError("Images are already being generated from this prompt.");
  }
  const asset = await storeReconstructionImage(db, storage, {
    reconstructionId: recon.id,
    index: 0,
    body: input.body,
    subjectName: recon.entity?.name ?? "historical scene",
    attribution: `AI-generated historical reconstruction made with ${tool}, uploaded to HISTORYVERSE. Not an authentic image.`,
    prompt: recon.prompt,
    uploadedById: userIdOf(actor),
  });
  await db.aIReconstruction.update({
    where: { id: recon.id },
    data: { mediaId: asset.id, status: "GENERATED", provider: "upload", model: tool },
  });
  if (recon.entityId) {
    await db.entityMedia.upsert({
      where: { entityId_mediaId: { entityId: recon.entityId, mediaId: asset.id } },
      create: { entityId: recon.entityId, mediaId: asset.id, role: "reconstruction" },
      update: {},
    });
  }
  await recordAudit({
    action: "reconstruction.uploaded",
    actor,
    target: { type: "reconstruction", id: recon.id },
    metadata: { mediaId: asset.id, tool },
  });
  return asset.id;
}

/**
 * An editor reviews a generated image: describe it (alt text) and approve, or reject it.
 * Approval means the image may be used, always under the reconstruction label.
 */
export async function reviewReconstruction(
  db: PrismaClient,
  actor: Actor,
  reconstructionId: string,
  decision: "APPROVED" | "REJECTED",
  altText: string,
) {
  if (!hasPermission(actor.role, "media:approve"))
    throw new ReconstructionError("Only editors can review reconstructions.");
  const recon = await db.aIReconstruction.findUnique({ where: { id: reconstructionId } });
  if (!recon?.mediaId) throw new ReconstructionError("There is no image to review.");
  if (decision === "APPROVED" && altText.trim().length < 10) {
    throw new ReconstructionError("Describe what the image shows (alt text) before approving it.");
  }
  await db.$transaction([
    db.mediaAsset.update({
      where: { id: recon.mediaId },
      data: {
        reviewStatus: decision,
        ...(decision === "APPROVED"
          ? {
              altText: `AI reconstruction: ${altText.trim().replace(/^AI reconstruction:\s*/i, "")}`,
            }
          : {}),
      },
    }),
    db.aIReconstruction.update({
      where: { id: recon.id },
      data: { status: decision === "REJECTED" ? "REJECTED" : "GENERATED" },
    }),
  ]);
  await recordAudit({
    action: decision === "APPROVED" ? "reconstruction.approved" : "reconstruction.rejected",
    actor,
    target: { type: "reconstruction", id: recon.id },
    metadata: { mediaId: recon.mediaId },
  });
}

const SOURCE_TYPE_BY_KIND = {
  STRUCTURED_DATA: "DATASET",
  ENCYCLOPEDIA: "ENCYCLOPEDIA",
  BOOK: "BOOK",
  ARCHIVE_ITEM: "ARCHIVE_DOCUMENT",
} as const;

/**
 * The bibliographic Source for an accepted research source, created on first use, so a
 * reconstruction can cite what the project's research found.
 */
export async function sourceForResearchSource(db: PrismaClient, researchSourceId: string) {
  const rs = await db.researchSource.findUnique({ where: { id: researchSourceId } });
  if (!rs || rs.status !== "ACCEPTED")
    throw new ReconstructionError("Only accepted research sources can be cited.");
  if (rs.sourceId) return rs.sourceId;
  const existing = await db.source.findFirst({ where: { url: rs.url } });
  const source =
    existing ??
    (await db.source.create({
      data: {
        type: SOURCE_TYPE_BY_KIND[rs.kind],
        title: rs.title,
        authors: rs.authors,
        publishedYear: rs.publishedYear,
        url: rs.url,
        repository: rs.provider,
        licenseNote: rs.licenseNote,
        accessedAt: rs.retrievedAt,
      },
    }));
  await db.researchSource.update({ where: { id: rs.id }, data: { sourceId: source.id } });
  return source.id;
}

export async function listReconstructions(db: PrismaClient, projectId?: string) {
  const rows = await db.aIReconstruction.findMany({
    where: { parentId: null, ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      project: { select: { id: true, topic: true } },
      entity: { select: { name: true } },
      media: { select: { id: true, reviewStatus: true, altText: true, storageKey: true } },
      sources: { include: { source: { select: { title: true, url: true } } } },
      createdBy: { select: { name: true } },
      variations: {
        include: {
          media: { select: { id: true, reviewStatus: true, altText: true, storageKey: true } },
        },
      },
    },
  });
  return rows.map((r) => {
    const image = (
      id: string,
      m: {
        id: string;
        reviewStatus: string;
        altText: string | null;
        storageKey: string | null;
      } | null,
      status: string,
    ) =>
      m
        ? {
            reconstructionId: id,
            mediaId: m.id,
            reviewStatus: m.reviewStatus,
            altText: m.altText,
            stored: Boolean(m.storageKey),
            status,
          }
        : null;
    return {
      id: r.id,
      status: r.status,
      prompt: r.prompt,
      negativePrompt: r.negativePrompt,
      evidenceNotes: r.evidenceNotes,
      interpretationNotes: r.interpretationNotes,
      provider: r.provider,
      model: r.model,
      costUsd: r.costUsd ? Number(r.costUsd) : null,
      project: r.project,
      subject: r.entity?.name ?? null,
      createdBy: r.createdBy?.name ?? null,
      createdAt: r.createdAt.toISOString(),
      sources: r.sources.map((s) => ({ title: s.source.title, url: s.source.url, note: s.note })),
      images: [
        image(r.id, r.media, r.status),
        ...r.variations.map((v) => image(v.id, v.media, v.status)),
      ].filter((x): x is NonNullable<typeof x> => x !== null),
    };
  });
}

export type ReconstructionRow = Awaited<ReturnType<typeof listReconstructions>>[number];
