import "server-only";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Prisma, type PrismaClient, type VideoFormat } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { RECONSTRUCTION_LABEL } from "@/lib/media/labels";
import { recordAudit } from "@/server/audit";
import { mediaPublishBlocker } from "@/server/content/publish";
import { getServerEnv, type ServerEnv } from "@/server/env";
import { createJob, JobServiceError } from "@/server/jobs/service";
import { JobCancelledError, PermanentJobError, type JobHandler } from "@/server/jobs/types";
import type { StorageProvider } from "@/server/providers/contracts";
import { contentKey } from "@/server/storage/local";
import { buildCues, toSrt, toVtt } from "./captions";
import { filterPath, probeDuration, runTool } from "./ffmpeg";

type Actor = { id: string; email?: string | null; role: Role };

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

export const FORMATS: Record<
  VideoFormat,
  { width: number; height: number; label: string; burnCaptions: boolean }
> = {
  LANDSCAPE_1080P: { width: 1920, height: 1080, label: "16:9 (YouTube)", burnCaptions: false },
  VERTICAL_1080P: { width: 1080, height: 1920, label: "9:16 (Shorts)", burnCaptions: true },
};

const FPS = 30;
const FADE = 0.35;
const MOTIONS = ["push-in", "pan-right", "pan-left", "push-out"];

/** Load an approved script with everything the render needs, and list what blocks rendering. */
export async function renderPlan(db: PrismaClient, documentaryId: string) {
  const doc = await db.documentary.findUnique({
    where: { id: documentaryId },
    include: {
      scripts: {
        where: { status: "APPROVED" },
        orderBy: { version: "desc" },
        take: 1,
        include: {
          approvedBy: { select: { name: true } },
          scenes: {
            orderBy: { position: "asc" },
            include: {
              assets: {
                orderBy: { position: "asc" },
                include: { media: { include: { license: true } } },
              },
              voiceovers: { where: { isCurrent: true } },
              citations: { include: { citation: { include: { source: true } } } },
            },
          },
        },
      },
    },
  });
  if (!doc) throw new RenderError("Documentary not found.");
  const script = doc.scripts[0];
  const problems: string[] = [];
  if (!script) problems.push("There is no approved script.");
  for (const s of script?.scenes ?? []) {
    const n = s.position + 1;
    if (!s.voiceovers[0]?.storageKey) problems.push(`Scene ${n} has no narration.`);
    if (s.assets.length === 0) problems.push(`Scene ${n} has no image.`);
    for (const a of s.assets) {
      // Images may have changed since the script was approved: re-check every one.
      const blocker = a.media.deletedAt
        ? "deleted"
        : a.media.reviewStatus !== "APPROVED"
          ? "not approved"
          : mediaPublishBlocker(a.media);
      if (blocker) problems.push(`Scene ${n}: “${a.media.title}” cannot be used (${blocker}).`);
    }
  }
  return { doc, script: script ?? null, problems };
}

/** Queue a render of the approved script. Rendering is local and free. */
export async function requestRender(
  db: PrismaClient,
  actor: Actor,
  documentaryId: string,
  options: { format: VideoFormat; musicId?: string | null; burnCaptions?: boolean },
) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new RenderError("Only editors render documentaries.");
  if (!(options.format in FORMATS)) throw new RenderError("Choose a format.");
  const { doc, script, problems } = await renderPlan(db, documentaryId);
  if (problems.length > 0) throw new RenderError(`Cannot render yet: ${problems.join(" ")}`);
  if (options.musicId) {
    const music = await db.videoAsset.findUnique({
      where: { id: options.musicId },
      include: { license: true },
    });
    if (!music || music.kind !== "MUSIC") throw new RenderError("Music not found.");
    if (!music.license?.publishable)
      throw new RenderError("That music's licence does not allow publication.");
  }
  const { width, height, burnCaptions } = FORMATS[options.format];
  const render = await db.videoRender.create({
    data: { documentaryId, scriptId: script!.id, format: options.format, width, height, fps: FPS },
  });
  try {
    const { job, queued } = await createJob(db, actor, {
      projectId: doc.projectId,
      type: "RENDER",
      input: {
        renderId: render.id,
        musicId: options.musicId ?? null,
        burnCaptions: options.burnCaptions ?? burnCaptions,
      },
      subject: { key: "renderId", value: render.id },
    });
    await db.videoRender.update({ where: { id: render.id }, data: { jobId: job.id } });
    await recordAudit({
      action: "documentary.render_requested",
      actor,
      target: { type: "documentary", id: documentaryId },
      metadata: { renderId: render.id, format: options.format },
    });
    return { renderId: render.id, queued };
  } catch (error) {
    await db.videoRender.update({
      where: { id: render.id },
      data: { status: "FAILED", error: "Could not be queued." },
    });
    if (error instanceof JobServiceError) throw new RenderError(error.message);
    throw error;
  }
}

/** zoompan expressions for a camera move over `frames` frames. */
function motion(kind: string, frames: number) {
  const p = `on/${Math.max(1, frames - 1)}`;
  switch (kind) {
    case "push-out":
      return { z: `1.12-0.12*${p}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
    case "pan-right":
      return { z: "1.12", x: `(iw-iw/zoom)*${p}`, y: "ih/2-(ih/zoom/2)" };
    case "pan-left":
      return { z: "1.12", x: `(iw-iw/zoom)*(1-${p})`, y: "ih/2-(ih/zoom/2)" };
    default:
      return { z: `1+0.12*${p}`, x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  }
}

function wrapText(text: string, width: number): string {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

/**
 * Fit the whole picture in the frame over a blurred, darkened copy of itself. Cropping to fill
 * would cut off faces in portraits and the edges of maps and documents.
 */
export function fitOnBlur(width: number, height: number) {
  return [
    "split[bg][fg]",
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=luma_radius=min(h\\,w)/20:luma_power=2,eq=brightness=-0.18[bg]`,
    `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg]`,
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1",
  ].join(";");
}

interface SegmentSpec {
  image: string;
  seconds: number;
  motion: string;
  onScreenText: string | null;
  credit: string;
  reconstruction: boolean;
}

/** One image segment: cover-cropped, a slow camera move, text overlays, fades from and to black. */
async function renderSegment(
  env: ServerEnv,
  dir: string,
  index: number,
  spec: SegmentSpec,
  width: number,
  height: number,
) {
  const frames = Math.max(1, Math.round(spec.seconds * FPS));
  const vertical = height > width;
  const font = filterPath(env.VIDEO_FONT_PATH);
  const textFile = async (name: string, text: string) => {
    const file = path.join(dir, `${name}-${index}.txt`);
    await writeFile(file, text);
    return filterPath(file);
  };
  const m = motion(spec.motion, frames);
  const filters = [
    // Upscale first so the camera move stays smooth.
    fitOnBlur(width * 2, height * 2),
    `zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${frames}:s=${width}x${height}:fps=${FPS}`,
  ];
  if (spec.reconstruction) {
    const label = vertical ? RECONSTRUCTION_LABEL.replace(" — ", "\n") : RECONSTRUCTION_LABEL;
    filters.push(
      `drawtext=fontfile=${font}:textfile=${await textFile("label", label)}:fontsize=${vertical ? 40 : 34}:fontcolor=0xFFD27A:box=1:boxcolor=0x1A1203@0.88:boxborderw=18:line_spacing=8:x=40:y=40`,
    );
  }
  if (spec.onScreenText) {
    filters.push(
      `drawtext=fontfile=${font}:textfile=${await textFile("title", wrapText(spec.onScreenText, vertical ? 24 : 44))}:fontsize=${vertical ? 62 : 54}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=22:line_spacing=10:x=${vertical ? 60 : 80}:y=${vertical ? "h*0.62" : "h-th-170"}`,
    );
  }
  filters.push(
    `drawtext=fontfile=${font}:textfile=${await textFile("credit", spec.credit)}:fontsize=${vertical ? 26 : 22}:fontcolor=white@0.85:box=1:boxcolor=black@0.45:boxborderw=8:x=w-tw-30:y=h-th-24`,
    `fade=t=in:st=0:d=${FADE}`,
    `fade=t=out:st=${Math.max(0, spec.seconds - FADE).toFixed(3)}:d=${FADE}`,
    "format=yuv420p",
  );
  const out = path.join(dir, `segment-${String(index).padStart(4, "0")}.mp4`);
  await runTool(env.FFMPEG_PATH, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    spec.image,
    "-filter_complex",
    filters.join(","),
    "-frames:v",
    String(frames),
    "-r",
    String(FPS),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-an",
    out,
  ]);
  return out;
}

const KIND_LABEL: Record<string, string> = {
  AUTHENTIC_PHOTO: "Archival photograph",
  AUTHENTIC_DOCUMENT: "Historical document",
  ARTWORK: "Historical artwork",
  MAP: "Map",
  MODERN_PHOTO: "Modern photograph",
  DIAGRAM: "Diagram",
  AI_RECONSTRUCTION: "AI reconstruction",
};

/**
 * The RENDER job: compose the approved script into an MP4 with FFmpeg, plus captions (SRT and
 * WebVTT) and a source-and-licence manifest. Everything is local and free.
 */
export function createRenderHandler(
  getStorage: () => StorageProvider,
  getEnv: () => ServerEnv = () => getServerEnv().env,
): JobHandler {
  return async (ctx) => {
    const { db } = ctx;
    const env = getEnv();
    const storage = getStorage();
    const renderId = String(ctx.input.renderId ?? "");
    const render = await db.videoRender.findUnique({ where: { id: renderId } });
    if (!render) throw new PermanentJobError("The render no longer exists.");
    const refuse = async (message: string) => {
      await db.videoRender.update({
        where: { id: render.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      return new PermanentJobError(message);
    };
    const { doc, script, problems } = await renderPlan(db, render.documentaryId);
    if (problems.length > 0 || !script) throw await refuse(`Cannot render: ${problems.join(" ")}`);
    if (script.id !== render.scriptId)
      throw await refuse(
        "A newer script was approved since this render was requested; render again.",
      );
    const burnCaptions = Boolean(ctx.input.burnCaptions);
    const musicId = (ctx.input.musicId as string | null) ?? null;

    await db.videoRender.update({
      where: { id: render.id },
      data: { status: "RENDERING", startedAt: new Date(), error: null },
    });
    const dir = await mkdtemp(path.join(tmpdir(), "hv-render-"));
    try {
      // 1. Pictures, scene by scene.
      const segments: string[] = [];
      const sceneAudio: string[] = [];
      const captionScenes: { start: number; spokenSeconds: number; text: string }[] = [];
      let clock = 0;
      let motionIndex = 0;
      for (const [i, scene] of script.scenes.entries()) {
        if (await ctx.isCancelled()) throw new JobCancelledError();
        await ctx.progress(
          5 + (i / script.scenes.length) * 75,
          `Composing scene ${i + 1} of ${script.scenes.length}`,
        );
        const sceneSeconds = Number(scene.durationSeconds);
        const per = sceneSeconds / scene.assets.length;
        for (const [j, asset] of scene.assets.entries()) {
          const bytes = await storage.get(asset.media.storageKey!);
          if (!bytes)
            throw new PermanentJobError(
              `The file for “${asset.media.title}” is missing from storage.`,
            );
          const imageFile = path.join(dir, `image-${i}-${j}`);
          await writeFile(imageFile, bytes);
          const isRecon = asset.media.kind === "AI_RECONSTRUCTION";
          segments.push(
            await renderSegment(
              env,
              dir,
              segments.length,
              {
                image: imageFile,
                seconds: per,
                motion: asset.motion ?? MOTIONS[motionIndex++ % MOTIONS.length]!,
                onScreenText: j === 0 ? scene.onScreenText : null,
                credit: isRecon
                  ? "AI reconstruction · HISTORYVERSE"
                  : `${asset.media.title.slice(0, 60)} · ${asset.media.license.name}`,
                reconstruction: isRecon,
              },
              render.width,
              render.height,
            ),
          );
        }
        // 2. Narration for the scene, padded with silence to the scene's length.
        const take = scene.voiceovers[0]!;
        const takeFile = path.join(dir, `take-${i}`);
        await writeFile(takeFile, (await storage.get(take.storageKey!))!);
        const sceneWav = path.join(dir, `scene-audio-${String(i).padStart(4, "0")}.wav`);
        await runTool(env.FFMPEG_PATH, [
          "-y",
          "-loglevel",
          "error",
          "-i",
          takeFile,
          "-af",
          `apad,atrim=0:${sceneSeconds.toFixed(3)}`,
          "-ar",
          "48000",
          "-ac",
          "2",
          "-c:a",
          "pcm_s16le",
          sceneWav,
        ]);
        sceneAudio.push(sceneWav);
        captionScenes.push({
          start: clock,
          spokenSeconds: Math.min(sceneSeconds, (take.durationMs ?? sceneSeconds * 1000) / 1000),
          text: take.text ?? scene.narration,
        });
        clock += sceneSeconds;
      }

      await ctx.progress(82, "Joining the scenes");
      const list = (files: string[]) =>
        files
          .map((f) => `file ${filterPath(f).replace(/\\:/g, ":").replace(/\\,/g, ",")}`)
          .join("\n");
      const videoList = path.join(dir, "video.txt");
      await writeFile(videoList, list(segments));
      const video = path.join(dir, "video.mp4");
      await runTool(env.FFMPEG_PATH, [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        videoList,
        "-c",
        "copy",
        video,
      ]);
      const audioList = path.join(dir, "audio.txt");
      await writeFile(audioList, list(sceneAudio));
      const narration = path.join(dir, "narration.wav");
      await runTool(env.FFMPEG_PATH, [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        audioList,
        "-c",
        "copy",
        narration,
      ]);

      // 3. Sound: narration, optional music bed underneath, YouTube loudness (-14 LUFS).
      await ctx.progress(88, "Mixing the sound");
      const mixed = path.join(dir, "mixed.wav");
      let music: { title: string; license: string; attribution: string | null } | null = null;
      if (musicId) {
        const track = await db.videoAsset.findUnique({
          where: { id: musicId },
          include: { license: true },
        });
        if (!track?.license?.publishable)
          throw new PermanentJobError("The chosen music can no longer be published.");
        const musicFile = path.join(dir, "music");
        await writeFile(musicFile, (await storage.get(track.storageKey))!);
        await runTool(env.FFMPEG_PATH, [
          "-y",
          "-loglevel",
          "error",
          "-i",
          narration,
          "-stream_loop",
          "-1",
          "-i",
          musicFile,
          "-filter_complex",
          "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.12[m];[0:a][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11",
          "-ar",
          "48000",
          mixed,
        ]);
        music = { title: track.title, license: track.license.name, attribution: track.attribution };
      } else {
        await runTool(env.FFMPEG_PATH, [
          "-y",
          "-loglevel",
          "error",
          "-i",
          narration,
          "-af",
          "loudnorm=I=-14:TP=-1.5:LRA=11",
          "-ar",
          "48000",
          mixed,
        ]);
      }

      // 4. Captions from the narration actually spoken.
      const cues = buildCues(captionScenes);
      const srt = toSrt(cues);
      const vtt = toVtt(cues);
      const srtFile = path.join(dir, "captions.srt");
      await writeFile(srtFile, srt);

      await ctx.progress(93, burnCaptions ? "Burning in captions and encoding" : "Encoding");
      const output = path.join(dir, "documentary.mp4");
      const vertical = render.height > render.width;
      await runTool(env.FFMPEG_PATH, [
        "-y",
        "-loglevel",
        "error",
        "-i",
        video,
        "-i",
        mixed,
        ...(burnCaptions
          ? [
              "-vf",
              `subtitles=${filterPath(srtFile)}:fontsdir=${filterPath(path.dirname(env.VIDEO_FONT_PATH))}:force_style='FontName=DejaVu Sans,Bold=1,Fontsize=${vertical ? 11 : 16},Outline=2,Shadow=0,MarginV=${vertical ? 70 : 28}'`,
              "-c:v",
              "libx264",
              "-preset",
              "veryfast",
              "-crf",
              "20",
              "-pix_fmt",
              "yuv420p",
            ]
          : ["-c:v", "copy"]),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        output,
      ]);
      const seconds = await probeDuration(env.FFPROBE_PATH, output);
      const body = new Uint8Array(await readFile(output));
      const { key } = contentKey(body, "mp4", "renders");
      await storage.put(key, body, "video/mp4");

      // 5. Captions as files, and the source-and-licence manifest.
      const language = script.language;
      for (const [ext, text, mime] of [
        ["srt", srt, "application/x-subrip"],
        ["vtt", vtt, "text/vtt"],
      ] as const) {
        const bytes = new TextEncoder().encode(text);
        const { key: captionKey } = contentKey(bytes, ext, "captions");
        await storage.put(captionKey, bytes, mime);
        await db.videoAsset.create({
          data: {
            documentaryId: doc.id,
            kind: "SUBTITLES",
            title: `Captions v${script.version} (${ext.toUpperCase()}, ${language}) for render ${render.id}`,
            storageKey: captionKey,
            mimeType: mime,
            language,
            attribution: "Generated from the approved narration",
          },
        });
      }
      const images = new Map<
        string,
        {
          title: string;
          kind: string;
          source: string;
          sourceUrl: string | null;
          license: string;
          attribution: string;
          scenes: number[];
        }
      >();
      for (const scene of script.scenes) {
        for (const a of scene.assets) {
          const entry = images.get(a.media.id) ?? {
            title: a.media.title,
            kind: KIND_LABEL[a.media.kind] ?? a.media.kind,
            source: a.media.sourceName,
            sourceUrl: a.media.sourceUrl,
            license: a.media.license.name,
            attribution: a.media.attribution,
            scenes: [],
          };
          entry.scenes.push(scene.position + 1);
          images.set(a.media.id, entry);
        }
      }
      const sources = new Map<string, { title: string; url: string | null; scenes: number[] }>();
      for (const scene of script.scenes) {
        for (const c of scene.citations) {
          const s = c.citation.source;
          const entry = sources.get(s.id) ?? { title: s.title, url: s.url, scenes: [] };
          if (!entry.scenes.includes(scene.position + 1)) entry.scenes.push(scene.position + 1);
          sources.set(s.id, entry);
        }
      }
      const containsAiReconstruction = script.scenes.some((s) =>
        s.assets.some((a) => a.media.kind === "AI_RECONSTRUCTION"),
      );
      const manifest = {
        documentary: doc.title,
        script: {
          version: script.version,
          approvedBy: script.approvedBy?.name ?? null,
          approvedAt: script.approvedAt?.toISOString() ?? null,
        },
        render: {
          id: render.id,
          format: render.format,
          width: render.width,
          height: render.height,
          seconds: Number(seconds.toFixed(2)),
        },
        containsAiReconstruction,
        images: [...images.values()],
        narration: script.scenes.map((s) => ({
          scene: s.position + 1,
          source: s.voiceovers[0]!.source,
          provider: s.voiceovers[0]!.provider,
          voice: s.voiceovers[0]!.voiceId,
          voiceLicense: s.voiceovers[0]!.voiceLicense,
        })),
        syntheticVoice: script.scenes.some((s) => s.voiceovers[0]!.source === "SYNTHESIZED"),
        music,
        sources: [...sources.values()],
        generatedAt: new Date().toISOString(),
      };
      await db.$transaction([
        db.videoRender.update({
          where: { id: render.id },
          data: {
            status: "SUCCEEDED",
            progress: 100,
            storageKey: key,
            bytes: BigInt(body.byteLength),
            durationSeconds: new Prisma.Decimal(seconds.toFixed(2)),
            finishedAt: new Date(),
          },
        }),
        db.documentary.update({
          where: { id: doc.id },
          data: {
            status: "RENDERED",
            manifest: manifest as unknown as Prisma.InputJsonObject,
            containsSyntheticMedia: containsAiReconstruction,
          },
        }),
      ]);
      return {
        output: {
          renderId: render.id,
          seconds: Number(seconds.toFixed(2)),
          bytes: body.byteLength,
          cues: cues.length,
        },
      };
    } catch (error) {
      await db.videoRender.update({
        where: { id: render.id },
        data: {
          status: error instanceof JobCancelledError ? "CANCELLED" : "FAILED",
          error: error instanceof Error ? error.message.slice(0, 500) : "Render failed.",
          finishedAt: new Date(),
        },
      });
      throw error;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
