import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { withTestClient } from "../tests/support/database";

/**
 * The editorial lifecycle of the real Buganda article file, loaded as a draft by global setup.
 * Runs serially on one project because publishing changes shared state.
 */
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "stateful flow runs once, on desktop");

const PASSWORD = "correct horse battery staple";
const MWANGA = "/media/e2emediamwanga00000000001";
const MUTESA = "/media/e2emediamutesa000000000001";

async function signUpAs(page: Page, role: string, name: string) {
  const email = `articles-${role.toLowerCase()}-${Date.now()}@test.invalid`;
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

async function articleId() {
  return withTestClient(
    async (c) =>
      (await c.query<{ id: string }>(`SELECT "id" FROM "articles" WHERE "slug" = 'buganda'`))
        .rows[0]!.id,
  );
}

test("a draft is invisible to the public and so are its unapproved images", async ({
  page,
  request,
}) => {
  const res = await page.goto("/kingdoms/buganda");
  expect(res?.status()).toBe(404);
  await page.goto("/kingdoms");
  await expect(page.locator("#main").getByText("Nothing published here yet")).toBeVisible();
  expect((await request.get(MWANGA)).status()).toBe(404);
  expect((await request.get(MUTESA)).status()).toBe(404);
});

test("a researcher can preview but not publish", async ({ page }) => {
  await signUpAs(page, "RESEARCHER", "Rita Researcher");
  await page.goto(`/admin/articles/${await articleId()}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Complete History of the Buganda Kingdom" }),
  ).toBeVisible();
  await expect(page.locator("#main").getByRole("note")).toContainText("AI-assisted draft");
  await expect(
    page.locator("#main").getByText("Only editors can approve articles for publication."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve and publish" })).toHaveCount(0);
  // Staff can load an unapproved image for review.
  expect((await page.request.get(MWANGA)).status()).toBe(200);
});

test("an editor must confirm the source check, then publishes", async ({ page }) => {
  await signUpAs(page, "EDITOR", "Eddie Editor");
  await page.goto("/admin/articles");
  await expect(page.locator("#main")).toContainText("unreviewed AI draft");
  await page.getByRole("link", { name: "The Complete History of the Buganda Kingdom" }).click();

  const controls = page.getByRole("region", { name: "Editorial approval" });
  await expect(controls).toContainText(
    /Will be withheld: Mutesa I \(licence "CC BY-NC 4\.0" does not allow publication\)/,
  );
  await expect(
    page.locator("#main").getByText(/Not shown publicly: licence "CC BY-NC 4\.0"/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.locator("#main").getByRole("alert")).toHaveText(
    /Confirm that you have checked/,
  );

  await page.getByLabel(/I have checked this article against its cited sources/).check();
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.locator("#main").getByRole("status")).toHaveText(
    /Published\. 1 image\(s\) were withheld\./,
  );
  await expect(page.getByRole("link", { name: "/kingdoms/buganda" })).toBeVisible();
});

test("readers see the published article with sources and only the approved image", async ({
  page,
  request,
}) => {
  await page.goto("/kingdoms/buganda");
  await expect(page).toHaveTitle(/The Complete History of the Buganda Kingdom/);
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "The Complete History of the Buganda Kingdom",
  );
  await expect(main.getByRole("heading", { name: "Origins: two accounts" })).toBeVisible();
  await expect(
    main.getByText("HISTORYVERSE presents both accounts rather than choosing between them."),
  ).toBeVisible();
  await expect(main.getByRole("note")).toHaveCount(0); // no review notes for readers

  // The hero is the approved, labelled historical artwork with its licence credit.
  const hero = main.locator("figure").first();
  await expect(hero.getByText("Historical artwork")).toBeVisible();
  await expect(hero.getByRole("link", { name: "Public domain" })).toBeVisible();
  expect((await request.get(MWANGA)).status()).toBe(200);
  // The non-commercial image never reaches readers.
  await expect(main.locator(`img[src="${MUTESA}"]`)).toHaveCount(0);
  expect((await request.get(MUTESA)).status()).toBe(404);

  // Citations jump to numbered references that point at the real sources.
  const references = main.getByRole("region", { name: "Sources and references" });
  await expect(
    references.getByRole("link", { name: "Uganda: A Country Study" }).first(),
  ).toHaveAttribute("href", "https://countrystudies.us/uganda/");
  await main.getByRole("link", { name: "Source 1" }).first().click();
  await expect(page).toHaveURL(/#ref-1$/);

  const dates = main.getByRole("region", { name: "Key dates" });
  await expect(dates.getByRole("listitem").first()).toContainText("1844");
  await expect(dates.getByRole("listitem").last()).toContainText("31 July 1993");

  await expect(
    main.getByRole("region", { name: "Watch the HISTORYVERSE Documentary" }),
  ).toContainText("No documentary yet");

  await page.goto("/kingdoms");
  await page.getByRole("link", { name: /The Complete History of the Buganda Kingdom/ }).click();
  await expect(page).toHaveURL(/\/kingdoms\/buganda$/);
});

test("the text size control changes and remembers the reading size", async ({ page }) => {
  await page.goto("/kingdoms/buganda");
  const article = page.locator("#main #article");
  await expect(article).toHaveAttribute("data-reading-size", "md");
  await page.getByRole("button", { name: "Larger text" }).click();
  await expect(article).toHaveAttribute("data-reading-size", "lg");
  await page.reload();
  await expect(page.locator("#main #article")).toHaveAttribute("data-reading-size", "lg");
});

test("the wrong section and unknown slugs are 404s", async ({ page }) => {
  expect((await page.goto("/people/buganda"))?.status()).toBe(404);
  expect((await page.goto("/kingdoms/not-a-real-kingdom"))?.status()).toBe(404);
  expect((await page.goto("/kingdoms/..%2F..%2Fetc"))?.status()).toBe(404);
});

for (const theme of ["dark", "light"] as const) {
  test(`the article page has no detectable accessibility violations (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    for (const path of ["/kingdoms/buganda", "/kingdoms", "/countries"]) {
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

test("an editor can unpublish with a reason, and the page disappears", async ({ page }) => {
  await signUpAs(page, "EDITOR", "Una Unpublisher");
  await page.goto(`/admin/articles/${await articleId()}`);
  await page.getByLabel("Reason for unpublishing").fill("End-to-end test cleanup");
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.locator("#main").getByRole("status")).toHaveText(/Unpublished/);
  expect((await page.goto("/kingdoms/buganda"))?.status()).toBe(404);
});
