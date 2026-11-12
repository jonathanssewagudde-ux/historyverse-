import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { withTestClient } from "../tests/support/database";

/**
 * The Studio CMS modules. Each test creates its own records, so this file runs in parallel with
 * the article lifecycle without touching the Buganda article or its images.
 */
test.skip(({ isMobile }) => isMobile, "Studio flows run once, on desktop");

const PASSWORD = "correct horse battery staple";
let counter = 0;

async function signUpAs(page: Page, testInfo: TestInfo, role: string, name: string) {
  counter += 1;
  const email = `studio-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await withTestClient((c) =>
    c.query(`UPDATE "users" SET "role" = $2::"UserRole" WHERE "email" = $1`, [email, role]),
  );
  return email;
}

/** A 2×2 PNG, generated so the upload never collides with other test files. */
function png(seed: number): Buffer {
  const base = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAAMIM////ZwAAHu8E/KPItPcAAAAASUVORK5CYII=",
    "base64",
  );
  // Extra bytes after IEND keep the image valid but change its checksum.
  return Buffer.concat([base, Buffer.from(`seed-${seed}-${Date.now()}`)]);
}

test("an editor verifies a sourced claim in the kingdoms manager", async ({ page }, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  await withTestClient(async (c) => {
    await c.query(
      `INSERT INTO "entities" ("id","kind","slug","name","updatedAt") VALUES ($1,'KINGDOM',$2,$3,now())`,
      [`studio-k-${tag}`, `studio-k-${tag}`, `Studio Kingdom ${tag}`],
    );
    await c.query(
      `INSERT INTO "sources" ("id","type","title","authors","updatedAt") VALUES ($1,'BOOK','A Studio Test Source','{}',now())`,
      [`studio-s-${tag}`],
    );
    await c.query(
      `INSERT INTO "historical_claims" ("id","statement","origin","verification","entityId","updatedAt") VALUES ($1,'The kingdom had a royal drum.','IMPORT','UNVERIFIED',$2,now()), ($3,'An unsourced statement.','IMPORT','UNVERIFIED',$2,now())`,
      [`studio-c-${tag}`, `studio-k-${tag}`, `studio-u-${tag}`],
    );
    await c.query(`INSERT INTO "citations" ("id","sourceId","claimId") VALUES ($1,$2,$3)`, [
      `studio-ct-${tag}`,
      `studio-s-${tag}`,
      `studio-c-${tag}`,
    ]);
  });

  await signUpAs(page, testInfo, "EDITOR", "Vera Verifier");
  await page.goto(`/admin/kingdoms?q=${tag}`);
  await page.getByRole("link", { name: `Studio Kingdom ${tag}` }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: `Studio Kingdom ${tag}` }),
  ).toBeVisible();

  const claims = page.getByRole("region", { name: "Claims" });
  const sourced = claims.getByRole("listitem").filter({ hasText: "The kingdom had a royal drum." });
  await expect(sourced).toContainText("Source: A Studio Test Source");
  await sourced.getByRole("button", { name: "Verify" }).click();
  await expect(sourced).toContainText("verified by Vera Verifier");

  const unsourced = claims.getByRole("listitem").filter({ hasText: "An unsourced statement." });
  await expect(unsourced).toContainText("No source cited.");
  await unsourced.getByRole("button", { name: "Verify" }).click();
  await expect(unsourced.getByRole("alert")).toHaveText(
    /without a cited source cannot be verified/,
  );
});

test("the import form validates Wikidata ids before contacting Wikidata", async ({
  page,
}, testInfo) => {
  await signUpAs(page, testInfo, "RESEARCHER", "Iggy Importer");
  await page.goto("/admin/people");
  await page.getByRole("textbox", { name: "Wikidata id" }).fill("not-an-id");
  await page.getByRole("button", { name: "Import from Wikidata" }).click();
  await expect(page.locator("#main").getByRole("alert").first()).toHaveText(
    "Enter a Wikidata id such as Q1036.",
  );
});

test("a researcher uploads an image; an editor classifies and approves it", async ({
  browser,
}, testInfo) => {
  const title = `Studio upload ${testInfo.workerIndex}-${Date.now()}`;
  const researcher = await browser.newPage();
  await signUpAs(researcher, testInfo, "RESEARCHER", "Uma Uploader");
  await researcher.goto("/admin/media");
  const upload = researcher.locator("#main details").filter({ hasText: "Upload an image" });
  await upload.getByText("Upload an image").click();
  await upload.getByLabel(/Image file/).setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: png(1),
  });
  await upload.getByLabel("Title").fill(title);
  await upload.getByLabel("Licence").selectOption({ label: "Public domain" });
  await upload.getByLabel(/Attribution/).fill("HISTORYVERSE test suite");
  await upload.getByLabel("Where it comes from").fill("Generated test image");
  await upload.getByRole("button", { name: "Upload" }).click();
  await expect(upload.getByRole("status")).toHaveText(/Uploaded\. It waits for classification/);
  // Researchers cannot approve.
  const mine = researcher.getByRole("article").filter({ hasText: title });
  await expect(mine.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await researcher.close();

  const editor = await browser.newPage();
  await signUpAs(editor, testInfo, "EDITOR", "Ed Approver");
  await editor.goto("/admin/media");
  const card = editor.getByRole("article").filter({ hasText: title });
  await expect(card).toContainText("Cannot be shown publicly: not yet classified");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByRole("alert")).toHaveText(/not yet classified/);

  await card.getByLabel("What it is").selectOption("DIAGRAM");
  await card.getByLabel("Alt text").fill("A tiny test pattern of four pixels");
  await card.getByRole("button", { name: "Save details" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved.");
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByRole("status")).toHaveText("Approved.");
  // Approved and publishable: the file is now public.
  const id = await withTestClient(
    async (c) =>
      (await c.query<{ id: string }>(`SELECT "id" FROM "media_assets" WHERE "title" = $1`, [title]))
        .rows[0]!.id,
  );
  expect((await editor.context().request.get(`/media/${id}`)).status()).toBe(200);
  await editor.close();
});

test("a super administrator changes a role, tests an integration and reads the audit log", async ({
  page,
}, testInfo) => {
  const target = `role-target-${testInfo.workerIndex}-${Date.now()}@test.invalid`;
  await withTestClient((c) =>
    c.query(
      `INSERT INTO "users" ("id","name","email","role","updatedAt") VALUES ($1,'Rory Roletarget',$2,'USER',now())`,
      [`u-${Date.now()}-${testInfo.workerIndex}`, target],
    ),
  );
  await signUpAs(page, testInfo, "SUPER_ADMINISTRATOR", "Sam Super");

  await page.goto(`/admin/users?q=${encodeURIComponent(target)}`);
  const row = page.getByRole("listitem").filter({ hasText: target });
  await row.getByLabel("Role for Rory Roletarget").selectOption("RESEARCHER");
  await row.getByRole("button", { name: "Change" }).click();
  await expect(row.getByRole("status")).toHaveText("Role changed.");

  await page.goto("/admin/integrations");
  const postgres = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "PostgreSQL", exact: true }) });
  await postgres.getByRole("button", { name: "Test PostgreSQL" }).click();
  await expect(postgres).toContainText("Connected");
  await expect(postgres).toContainText(/extensions: pg_trgm, unaccent, vector/);
  // Integrations without an adapter offer no test.
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: /YouTube/ }) })
      .getByRole("button"),
  ).toHaveCount(0);

  await page.goto("/admin/settings?action=user.role_changed");
  await expect(page.getByRole("region", { name: "Audit entries" })).toContainText(
    "user.role_changed",
  );
});

test("researchers are refused the pages that need a higher role", async ({ page }, testInfo) => {
  await signUpAs(page, testInfo, "RESEARCHER", "Rex Restricted");
  for (const path of ["/admin/users", "/admin/reviews", "/admin/calendar", "/admin/integrations"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: /don't have access to this page/i }),
    ).toBeVisible();
  }
});

test("the scheduled-publishing endpoint is off unless a secret is configured", async ({
  request,
}) => {
  expect((await request.post("/api/cron/publish")).status()).toBe(404);
});

for (const theme of ["dark", "light"] as const) {
  test(`studio pages have no detectable accessibility violations (${theme})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await signUpAs(page, testInfo, "SUPER_ADMINISTRATOR", "Axe Admin");
    for (const path of [
      "/admin/articles",
      "/admin/articles/new",
      "/admin/kingdoms",
      "/admin/media",
      "/admin/citations",
      "/admin/categories",
      "/admin/reviews",
      "/admin/calendar",
      "/admin/users",
      "/admin/integrations",
      "/admin/settings",
    ]) {
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
