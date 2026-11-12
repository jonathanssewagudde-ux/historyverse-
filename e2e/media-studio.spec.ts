import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { withTestClient } from "../tests/support/database";

/**
 * Archival media discovery and the AI Image Studio. No image generator is configured in e2e,
 * so reconstructions are made through the "upload an image made elsewhere" path.
 */
test.skip(({ isMobile }) => isMobile, "Studio flows run once, on desktop");

const PASSWORD = "correct horse battery staple";
let counter = 0;

async function signUpAs(page: Page, testInfo: TestInfo, role: string, name: string) {
  counter += 1;
  const email = `media-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
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

/** A project with a known subject, two discovered images and one accepted research source. */
async function seed(tag: string) {
  const project = `mproj-${tag}`;
  await withTestClient(async (c) => {
    await c.query(
      `INSERT INTO "entities" ("id","kind","slug","name","updatedAt") VALUES ($1,'KINGDOM',$2,$3,now())`,
      [`ment-${tag}`, `ment-${tag}`, `Kingdom ${tag}`],
    );
    await c.query(
      `INSERT INTO "content_projects" ("id","slug","topic","status","primaryEntityId","updatedAt") VALUES ($1,$2,$3,'IN_PROGRESS',$4,now())`,
      [project, `mproj-${tag}`, `Media test ${tag}`, `ment-${tag}`],
    );
    const candidate = (id: string, title: string, code: string, name: string) =>
      c.query(
        `INSERT INTO "media_candidates" ("id","projectId","provider","sourceRef","title","sourceUrl","licenseCode","licenseName","attribution","retrievedAt","updatedAt")
         VALUES ($1,$2,'commons',$3,$4,$5,$6,$7,'Test via Wikimedia Commons',now(),now())`,
        [
          id,
          project,
          `File:${title}.jpg`,
          title,
          `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}.jpg`,
          code,
          name,
        ],
      );
    await candidate(`mc1-${tag}`, `Palace engraving ${tag}`, "PD", "Public domain");
    await candidate(`mc2-${tag}`, `Football match ${tag}`, "CC-BY-SA-4.0", "CC BY-SA 4.0");
    await c.query(
      `INSERT INTO "research_sources" ("id","projectId","kind","tier","provider","title","authors","url","status","reviewedAt","retrievedAt","updatedAt")
       VALUES ($1,$2,'BOOK','SECONDARY','openlibrary',$3,'{}',$4,'ACCEPTED',now(),now(),now())`,
      [`mrs-${tag}`, project, `Court life ${tag}`, `https://openlibrary.org/works/M${tag}W`],
    );
  });
  return project;
}

test("a researcher adds a discovered image only after confirming its licence", async ({
  page,
}, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  const project = await seed(tag);
  await signUpAs(page, testInfo, "RESEARCHER", "Lia Licence");
  await page.goto(`/admin/projects/${project}`);
  const step = page.getByRole("region", { name: "3. Archival media" });
  await expect(step.getByRole("textbox", { name: "Search the archives for" })).toHaveValue(
    `Kingdom ${tag}`,
  );

  const engraving = step.getByRole("listitem").filter({ hasText: `Palace engraving ${tag}` });
  await expect(engraving).toContainText("Licence as stated: Public domain");
  await engraving.getByRole("button", { name: /Add .* to the library/ }).click();
  await expect(engraving.getByRole("alert")).toHaveText(
    "Confirm that you checked the licence on the source page.",
  );
  await engraving
    .getByRole("checkbox", { name: "I checked the licence on the source page." })
    .check();
  await engraving.getByRole("button", { name: /Add .* to the library/ }).click();
  await expect(engraving).toContainText("selected · Lia Licence");

  const football = step.getByRole("listitem").filter({ hasText: `Football match ${tag}` });
  await football.getByRole("button", { name: /Reject/ }).click();
  await expect(football.getByRole("alert")).toContainText("Say briefly why");
  await football.getByRole("textbox", { name: /Note on/ }).fill("Modern sport, off topic");
  await football.getByRole("button", { name: /Reject/ }).click();
  await expect(football).toContainText("rejected · Lia Licence · Modern sport, off topic");

  // It is in the library, unclassified and pending, with the licence check recorded.
  await page.goto("/admin/media?review=PENDING");
  const card = page.getByRole("article").filter({ hasText: `Palace engraving ${tag}` });
  await expect(card).toContainText("licence checked by Lia Licence");
  await expect(card).toContainText("not yet classified");
});

test("a reconstruction needs evidence, is uploaded with the label, and approved by an editor", async ({
  browser,
}, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  await seed(tag);
  const researcher = await browser.newPage();
  await signUpAs(researcher, testInfo, "RESEARCHER", "Rex Recon");
  await researcher.goto("/admin/ai-images");
  await expect(researcher.locator("#main")).toContainText(
    "not available — No image generator is configured",
  );

  const form = researcher.getByRole("region", { name: "New reconstruction prompt" });
  await form
    .getByRole("combobox", { name: "Project" })
    .selectOption({ label: `Media test ${tag}` });
  await form.getByRole("button", { name: "Start from the subject" }).click();
  await expect(form.getByRole("textbox", { name: "Prompt", exact: true })).toHaveValue(
    new RegExp(`Kingdom ${tag}`),
  );
  await form.getByRole("button", { name: "Save prompt" }).click();
  await expect(form.getByRole("alert")).toContainText("Replace the [describe …] placeholders");

  await form
    .getByRole("textbox", { name: "Prompt", exact: true })
    .fill(
      `Documentary illustration of the royal court of Kingdom ${tag}, thatched halls, bark-cloth robes.`,
    );
  await form
    .getByRole("textbox", { name: "What rests on evidence" })
    .fill("Halls and robes follow the cited description of court life.");
  await form
    .getByRole("textbox", { name: "What is interpretation" })
    .fill("Faces, colours and weather are invented.");
  await form.getByRole("checkbox", { name: `Court life ${tag}` }).check();
  await form
    .getByRole("textbox", { name: `What Court life ${tag} supports` })
    .fill("Describes halls and garments");
  await form.getByRole("button", { name: "Save prompt" }).click();
  await expect(form.getByRole("status")).toHaveText("Prompt saved with its evidence.");

  const card = researcher.getByRole("article", { name: `Reconstruction for Kingdom ${tag}` });
  await expect(card).toContainText("Interpretation: Faces, colours and weather are invented.");
  await expect(card.getByRole("button", { name: "Generate" })).toBeDisabled();
  await card.getByLabel("Image made elsewhere").setInputFiles({
    name: "recon.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.concat([
      readFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg"),
      Buffer.from(tag),
    ]),
  });
  await card.getByRole("textbox", { name: "Tool used" }).fill("a local diffusion model");
  await card.getByRole("button", { name: "Upload as reconstruction" }).click();
  await expect(
    card.getByText("AI-Generated Historical Reconstruction — Not an Authentic Photograph").first(),
  ).toBeVisible();
  await researcher.close();

  const editor = await browser.newPage();
  await signUpAs(editor, testInfo, "EDITOR", "Eve Editor");
  await editor.goto("/admin/ai-images");
  const review = editor.getByRole("article", { name: `Reconstruction for Kingdom ${tag}` });
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(review.getByRole("alert")).toContainText("Describe what the image shows");
  await review
    .getByRole("textbox", { name: /Describe what the image shows/ })
    .fill("A thatched royal hall with courtiers");
  await review.getByRole("button", { name: "Approve" }).click();
  await expect(review).toContainText("Review: approved");
  await expect(review.locator("img").first()).toHaveAttribute(
    "alt",
    "AI reconstruction: A thatched royal hall with courtiers",
  );
  await editor.close();
});

for (const theme of ["dark", "light"] as const) {
  test(`media studio pages have no detectable accessibility violations (${theme})`, async ({
    page,
  }, testInfo) => {
    const project = await seed(`axe${theme}${testInfo.workerIndex}${Date.now()}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await signUpAs(page, testInfo, "ADMINISTRATOR", "Axe Admin");
    for (const path of ["/admin/ai-images", `/admin/projects/${project}`]) {
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
