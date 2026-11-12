import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { RECONSTRUCTION_LABEL } from "@/lib/media/labels";
import { licenses } from "../../prisma/seed";
import { getDb } from "@/server/db/client";
import { parseServerEnv } from "@/server/env";
import { getQueue } from "@/server/jobs/queue";
import { runJob } from "@/server/jobs/runner";
import { createLocalStorage } from "@/server/storage/local";
import { generateThumbnail, selectThumbnail, uploadMusic } from "@/server/video/library";
import { createRenderHandler, renderPlan, requestRender } from "@/server/video/render";

/**
 * Documentary rendering with the real FFmpeg (free, local; installed in CI). A tiny two-scene
 * documentary: an archival photograph (the real Commons file in tests/fixtures/media) and a flat
 * grey test picture standing in for an approved AI reconstruction, so the burned-in label can be
 * checked pixel by pixel. Narration and music are test tones made by FFmpeg itself.
 */

const work = mkdtempSync(path.join(tmpdir(), "hv-video-test-"));
const storage = createLocalStorage(path.join(work, "storage"));
const env = parseServerEnv({}).env;
const handlers = {
  RENDER: createRenderHandler(
    () => storage,
    () => env,
  ),
};

let db: PrismaClient;
const editor = { id: "video-editor", email: "e@video.invalid", role: "EDITOR" as const };
const researcher = {
  id: "video-researcher",
  email: "r@video.invalid",
  role: "RESEARCHER" as const,
};
let documentaryId: string;
let photoId: string;
let reconId: string;

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const tone = (seconds: number, frequency: number) => {
  const file = path.join(work, `tone-${frequency}-${seconds}.wav`);
  ffmpeg([
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${frequency}:duration=${seconds}`,
    "-ar",
    "22050",
    file,
  ]);
  return new Uint8Array(readFileSync(file));
};
const probe = (file: string) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {
      encoding: "utf8",
    }),
  ) as {
    streams: { codec_type: string; codec_name: string; width?: number; height?: number }[];
    format: { duration: string };
  };
/** RGB of one pixel of the frame at `seconds`. */
const pixel = (file: string, seconds: number, x: number, y: number) => {
  const raw = execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    ...(seconds > 0 ? ["-ss", String(seconds)] : []),
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    `format=rgb24,crop=1:1:${x}:${y}`,
    "-f",
    "rawvideo",
    "-",
  ]);
  if (raw.length !== 3) throw new Error(`No pixel read from ${file} at ${seconds}s`);
  return [raw[0]!, raw[1]!, raw[2]!];
};
const near = (a: number[], b: number[], tolerance = 24) =>
  a.every((v, i) => Math.abs(v - b[i]!) <= tolerance);
const saved = async (key: string, name: string) => {
  const file = path.join(work, name);
  writeFileSync(file, (await storage.get(key))!);
  return file;
};

async function render(format: "LANDSCAPE_1080P" | "VERTICAL_1080P", musicId?: string) {
  const { renderId } = await requestRender(db, editor, documentaryId, { format, musicId });
  const { jobId } = await db.videoRender.findUniqueOrThrow({ where: { id: renderId } });
  expect(await runJob(db, jobId!, handlers)).toBe("succeeded");
  return db.videoRender.findUniqueOrThrow({ where: { id: renderId } });
}

beforeAll(async () => {
  db = getDb();
  for (const license of licenses) await db.mediaLicense.create({ data: license });
  await db.user.createMany({
    data: [
      { id: editor.id, name: "Video Editor", email: editor.email, role: "EDITOR" },
      { id: researcher.id, name: "Video Researcher", email: researcher.email, role: "RESEARCHER" },
    ],
  });
  const pd = await db.mediaLicense.findUniqueOrThrow({ where: { code: "PD" } });
  const original = await db.mediaLicense.findUniqueOrThrow({ where: { code: "HV-ORIGINAL" } });

  const photo = new Uint8Array(readFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg"));
  await storage.put("media/test/mwanga.jpg", photo, "image/jpeg");
  const greyFile = path.join(work, "grey.png");
  ffmpeg(["-f", "lavfi", "-i", "color=c=0x808080:s=1600x900", "-frames:v", "1", greyFile]);
  await storage.put("media/test/grey.png", new Uint8Array(readFileSync(greyFile)), "image/png");

  photoId = (
    await db.mediaAsset.create({
      data: {
        kind: "AUTHENTIC_PHOTO",
        title: "King Mwanga II Buganda",
        sourceName: "Wikimedia Commons",
        sourceRef: "File:King Mwanga II Buganda.jpg",
        attribution: "Public domain, via Wikimedia Commons",
        licenseId: pd.id,
        storageKey: "media/test/mwanga.jpg",
        mimeType: "image/jpeg",
        reviewStatus: "APPROVED",
      },
    })
  ).id;
  reconId = (
    await db.mediaAsset.create({
      data: {
        kind: "AI_RECONSTRUCTION",
        title: "Test reconstruction (flat grey)",
        sourceName: "HISTORYVERSE test",
        attribution: "Test image",
        licenseId: original.id,
        storageKey: "media/test/grey.png",
        mimeType: "image/png",
        reviewStatus: "APPROVED",
      },
    })
  ).id;

  const doc = await db.documentary.create({ data: { slug: "render-test", title: "Render test" } });
  documentaryId = doc.id;
  const script = await db.documentaryScript.create({
    data: {
      documentaryId,
      targetDurationSeconds: 4,
      status: "APPROVED",
      approvedById: editor.id,
      approvedAt: new Date(),
    },
  });
  const scenes = [
    { narration: "Mwanga the Second became Kabaka of Buganda.", mediaId: photoId, text: null },
    { narration: "A reconstruction shows the court.", mediaId: reconId, text: "The royal court" },
  ];
  for (const [i, s] of scenes.entries()) {
    const scene = await db.documentaryScene.create({
      data: {
        scriptId: script.id,
        position: i,
        narration: s.narration,
        onScreenText: s.text,
        durationSeconds: new Prisma.Decimal(2),
        assets: { create: { mediaId: s.mediaId } },
      },
    });
    const take = tone(1.5, 440 + i * 110);
    const key = `voiceovers/test/scene-${i}.wav`;
    await storage.put(key, take, "audio/wav");
    await db.voiceover.create({
      data: {
        scriptId: script.id,
        sceneId: scene.id,
        source: "UPLOADED_RECORDING",
        storageKey: key,
        mimeType: "audio/wav",
        durationMs: 1500,
        text: s.narration,
        voiceLicense: "Test tone",
        status: "READY",
      },
    });
  }
});

afterAll(async () => {
  await getQueue()?.close();
});

describe("render plan", () => {
  it("only editors render", async () => {
    await expect(
      requestRender(db, researcher, documentaryId, { format: "LANDSCAPE_1080P" }),
    ).rejects.toThrow(/Only editors/);
  });

  it("refuses an image that is no longer approved", async () => {
    await db.mediaAsset.update({ where: { id: reconId }, data: { reviewStatus: "PENDING" } });
    const { problems } = await renderPlan(db, documentaryId);
    expect(problems.join(" ")).toMatch(
      /Scene 2: “Test reconstruction \(flat grey\)” cannot be used/,
    );
    await expect(
      requestRender(db, editor, documentaryId, { format: "LANDSCAPE_1080P" }),
    ).rejects.toThrow(/Cannot render yet/);
    await db.mediaAsset.update({ where: { id: reconId }, data: { reviewStatus: "APPROVED" } });
    expect((await renderPlan(db, documentaryId)).problems).toEqual([]);
  });
});

describe("rendering with FFmpeg", () => {
  it("renders a 16:9 MP4 with sidecar captions, the reconstruction label and a manifest", async () => {
    const r = await render("LANDSCAPE_1080P");
    expect(r.status).toBe("SUCCEEDED");
    const file = await saved(r.storageKey!, "landscape.mp4");
    const info = probe(file);
    const video = info.streams.find((s) => s.codec_type === "video")!;
    expect(video).toMatchObject({ codec_name: "h264", width: 1920, height: 1080 });
    expect(info.streams.find((s) => s.codec_type === "audio")?.codec_name).toBe("aac");
    expect(Number(info.format.duration)).toBeGreaterThan(3.8);
    expect(Number(info.format.duration)).toBeLessThan(4.3);

    // The label box sits top-left on the reconstruction (scene 2), never on the photograph.
    const labelBox = [0x1a, 0x12, 0x03];
    expect(near(pixel(file, 3, 26, 26), labelBox)).toBe(true);
    expect(near(pixel(file, 1, 26, 26), labelBox)).toBe(false);
    // Elsewhere the reconstruction is the plain grey picture.
    expect(near(pixel(file, 3, 960, 400), [0x80, 0x80, 0x80])).toBe(true);

    const captions = await db.videoAsset.findMany({
      where: { documentaryId, kind: "SUBTITLES", title: { contains: r.id } },
      orderBy: { mimeType: "asc" },
    });
    expect(captions.map((c) => c.mimeType)).toEqual(["application/x-subrip", "text/vtt"]);
    const srt = new TextDecoder().decode((await storage.get(captions[0]!.storageKey))!);
    expect(srt).toContain(
      "00:00:00,000 --> 00:00:01,500\nMwanga the Second became Kabaka of\nBuganda.",
    );
    expect(srt).toContain("00:00:02,000 --> 00:00:03,500\nA reconstruction shows the court.");
    const vtt = new TextDecoder().decode((await storage.get(captions[1]!.storageKey))!);
    expect(vtt.startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:01.500")).toBe(true);

    const doc = await db.documentary.findUniqueOrThrow({ where: { id: documentaryId } });
    expect(doc.status).toBe("RENDERED");
    expect(doc.containsSyntheticMedia).toBe(true);
    const manifest = doc.manifest as Record<string, unknown>;
    expect(manifest).toMatchObject({
      documentary: "Render test",
      script: { version: 1, approvedBy: "Video Editor" },
      render: { id: r.id, format: "LANDSCAPE_1080P", width: 1920, height: 1080 },
      containsAiReconstruction: true,
      syntheticVoice: false,
      music: null,
      sources: [],
    });
    expect(manifest.images).toEqual([
      expect.objectContaining({
        title: "King Mwanga II Buganda",
        kind: "Archival photograph",
        license: "Public domain",
        scenes: [1],
      }),
      expect.objectContaining({
        title: "Test reconstruction (flat grey)",
        kind: "AI reconstruction",
        scenes: [2],
      }),
    ]);
  }, 180_000);

  it("renders 9:16 with burned-in captions and a music bed under the narration", async () => {
    const cc0 = await db.mediaLicense.findUniqueOrThrow({ where: { code: "CC0-1.0" } });
    const nc = await db.mediaLicense.findUniqueOrThrow({ where: { code: "CC-BY-NC-4.0" } });
    const track = tone(3, 220);
    await expect(
      uploadMusic(
        db,
        storage,
        editor,
        { body: track, title: "Tone", licenseId: nc.id, attribution: "Test tone" },
        env,
      ),
    ).rejects.toThrow(/does not allow publication/);
    await expect(
      uploadMusic(
        db,
        storage,
        editor,
        {
          body: new TextEncoder().encode("not audio"),
          title: "Tone",
          licenseId: cc0.id,
          attribution: "Test tone",
        },
        env,
      ),
    ).rejects.toThrow(/Only WAV and MP3/);
    const musicId = await uploadMusic(
      db,
      storage,
      editor,
      {
        body: track,
        title: "Test tone bed",
        licenseId: cc0.id,
        attribution: "Generated test tone",
      },
      env,
    );
    const music = await db.videoAsset.findUniqueOrThrow({ where: { id: musicId } });
    expect(music).toMatchObject({ kind: "MUSIC", durationMs: 3000, mimeType: "audio/wav" });

    const r = await render("VERTICAL_1080P", musicId);
    const file = await saved(r.storageKey!, "vertical.mp4");
    const video = probe(file).streams.find((s) => s.codec_type === "video")!;
    expect(video).toMatchObject({ width: 1080, height: 1920 });
    expect(near(pixel(file, 3, 26, 26), [0x1a, 0x12, 0x03])).toBe(true);
    // A burned caption is white text in the lower third, above the Shorts controls.
    const strip = execFileSync("ffmpeg", [
      "-loglevel",
      "error",
      "-ss",
      "2.6",
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "crop=1080:260:0:1300,format=gray",
      "-f",
      "rawvideo",
      "-",
    ]);
    expect(strip.filter((v) => v > 230).length).toBeGreaterThan(500);

    // The music plays under the narration, so the gap after each line (1.5–2 s) is not silent.
    const gap = execFileSync("ffmpeg", [
      "-loglevel",
      "error",
      "-ss",
      "1.65",
      "-t",
      "0.25",
      "-i",
      file,
      "-vn",
      "-ac",
      "1",
      "-f",
      "s16le",
      "-",
    ]);
    const samples = new Int16Array(gap.buffer, gap.byteOffset, gap.byteLength / 2);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(300);
    const manifest = (await db.documentary.findUniqueOrThrow({ where: { id: documentaryId } }))
      .manifest as Record<string, unknown>;
    expect(manifest.music).toEqual({
      title: "Test tone bed",
      license: cc0.name,
      attribution: "Generated test tone",
    });
  }, 180_000);

  it("refuses to run a render whose script was replaced", async () => {
    const { renderId } = await requestRender(db, editor, documentaryId, {
      format: "LANDSCAPE_1080P",
    });
    const r = await db.videoRender.findUniqueOrThrow({ where: { id: renderId } });
    const old = await db.documentaryScript.findFirstOrThrow({ where: { documentaryId } });
    await db.documentaryScript.update({ where: { id: old.id }, data: { status: "SUPERSEDED" } });
    const newer = await db.documentaryScript.create({
      data: {
        documentaryId,
        version: 2,
        targetDurationSeconds: 4,
        status: "APPROVED",
        approvedById: editor.id,
      },
    });
    expect(await runJob(db, r.jobId!, handlers)).toBe("failed");
    expect((await db.videoRender.findUniqueOrThrow({ where: { id: renderId } })).status).toBe(
      "FAILED",
    );
    await db.documentaryScript.delete({ where: { id: newer.id } });
    await db.documentaryScript.update({ where: { id: old.id }, data: { status: "APPROVED" } });
  });
});

describe("thumbnails", () => {
  it("makes a 1280×720 JPEG and labels reconstructions", async () => {
    await expect(
      generateThumbnail(
        db,
        storage,
        researcher,
        { documentaryId, mediaId: photoId, headline: "The Kabaka" },
        env,
      ),
    ).rejects.toThrow(/Only editors/);
    const photoThumb = await generateThumbnail(
      db,
      storage,
      editor,
      { documentaryId, mediaId: photoId, headline: "Mwanga II of Buganda" },
      env,
    );
    const reconThumb = await generateThumbnail(
      db,
      storage,
      editor,
      { documentaryId, mediaId: reconId, headline: "Inside the royal court" },
      env,
    );
    const [a, b] = await Promise.all(
      [photoThumb, reconThumb].map((id) => db.thumbnail.findUniqueOrThrow({ where: { id } })),
    );
    expect(a!.usesSyntheticMedia).toBe(false);
    expect(b!.usesSyntheticMedia).toBe(true);
    for (const [t, name] of [
      [a!, "a.jpg"],
      [b!, "b.jpg"],
    ] as const) {
      const info = probe(await saved(t.storageKey!, name));
      expect(info.streams[0]).toMatchObject({ codec_name: "mjpeg", width: 1280, height: 720 });
    }
    const labelBox = [0x1a, 0x12, 0x03];
    expect(near(pixel(path.join(work, "b.jpg"), 0, 16, 16), labelBox)).toBe(true);
    expect(near(pixel(path.join(work, "a.jpg"), 0, 16, 16), labelBox)).toBe(false);
    expect(RECONSTRUCTION_LABEL).toMatch(/Not an Authentic Photograph/);

    await selectThumbnail(db, editor, photoThumb);
    await selectThumbnail(db, editor, reconThumb);
    const selected = await db.thumbnail.findMany({ where: { documentaryId, isSelected: true } });
    expect(selected.map((t) => t.id)).toEqual([reconThumb]);
  }, 60_000);
});
