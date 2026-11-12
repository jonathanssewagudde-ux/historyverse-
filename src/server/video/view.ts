import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { mediaPublishBlocker } from "@/server/content/publish";
import { getServerEnv } from "@/server/env";
import { runTool } from "./ffmpeg";
import { FORMATS, renderPlan } from "./render";

export interface Manifest {
  documentary: string;
  script: { version: number; approvedBy: string | null; approvedAt: string | null };
  render: { id: string; format: string; width: number; height: number; seconds: number };
  containsAiReconstruction: boolean;
  images: {
    title: string;
    kind: string;
    source: string;
    sourceUrl: string | null;
    license: string;
    attribution: string;
    scenes: number[];
  }[];
  narration: {
    scene: number;
    source: string;
    provider: string | null;
    voice: string | null;
    voiceLicense: string | null;
  }[];
  syntheticVoice: boolean;
  music: { title: string; license: string; attribution: string | null } | null;
  sources: { title: string; url: string | null; scenes: number[] }[];
  generatedAt: string;
}

let ffmpegStatus: { at: number; value: { ok: boolean; detail: string } } | null = null;

/** Whether FFmpeg can run here (checked at most once a minute). */
export async function getFfmpegStatus() {
  if (ffmpegStatus && Date.now() - ffmpegStatus.at < 60_000) return ffmpegStatus.value;
  const { env } = getServerEnv();
  let value: { ok: boolean; detail: string };
  try {
    const out = await runTool(env.FFMPEG_PATH, ["-hide_banner", "-version"], 5_000);
    value = { ok: true, detail: (out.split("\n")[0] ?? "").replace(/ Copyright.*/, "") };
  } catch (error) {
    value = { ok: false, detail: error instanceof Error ? error.message : "FFmpeg did not start." };
  }
  ffmpegStatus = { at: Date.now(), value };
  return value;
}

/** Everything the documentary page's Video section shows. */
export async function getVideoPanel(db: PrismaClient, documentaryId: string) {
  const { doc, script, problems } = await renderPlan(db, documentaryId);
  const [renders, captions, thumbnails, music, article, entityMedia] = await Promise.all([
    db.videoRender.findMany({
      where: { documentaryId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { script: { select: { version: true } }, job: { select: { status: true } } },
    }),
    db.videoAsset.findMany({
      where: { documentaryId, kind: "SUBTITLES" },
      orderBy: { createdAt: "desc" },
    }),
    db.thumbnail.findMany({ where: { documentaryId }, orderBy: { createdAt: "desc" } }),
    listMusic(db),
    doc.articleId
      ? db.articleMedia.findMany({
          where: { articleId: doc.articleId },
          include: { media: { include: { license: true } } },
        })
      : [],
    doc.primaryEntityId
      ? db.entityMedia.findMany({
          where: { entityId: doc.primaryEntityId },
          include: { media: { include: { license: true } } },
        })
      : [],
  ]);
  // Thumbnail pictures: approved, publishable images from the script, the article or the entity.
  const seen = new Set<string>();
  const imageOptions = [
    ...(script?.scenes.flatMap((s) => s.assets.map((a) => a.media)) ?? []),
    ...article.map((m) => m.media),
    ...entityMedia.map((m) => m.media),
  ]
    .filter((m) => {
      if (seen.has(m.id) || m.deletedAt || m.reviewStatus !== "APPROVED" || mediaPublishBlocker(m))
        return false;
      seen.add(m.id);
      return true;
    })
    .map((m) => ({ id: m.id, title: m.title, reconstruction: m.kind === "AI_RECONSTRUCTION" }));

  return {
    scriptVersion: script?.version ?? null,
    problems,
    formats: Object.entries(FORMATS).map(([value, f]) => ({
      value,
      label: `${f.label} · ${f.width}×${f.height}`,
      burnCaptions: f.burnCaptions,
    })),
    renders: renders.map((r) => ({
      id: r.id,
      format: r.format,
      formatLabel: FORMATS[r.format].label,
      status: r.status,
      progress: r.progress,
      scriptVersion: r.script?.version ?? null,
      seconds: r.durationSeconds === null ? null : Number(r.durationSeconds),
      megabytes: r.bytes === null ? null : Number(r.bytes) / 1024 / 1024,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      vertical: r.height > r.width,
      captions: captions
        .filter((c) => c.title.endsWith(`for render ${r.id}`))
        .map((c) => ({
          id: c.id,
          ext: c.mimeType === "text/vtt" ? "vtt" : "srt",
          language: c.language,
        })),
    })),
    active: renders.some((r) => r.status === "QUEUED" || r.status === "RENDERING"),
    thumbnails: thumbnails.map((t) => ({
      id: t.id,
      headline: t.headline,
      isSelected: t.isSelected,
      usesSyntheticMedia: t.usesSyntheticMedia,
    })),
    music: music.filter((m) => m.publishable),
    imageOptions,
    manifest: (doc.manifest ?? null) as Manifest | null,
  };
}

export async function listMusic(db: PrismaClient) {
  const tracks = await db.videoAsset.findMany({
    where: { kind: "MUSIC" },
    orderBy: { createdAt: "desc" },
    include: { license: true },
  });
  return tracks.map((t) => ({
    id: t.id,
    title: t.title,
    seconds: t.durationMs === null ? null : t.durationMs / 1000,
    license: t.license?.name ?? "No licence",
    publishable: Boolean(t.license?.publishable),
    attribution: t.attribution,
  }));
}

/** The Video Editor overview: each documentary and where its video stands. */
export async function listVideoOverview(db: PrismaClient) {
  const docs = await db.documentary.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      scripts: {
        where: { status: "APPROVED" },
        select: { version: true },
        take: 1,
        orderBy: { version: "desc" },
      },
      renders: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { renders: { where: { status: "SUCCEEDED" } }, thumbnails: true } },
    },
  });
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    approvedScript: d.scripts[0]?.version ?? null,
    latest: d.renders[0]
      ? {
          status: d.renders[0].status,
          format: FORMATS[d.renders[0].format].label,
          seconds:
            d.renders[0].durationSeconds === null ? null : Number(d.renders[0].durationSeconds),
        }
      : null,
    finishedRenders: d._count.renders,
    thumbnails: d._count.thumbnails,
  }));
}

/** All thumbnails, grouped by documentary, for the Thumbnail Generator page. */
export async function listThumbnails(db: PrismaClient) {
  const docs = await db.documentary.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { thumbnails: { orderBy: { createdAt: "desc" } } },
  });
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    thumbnails: d.thumbnails.map((t) => ({
      id: t.id,
      headline: t.headline,
      isSelected: t.isSelected,
      usesSyntheticMedia: t.usesSyntheticMedia,
    })),
  }));
}
