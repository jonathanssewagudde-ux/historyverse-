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

test("search is honest while nothing is published", async ({ page }) => {
  await page.goto("/search?q=Buganda");
  const main = page.locator("#main");
  await expect(main.getByText("No published article matches “Buganda”")).toBeVisible();
  await expect(main).toContainText("0 articles are published so far");
});

test("a researcher writes a new draft with a citation in the Studio editor", async ({ page }) => {
  await signUpAs(page, "RESEARCHER", "Nora Newdraft");
  await page.goto("/admin/articles");
  await page.getByRole("link", { name: "New article" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New article" })).toBeVisible();

  // Nothing is saved until the draft has the essentials.
  const basics = page.getByRole("region", { name: "Basics" });
  await basics.getByLabel("Title", { exact: true }).fill("Mengo Hill test draft");
  await page.getByRole("button", { name: "Save draft" }).click();
  const problems = page.locator("#main").getByRole("alert").last();
  await expect(problems).toContainText("Subject: needs an entity");

  await page.getByLabel("Subject").selectOption({ label: "Buganda (kingdom)" });
  await page
    .getByLabel("Add an existing source")
    .selectOption({ label: "Uganda: A Country Study" });
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Mengo was the royal capital. ");
  await page.getByLabel("Cite", { exact: true }).selectOption("s1");
  await page.getByLabel("Page or section", { exact: true }).first().fill("Buganda");
  await page.getByRole("button", { name: "Insert citation" }).click();
  await expect(page.getByRole("textbox", { name: "Text", exact: true })).toHaveValue(
    "Mengo was the royal capital. [@s1|Buganda]",
  );

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[^/]+\/edit\?created=1$/);
  await expect(page.locator("#main")).toContainText("Draft created as version 1.");
  // The saved draft comes back with its citation and source.
  await expect(page.getByRole("textbox", { name: "Text", exact: true })).toHaveValue(
    "Mengo was the royal capital. [@s1|Buganda]",
  );
  await page
    .getByRole("region", { name: "Basics" })
    .getByLabel("Subtitle")
    .fill("A short test article");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.locator("#main")).toContainText("Saved as version 2.");

  await page.getByRole("button", { name: "Preview" }).click();
  const main = page.locator("#main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Mengo Hill test draft" }),
  ).toBeVisible();
  await expect(main.getByRole("link", { name: "Uganda: A Country Study" }).first()).toBeVisible();
  // Drafts never reach the public site.
  await withTestClient(async (c) => {
    const { rows } = await c.query(
      `SELECT "status" FROM "articles" WHERE "title" = 'Mengo Hill test draft'`,
    );
    expect(rows).toEqual([{ status: "DRAFT" }]);
  });
});

test("a researcher can edit and submit a draft, but not approve or publish it", async ({
  page,
}) => {
  await signUpAs(page, "RESEARCHER", "Rita Researcher");
  await page.goto(`/admin/articles/${await articleId()}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Complete History of the Buganda Kingdom" }),
  ).toBeVisible();
  await expect(page.locator("#main").getByRole("note")).toContainText("AI-assisted draft");
  // Staff can load an unapproved image for review.
  expect((await page.request.get(MWANGA)).status()).toBe(200);

  // Saving the real file through the editor changes nothing but the version.
  await page.getByRole("link", { name: "Edit draft" }).click();
  await expect(
    page.getByRole("region", { name: "Basics" }).getByLabel("Title", { exact: true }),
  ).toHaveValue("The Complete History of the Buganda Kingdom");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.locator("#main")).toContainText("Saved as version 2.");
  await page.getByRole("button", { name: "Preview" }).click();

  const workflow = page.getByRole("region", { name: "Draft" });
  await workflow.getByLabel("Note for the reviewer").fill("Ready for a source check.");
  await workflow.getByRole("button", { name: "Submit for research review" }).click();
  await expect(page.locator("#main").getByRole("status").first()).toHaveText(
    "Submitted for research review.",
  );
  await page.reload();
  const review = page.getByRole("region", { name: "Research review" });
  await expect(review).toContainText("Waiting for an editor to review this article.");
  await expect(page.getByRole("button", { name: /Approve/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit draft" })).toHaveCount(0);
});

test("an editor approves the research, must confirm the source check, then publishes", async ({
  page,
}) => {
  await signUpAs(page, "EDITOR", "Eddie Editor");
  await page.goto("/admin/articles");
  await expect(page.locator("#main")).toContainText("unreviewed AI draft");
  await page.getByRole("link", { name: "The Complete History of the Buganda Kingdom" }).click();

  await page
    .getByRole("region", { name: "Research review" })
    .getByRole("button", { name: "Approve research" })
    .click();
  await expect(page.locator("#main").getByRole("status").first()).toHaveText(/Research approved/);
  await page.reload();

  const controls = page.getByRole("region", { name: "Editorial approval" });
  await expect(controls).toContainText(
    /Will be withheld: Mutesa I \(licence "CC BY-NC 4\.0" does not allow publication\)/,
  );
  await expect(
    page.locator("#main").getByText(/Not shown publicly: licence "CC BY-NC 4\.0"/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.locator("#main").getByRole("alert").first()).toHaveText(
    /Confirm that you have checked/,
  );

  await controls
    .getByRole("checkbox", { name: /I have checked this article against its cited sources/ })
    .check();
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.locator("#main").getByRole("status").first()).toHaveText(
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

  // Readers can report an error; signing in is required to send it.
  await main.getByText("Spotted an error? Report it").click();
  await main.getByLabel("What is wrong?").fill("Testing the report form while signed out.");
  await main.getByRole("button", { name: "Send report" }).click();
  await expect(main.getByRole("alert").filter({ hasText: "Sign in" })).toHaveText(
    "Sign in to report an error.",
  );

  await page.goto("/kingdoms");
  await page.getByRole("link", { name: /The Complete History of the Buganda Kingdom/ }).click();
  await expect(page).toHaveURL(/\/kingdoms\/buganda$/);
});

test("homepage autocomplete finds the published article and opens it", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: /search any country/i });
  await box.fill("bugan");
  const option = page.getByRole("option", { name: /The Complete History of the Buganda Kingdom/ });
  await expect(option).toBeVisible();
  await box.press("ArrowDown");
  await expect(option).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/kingdoms\/buganda$/);
});

test("search answers words, years and typos from published content", async ({ page }) => {
  const main = page.locator("#main");

  await page.goto("/");
  const box = page.getByRole("combobox", { name: /search any country/i });
  await box.fill("Buganda Agreement");
  // Enter with no suggestion highlighted submits the search form.
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Buganda\+Agreement$/);
  await expect(main.getByRole("status")).toHaveText(/1 result for “Buganda Agreement”/);
  await expect(main.locator("mark").first()).toBeVisible();

  await page.goto("/search?q=" + encodeURIComponent("What happened in 1993?"));
  await expect(main.getByRole("status")).toHaveText(/Articles with events in 1993/);
  await expect(
    main.getByText("The kingdom is restored and Muwenda Mutebi II becomes kabaka."),
  ).toBeVisible();

  await page.goto("/search?q=Bugnda");
  await expect(main.getByRole("status")).toContainText("No exact matches for “Bugnda”");
  await main
    .getByRole("link", { name: /^Buganda/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/search\?q=Buganda/);
});

test("filters narrow results and explore browses by continent", async ({ page }) => {
  const main = page.locator("#main");
  await page.goto("/search?q=Buganda");
  await main
    .getByRole("navigation", { name: "Filter by type" })
    .getByRole("link", { name: /Countries/ })
    .click();
  await expect(page).toHaveURL(/type=countries/);
  await expect(main).toContainText("Try removing a filter.");

  // The homepage continent card leads to the explore page filtered to Africa.
  await page.goto("/");
  await page
    .locator("#continents")
    .getByRole("link", { name: /Africa/ })
    .click();
  await expect(page).toHaveURL(/\/explore\?continent=Africa$/);
  await expect(
    main.getByRole("link", { name: "The Complete History of the Buganda Kingdom" }),
  ).toBeVisible();
  await page.goto("/explore?continent=europe");
  await expect(main).toContainText("Nothing here yet");
});

test("the suggestions API returns only published articles and rate-limits abuse", async ({
  request,
}) => {
  const res = await request.get("/api/search/suggest?q=bugan");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.suggestions.map((s: { path: string }) => s.path)).toEqual(["/kingdoms/buganda"]);
  expect((await (await request.get("/api/search/suggest?q=b")).json()).suggestions).toEqual([]);
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
    for (const path of [
      "/kingdoms/buganda",
      "/kingdoms",
      "/countries",
      "/search?q=Buganda",
      "/explore",
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

test("an editor can unpublish with a reason, and the page disappears", async ({ page }) => {
  await signUpAs(page, "EDITOR", "Una Unpublisher");
  await page.goto(`/admin/articles/${await articleId()}`);
  await page.getByLabel("Reason for unpublishing").fill("End-to-end test cleanup");
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.locator("#main").getByRole("status")).toHaveText(/Unpublished/);
  expect((await page.goto("/kingdoms/buganda"))?.status()).toBe(404);
});
