import "server-only";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { RECONSTRUCTION_LABEL } from "@/lib/media/labels";
import { recordAudit } from "@/server/audit";
import { sniffAudio } from "@/server/audio/audio";
import { mediaPublishBlocker } from "@/server/content/publish";
import { getServerEnv, type ServerEnv } from "@/server/env";
import { userIdOf } from "@/server/jobs/service";
import { ProviderUnavailableError, type StorageProvider } from "@/server/providers/contracts";
import { contentKey } from "@/server/storage/local";
import { filterPath, probeDuration, runTool } from "./ffmpeg";
import { fitOnBlur } from "./render";

type Actor = { id: string; email?: string | null; role: Role };

export class LibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryError";
  }
}

const noFfmpeg = () =>
  new LibraryError("FFmpeg is not installed on this server (FFMPEG_PATH, FFPROBE_PATH).");

/** Matches the Studio upload limit (next.config.ts); music loops under the narration. */
const MAX_MUSIC_BYTES = 10 * 1024 * 1024;

/**
 * Add a music track for documentaries. Only tracks whose licence allows publication are
 * accepted, with the attribution the licence asks for.
 */
export async function uploadMusic(
  db: PrismaClient,
  storage: StorageProvider,
  actor: Actor,
  input: { body: Uint8Array; title: string; licenseId: string; attribution: string },
  env: ServerEnv = getServerEnv().env,
) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new LibraryError("Only editors add music.");
  const title = input.title.trim();
  const attribution = input.attribution.trim();
  if (title.length < 2) throw new LibraryError("Give the track a title.");
  if (attribution.length < 3)
    throw new LibraryError("Give the attribution (composer, performer, source).");
  if (input.body.byteLength === 0 || input.body.byteLength > MAX_MUSIC_BYTES) {
    throw new LibraryError("Choose a WAV or MP3 file of 10 MB or less.");
  }
  const type = sniffAudio(input.body);
  if (!type) throw new LibraryError("Only WAV and MP3 files can be added.");
  const license = await db.mediaLicense.findUnique({ where: { id: input.licenseId } });
  if (!license) throw new LibraryError("Choose a licence.");
  if (!license.publishable)
    throw new LibraryError(`The licence “${license.name}” does not allow publication.`);

  const dir = await mkdtemp(path.join(tmpdir(), "hv-music-"));
  let durationMs: number;
  try {
    const file = path.join(dir, `track.${type.ext}`);
    await writeFile(file, input.body);
    durationMs = Math.round((await probeDuration(env.FFPROBE_PATH, file)) * 1000);
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw noFfmpeg();
    throw new LibraryError("The file could not be read as audio.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const { key } = contentKey(input.body, type.ext, "music");
  await storage.put(key, input.body, type.mime);
  const asset = await db.videoAsset.create({
    data: {
      kind: "MUSIC",
      title,
      storageKey: key,
      mimeType: type.mime,
      durationMs,
      licenseId: license.id,
      attribution,
    },
  });
  await recordAudit({
    action: "music.added",
    actor,
    target: { type: "video_asset", id: asset.id },
    metadata: { license: license.code, uploadedBy: userIdOf(actor) },
  });
  return asset.id;
}

function wrap(text: string, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3).join("\n");
}

/**
 * A 1280×720 YouTube thumbnail from an approved image and a short headline. Thumbnails made from
 * AI reconstructions carry the reconstruction label, like the video itself.
 */
export async function generateThumbnail(
  db: PrismaClient,
  storage: StorageProvider,
  actor: Actor,
  input: { documentaryId: string; mediaId: string; headline: string },
  env: ServerEnv = getServerEnv().env,
) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new LibraryError("Only editors make thumbnails.");
  const headline = input.headline.trim();
  if (headline.length < 3 || headline.length > 70)
    throw new LibraryError("Write a headline of 3 to 70 characters.");
  const doc = await db.documentary.findUnique({ where: { id: input.documentaryId } });
  if (!doc) throw new LibraryError("Documentary not found.");
  const media = await db.mediaAsset.findUnique({
    where: { id: input.mediaId },
    include: { license: true },
  });
  if (
    !media ||
    media.deletedAt ||
    media.reviewStatus !== "APPROVED" ||
    mediaPublishBlocker(media)
  ) {
    throw new LibraryError("Choose an approved image that may be published.");
  }
  const bytes = await storage.get(media.storageKey!);
  if (!bytes) throw new LibraryError("The image file is missing from storage.");
  const reconstruction = media.kind === "AI_RECONSTRUCTION";

  const dir = await mkdtemp(path.join(tmpdir(), "hv-thumb-"));
  try {
    const image = path.join(dir, "image");
    await writeFile(image, bytes);
    const text = async (name: string, value: string) => {
      const file = path.join(dir, `${name}.txt`);
      await writeFile(file, value);
      return filterPath(file);
    };
    const font = filterPath(env.VIDEO_FONT_PATH);
    const filters = [
      fitOnBlur(1280, 720),
      // A shade fading in towards the bottom keeps the headline readable on any picture.
      "format=rgb24[pic];color=black:s=1280x720:d=1,format=rgba,geq=r=0:g=0:b=0:a='if(gt(Y\\,H*0.35)\\,200*pow((Y-H*0.35)/(H*0.65)\\,1.4)\\,0)'[shade];[pic][shade]overlay=format=auto",
      `drawtext=fontfile=${font}:textfile=${await text("headline", wrap(headline.toUpperCase(), 22))}:fontsize=74:fontcolor=white:line_spacing=6:borderw=4:bordercolor=black@0.6:x=48:y=h-th-60`,
      `drawtext=fontfile=${font}:textfile=${await text("credit", reconstruction ? "AI reconstruction · HISTORYVERSE" : `${media.title.slice(0, 50)} · ${media.license.name}`)}:fontsize=18:fontcolor=white@0.85:x=w-tw-20:y=h-th-16`,
    ];
    if (reconstruction) {
      filters.push(
        `drawtext=fontfile=${font}:textfile=${await text("label", RECONSTRUCTION_LABEL)}:fontsize=24:fontcolor=0xFFD27A:box=1:boxcolor=0x1A1203@0.9:boxborderw=12:x=24:y=24`,
      );
    }
    const out = path.join(dir, "thumbnail.jpg");
    await runTool(
      env.FFMPEG_PATH,
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        image,
        "-filter_complex",
        filters.join(","),
        "-frames:v",
        "1",
        "-q:v",
        "3",
        out,
      ],
      120_000,
    ).catch((error: unknown) => {
      throw error instanceof ProviderUnavailableError ? noFfmpeg() : error;
    });
    const jpeg = new Uint8Array(await readFile(out));
    const { key } = contentKey(jpeg, "jpg", "thumbnails");
    await storage.put(key, jpeg, "image/jpeg");
    const thumb = await db.thumbnail.create({
      data: {
        documentaryId: doc.id,
        mediaId: media.id,
        storageKey: key,
        headline,
        usesSyntheticMedia: reconstruction,
      },
    });
    await recordAudit({
      action: "thumbnail.created",
      actor,
      target: { type: "thumbnail", id: thumb.id },
      metadata: { documentaryId: doc.id, reconstruction },
    });
    return thumb.id;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Choose the documentary's thumbnail (one at a time). */
export async function selectThumbnail(db: PrismaClient, actor: Actor, thumbnailId: string) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new LibraryError("Only editors choose thumbnails.");
  const thumb = await db.thumbnail.findUnique({ where: { id: thumbnailId } });
  if (!thumb) throw new LibraryError("Thumbnail not found.");
  await db.$transaction([
    db.thumbnail.updateMany({
      where: { documentaryId: thumb.documentaryId },
      data: { isSelected: false },
    }),
    db.thumbnail.update({ where: { id: thumb.id }, data: { isSelected: true } }),
  ]);
}
