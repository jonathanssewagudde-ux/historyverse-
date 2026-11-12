import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { pcmToWavForTests } from "./support/wav";
import { withTestClient } from "../tests/support/database";

/**
 * Documentary scripts and narration. Uses its own small published article so it runs alongside
 * the article lifecycle. No narration engine is configured in e2e, so the recorded-take path is used.
 */
test.skip(({ isMobile }) => isMobile, "Studio flows run once, on desktop");

const PASSWORD = "correct horse battery staple";
let counter = 0;

async function signUpAs(page: Page, testInfo: TestInfo, role: string, name: string) {
  counter += 1;
  const email = `doc-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
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

/** A published two-section article with one cited source and one approved image. */
async function seedArticle(tag: string) {
  const id = `docart-${tag}`;
  await withTestClient(async (c) => {
    const license = (
      await c.query<{ id: string }>(`SELECT "id" FROM "media_licenses" WHERE "code" = 'PD'`)
    ).rows[0]!.id;
    await c.query(
      `INSERT INTO "articles" ("id","slug","title","template","status","publishedAt","updatedAt") VALUES ($1,$2,$3,'GENERAL','PUBLISHED',now(),now())`,
      [id, `docart-${tag}`, `Testland ${tag}`],
    );
    await c.query(
      `INSERT INTO "sources" ("id","type","title","authors","updatedAt") VALUES ($1,'BOOK','A History of Testland','{}',now())`,
      [`docsrc-${tag}`],
    );
    const sections: [string, string, string | null, string][] = [
      [
        `docsec1-${tag}`,
        "INTRODUCTION",
        null,
        "Testland lies on the shore of a great lake.[^1]\n\nIts kings ruled for centuries.[^1]",
      ],
      [`docsec2-${tag}`, "LEGACY", "Legacy", "Testland's court still meets today.[^1]"],
    ];
    for (const [i, [sid, kind, heading, body]] of sections.entries()) {
      await c.query(
        `INSERT INTO "article_sections" ("id","articleId","position","kind","heading","body","updatedAt") VALUES ($1,$2,$3,$4::"SectionKind",$5,$6,now())`,
        [sid, id, i, kind, heading, body],
      );
      await c.query(
        `INSERT INTO "citations" ("id","sourceId","articleId","sectionId","position","locator") VALUES ($1,$2,$3,$4,1,'p. 1')`,
        [`doccit${i}-${tag}`, `docsrc-${tag}`, id, sid],
      );
    }
    await c.query(
      `INSERT INTO "media_assets" ("id","kind","title","altText","sourceName","sourceRef","attribution","licenseId","storageKey","mimeType","reviewStatus","updatedAt")
       VALUES ($1,'ARTWORK',$2,'An engraving of the court','Test archive',$3,'Test','${license}',$4,'image/jpeg','APPROVED',now())`,
      [`docimg-${tag}`, `Court engraving ${tag}`, `ref-${tag}`, `media/dd/${tag}.jpg`],
    );
    await c.query(
      `INSERT INTO "article_media" ("articleId","mediaId","position") VALUES ($1,$2,0)`,
      [id, `docimg-${tag}`],
    );
  });
  return `Testland ${tag}`;
}

test("an editor builds, approves and narrates a documentary script", async ({ page }, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  const title = await seedArticle(tag);
  await signUpAs(page, testInfo, "EDITOR", "Dora Documentary");
  await page.goto("/admin/scripts");
  await page
    .getByRole("combobox", { name: "Article" })
    .selectOption({ label: `${title} (published)` });
  await page.getByRole("button", { name: "Build a script from the article" }).click();
  await expect(page).toHaveURL(/\/admin\/documentaries\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  const scenes = page.getByRole("region", { name: "Scenes" });
  await expect(scenes.getByRole("listitem", { name: /^Scene 1: Hook$/ })).toBeVisible();
  await expect(scenes.getByRole("listitem", { name: /^Scene 3: Conclusion$/ })).toBeVisible();
  await expect(scenes.getByRole("textbox", { name: "Narration (scene 1)" })).toHaveValue(
    "Testland lies on the shore of a great lake.",
  );

  // Edit a scene, then send it through review.
  const first = scenes.getByRole("listitem", { name: /^Scene 1/ });
  await first.getByRole("textbox", { name: "On-screen text" }).fill("Testland");
  await first.getByRole("button", { name: "Save scene 1" }).click();
  await expect(first.getByRole("status")).toHaveText("Saved.");

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("button", { name: "Approve script" })).toBeVisible();
  await page.getByRole("button", { name: "Approve script" }).click();
  await expect(page.locator("#main")).toContainText("approved by Dora Documentary");

  const narration = page.getByRole("region", { name: "Narration" });
  await expect(narration).toContainText("not available — No narration engine is configured");
  await expect(narration.getByRole("button", { name: "Narrate every scene" })).toBeDisabled();

  // Upload a recorded take with the speaker's consent.
  const scene1 = scenes.getByRole("listitem", { name: /^Scene 1/ });
  await scene1.getByText("Upload a recorded take for scene 1").click();
  await scene1.getByLabel("Recording (WAV or MP3)").setInputFiles({
    name: "take.wav",
    mimeType: "audio/wav",
    buffer: pcmToWavForTests(2),
  });
  await scene1.getByRole("textbox", { name: "Speaker" }).fill("Nalwoga");
  await scene1.getByRole("button", { name: "Upload take" }).click();
  await expect(scene1.getByRole("alert")).toContainText("agreed to their voice being published");
  await scene1.getByRole("checkbox", { name: /agreed to their voice being published/ }).check();
  await scene1.getByRole("button", { name: "Upload take" }).click();
  await expect(scene1).toContainText("Recording · recording · Nalwoga · 2.0 s");
  await expect(scene1).toContainText(
    "Voice licence: Recorded by Nalwoga; consent to publish confirmed",
  );
  const audio = scene1.getByRole("group").or(scene1.locator("audio")).first();
  const src = await scene1.locator("audio").getAttribute("src");
  expect(src).toMatch(/^\/audio\/[a-z0-9]+$/);
  const res = await page.request.get(src!, { headers: { Range: "bytes=0-43" } });
  expect(res.status()).toBe(206);
  expect((await res.body()).subarray(0, 4).toString()).toBe("RIFF");
  await expect(audio).toBeVisible();
  // Audio is staff-only.
  expect(
    (
      await page
        .context()
        .browser()!
        .newContext()
        .then((ctx) => ctx.request.get(src!))
    ).status(),
  ).toBe(404);
});

test("researchers cannot work on documentaries", async ({ page }, testInfo) => {
  await signUpAs(page, testInfo, "RESEARCHER", "Remy Researcher");
  for (const path of ["/admin/scripts", "/admin/voiceovers"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: /don't have access to this page/i }),
    ).toBeVisible();
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`documentary pages have no detectable accessibility violations (${theme})`, async ({
    page,
  }, testInfo) => {
    const tag = `axe${theme}${testInfo.workerIndex}${Date.now()}`;
    const title = await seedArticle(tag);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await signUpAs(page, testInfo, "EDITOR", "Axe Editor");
    await page.goto("/admin/scripts");
    await page
      .getByRole("combobox", { name: "Article" })
      .selectOption({ label: `${title} (published)` });
    await page.getByRole("button", { name: "Build a script from the article" }).click();
    await expect(page).toHaveURL(/\/admin\/documentaries\//);
    const documentary = new URL(page.url()).pathname;
    for (const path of ["/admin/scripts", "/admin/voiceovers", documentary]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          path,
          id: v.id,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        })),
      ).toEqual([]);
    }
  });
}
