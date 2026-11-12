import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { pcmToWavForTests } from "./support/wav";
import { withTestClient } from "../tests/support/database";
import { testEnv } from "../tests/support/test-env";

/**
 * The Video Editor. Rendering itself runs on the worker and is covered with the real FFmpeg in
 * tests/integration/video.test.ts; here a finished render (a short FFmpeg test pattern) is seeded
 * so the review screens can be checked. Thumbnails and music uploads run FFmpeg for real.
 */
test.skip(({ isMobile }) => isMobile, "Studio flows run once, on desktop");

const PASSWORD = "correct horse battery staple";
const STORAGE = path.resolve(testEnv.STORAGE_LOCAL_DIR);
let counter = 0;

async function signUpAs(page: Page, testInfo: TestInfo, role: string, name: string) {
  counter += 1;
  const email = `video-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await withTestClient((c) =>
    c.query(`UPDATE "users" SET "role" = $2::"UserRole" WHERE "email" = $1`, [email, role]),
  );
}

function store(key: string, from: string) {
  const full = path.join(STORAGE, key);
  mkdirSync(path.dirname(full), { recursive: true });
  copyFileSync(from, full);
}

/**
 * A documentary with an approved one-scene script (picture + recorded narration) and one
 * finished 16:9 render with WebVTT captions.
 */
async function seedDocumentary(tag: string) {
  const work = mkdtempSync(path.join(tmpdir(), "hv-e2e-video-"));
  const mp4 = path.join(work, "render.mp4");
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=30:duration=1",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    mp4,
  ]);
  const take = path.join(work, "take.wav");
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=duration=1.5",
    take,
  ]);
  store(`media/ve/${tag}.jpg`, "tests/fixtures/media/king-mwanga-ii-buganda.jpg");
  store(`voiceovers/ve/${tag}.wav`, take);
  store(`renders/ve/${tag}.mp4`, mp4);
  const vtt = path.join(work, "c.vtt");
  execFileSync("sh", [
    "-c",
    `printf 'WEBVTT\\n\\n00:00:00.000 --> 00:00:01.000\\nTestland.\\n' > '${vtt}'`,
  ]);
  store(`captions/ve/${tag}.vtt`, vtt);

  const ids = { doc: `vedoc${tag}`, render: `verender${tag}` };
  await withTestClient(async (c) => {
    const pd = (
      await c.query<{ id: string }>(`SELECT "id" FROM "media_licenses" WHERE "code" = 'PD'`)
    ).rows[0]!.id;
    await c.query(
      `INSERT INTO "media_assets" ("id","kind","title","altText","sourceName","sourceRef","attribution","licenseId","storageKey","mimeType","reviewStatus","updatedAt")
       VALUES ($1,'AUTHENTIC_PHOTO',$2,'Engraving of a king','Test archive',$3,'Public domain','${pd}',$4,'image/jpeg','APPROVED',now())`,
      [`veimg${tag}`, `Engraving ${tag}`, `veref-${tag}`, `media/ve/${tag}.jpg`],
    );
    await c.query(
      `INSERT INTO "documentaries" ("id","slug","title","updatedAt") VALUES ($1,$2,$3,now())`,
      [ids.doc, `ve-${tag}`, `Testland on film ${tag}`],
    );
    await c.query(
      `INSERT INTO "documentary_scripts" ("id","documentaryId","version","status","targetDurationSeconds","approvedAt","updatedAt")
       VALUES ($1,$2,1,'APPROVED',2,now(),now())`,
      [`vescript${tag}`, ids.doc],
    );
    await c.query(
      `INSERT INTO "documentary_scenes" ("id","scriptId","position","narration","durationSeconds","updatedAt")
       VALUES ($1,$2,0,'Testland lies on the shore of a great lake.',2,now())`,
      [`vescene${tag}`, `vescript${tag}`],
    );
    await c.query(`INSERT INTO "scene_assets" ("sceneId","mediaId") VALUES ($1,$2)`, [
      `vescene${tag}`,
      `veimg${tag}`,
    ]);
    await c.query(
      `INSERT INTO "voiceovers" ("id","scriptId","sceneId","source","provider","storageKey","mimeType","durationMs","text","voiceLicense","status")
       VALUES ($1,$2,$3,'UPLOADED_RECORDING','recording',$4,'audio/wav',1500,'Testland lies on the shore of a great lake.','Recorded by a test speaker; consent to publish confirmed','READY')`,
      [`vetake${tag}`, `vescript${tag}`, `vescene${tag}`, `voiceovers/ve/${tag}.wav`],
    );
    await c.query(
      `INSERT INTO "video_renders" ("id","documentaryId","scriptId","format","width","height","status","progress","storageKey","bytes","durationSeconds","finishedAt")
       VALUES ($1,$2,$3,'LANDSCAPE_1080P',1920,1080,'SUCCEEDED',100,$4,$5,1,now())`,
      [
        ids.render,
        ids.doc,
        `vescript${tag}`,
        `renders/ve/${tag}.mp4`,
        readFileSync(mp4).byteLength,
      ],
    );
    await c.query(
      `INSERT INTO "video_assets" ("id","documentaryId","kind","title","storageKey","mimeType","language")
       VALUES ($1,$2,'SUBTITLES',$3,$4,'text/vtt','en')`,
      [
        `vecaptions${tag}`,
        ids.doc,
        `Captions v1 (VTT, en) for render ${ids.render}`,
        `captions/ve/${tag}.vtt`,
      ],
    );
  });
  return { ...ids, title: `Testland on film ${tag}` };
}

test("an editor reviews a render, queues another and makes a thumbnail", async ({
  page,
}, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  const doc = await seedDocumentary(tag);
  await signUpAs(page, testInfo, "EDITOR", "Vera Video");

  await page.goto("/admin/video-editor");
  await expect(page.getByRole("heading", { level: 1, name: "Video Editor" })).toBeVisible();
  await expect(page.locator("#main")).toContainText(/ffmpeg version/);
  await page.getByRole("link", { name: doc.title }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/documentaries/${doc.doc}#video$`));

  const video = page.getByRole("region", { name: "Video" });
  await expect(video).toContainText("Ready to render script v1");
  const render = video.getByRole("listitem", { name: "Render 16:9 (YouTube)" });
  await expect(render).toContainText("done");
  const src = await render.locator("video").getAttribute("src");
  expect(src).toBe(`/video/${doc.render}`);
  await expect(render.locator("video track")).toHaveAttribute(
    "src",
    `/video-assets/vecaptions${tag}`,
  );

  // The player seeks with byte ranges; downloads are attachments.
  const ranged = await page.request.get(src!, { headers: { Range: "bytes=0-99" } });
  expect(ranged.status()).toBe(206);
  expect(ranged.headers()["content-type"]).toBe("video/mp4");
  expect((await ranged.body()).subarray(4, 8).toString()).toBe("ftyp");
  const download = await page.request.get(`${src}?download=1`);
  expect(download.headers()["content-disposition"]).toBe(
    `attachment; filename="ve-${tag}-landscape_1080p.mp4"`,
  );
  const captions = await page.request.get(`/video-assets/vecaptions${tag}?download=1`);
  expect((await captions.text()).startsWith("WEBVTT")).toBe(true);
  // Renders are staff-only until publication is approved.
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(src!)).status()).toBe(404);
  expect((await anonymous.request.get(`/video-assets/vecaptions${tag}`)).status()).toBe(404);
  await anonymous.close();

  // Queue a vertical render (the worker is not running in e2e, so it stays queued).
  await video.getByRole("radio", { name: /9:16 \(Shorts\)/ }).check();
  await expect(video.getByRole("checkbox", { name: /Burn captions/ })).toBeChecked();
  await video.getByRole("button", { name: "Render video" }).click();
  await expect(video.getByRole("status").first()).toContainText("Render queued");
  await expect(video.getByRole("listitem", { name: "Render 9:16 (Shorts)" })).toContainText(
    "queued",
  );

  // A thumbnail from the approved picture, made with FFmpeg.
  await video
    .getByRole("combobox", { name: "Picture" })
    .selectOption({ label: `Engraving ${tag}` });
  await video.getByRole("textbox", { name: "Headline" }).fill("Testland");
  await video.getByRole("button", { name: "Make thumbnail" }).click();
  await expect(video.getByText("Thumbnail made.")).toBeVisible();
  const thumb = video.getByRole("img", { name: "Thumbnail: Testland" });
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1280);
  await video.getByRole("button", { name: "Use thumbnail “Testland”" }).click();
  await expect(video.getByText("selected", { exact: true })).toBeVisible();

  await page.goto("/admin/thumbnails");
  const group = page.getByRole("region", { name: doc.title });
  await expect(group.getByRole("img", { name: "Thumbnail: Testland" })).toBeVisible();
  await expect(group).toContainText("selected");
});

test("an editor adds licensed music to the library", async ({ page }, testInfo) => {
  await signUpAs(page, testInfo, "EDITOR", "Milo Music");
  await page.goto("/admin/video-editor");
  const library = page.getByRole("region", { name: "Music library" });
  const title = `Calm bed ${testInfo.workerIndex}${Date.now()}`;
  await library.getByLabel("Track (WAV or MP3, up to 10 MB)").setInputFiles({
    name: "bed.wav",
    mimeType: "audio/wav",
    buffer: pcmToWavForTests(2),
  });
  await library.getByRole("textbox", { name: "Title" }).fill(title);
  await library
    .getByRole("combobox", { name: "Licence" })
    .selectOption({ label: "CC0 1.0 Universal" });
  // Only licences that allow publication are offered.
  await expect(
    library.getByRole("combobox", { name: "Licence" }).locator("option", { hasText: "NC" }),
  ).toHaveCount(0);
  await library.getByRole("button", { name: "Add track" }).click();
  await expect(library.getByRole("alert")).toHaveText(/Give the attribution/);
  await library.getByRole("textbox", { name: /Attribution/ }).fill("Silence, made for testing");
  await library.getByRole("button", { name: "Add track" }).click();
  await expect(library.getByRole("status")).toHaveText("Track added to the music library.");
  await expect(library).toContainText(`${title} · CC0 1.0 Universal · 0:02`);
  const src = await library
    .getByRole("listitem")
    .filter({ hasText: title })
    .locator("audio")
    .getAttribute("src");
  const res = await page.request.get(src!, { headers: { Range: "bytes=0-3" } });
  expect(res.status()).toBe(206);
  expect((await res.body()).toString()).toBe("RIFF");
});

test("researchers cannot use the video tools", async ({ page }, testInfo) => {
  await signUpAs(page, testInfo, "RESEARCHER", "Remy Researcher");
  for (const route of ["/admin/video-editor", "/admin/thumbnails"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: /don't have access to this page/i }),
    ).toBeVisible();
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`video pages have no detectable accessibility violations (${theme})`, async ({
    page,
  }, testInfo) => {
    const tag = `axe${theme}${testInfo.workerIndex}${Date.now()}`;
    const doc = await seedDocumentary(tag);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await signUpAs(page, testInfo, "EDITOR", "Axe Editor");
    for (const route of [
      "/admin/video-editor",
      "/admin/thumbnails",
      `/admin/documentaries/${doc.doc}`,
    ]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        })),
      ).toEqual([]);
    }
  });
}
