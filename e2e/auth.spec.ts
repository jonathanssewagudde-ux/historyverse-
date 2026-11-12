import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { withTestClient } from "../tests/support/database";

const PASSWORD = "correct horse battery staple";

// Assertions are scoped to #main: while a page streams, React briefly holds incoming content in a
// hidden buffer outside it, and Next keeps its own role="alert" route announcer in the document.

let counter = 0;
/** Unique per test and per browser project, so parallel runs never collide. */
function uniqueEmail(testInfo: TestInfo): string {
  counter += 1;
  return `e2e-${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
}

async function signUp(page: Page, email: string, name = "Ada Tester") {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function setRole(email: string, role: string) {
  return withTestClient((client) =>
    client.query(`UPDATE "users" SET "role" = $2::"UserRole" WHERE "email" = $1`, [email, role]),
  );
}

test.describe("access control", () => {
  test("anonymous visitors are sent to sign in with a return path", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile$/);
  });

  test("a forged session cookie does not grant access", async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "hv.session_token", value: "forged.signature", url: baseURL! },
    ]);
    await page.goto("/admin");
    // The optimistic proxy lets the request through; the server-side check rejects it.
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("the auth API never returns another user's data to an anonymous caller", async ({
    request,
  }) => {
    const res = await request.get("/api/auth/get-session");
    expect(res.status()).toBe(200);
    expect(await res.json()).toBeNull();
  });
});

test.describe("accounts", () => {
  test("sign-up shows validation errors inline", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("A");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("a new reader gets a profile, an account menu, and no Studio access", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await expect(page.locator("#main").getByTestId("role-badge")).toHaveText("Reader");
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the Studio" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: /don't have access to the Studio/i }),
    ).toBeVisible();
    await expect(page.getByText("Database")).toHaveCount(0);

    await signOut(page);
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fprofile$/);
  });

  test("duplicate registration is refused", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await signOut(page);
    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("Someone Else");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#main").getByRole("alert")).toContainText(/already exists/);
  });

  test("wrong passwords are rejected, and sign-in returns to the requested page", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await signOut(page);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
    await signIn(page, email, "definitely the wrong password");
    await expect(page.locator("#main").getByRole("alert")).toHaveText(
      "That email and password do not match.",
    );
    await expect(page).toHaveURL(/\/sign-in/);

    await signIn(page, email);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("a hostile ?next= value cannot redirect off-site", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await signOut(page);
    await page.goto("/sign-in?next=//evil.example/steal");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("profile details and password can be changed", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);

    await page
      .getByRole("form", { name: "Profile details" })
      .getByLabel("Name")
      .fill("Ada Renamed");
    await page.getByLabel("About you").fill("Into the Great Lakes kingdoms.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Ada Renamed" })).toBeVisible();
    await expect(page.getByLabel("About you")).toHaveValue("Into the Great Lakes kingdoms.");

    const newPassword = "an entirely new passphrase";
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible();

    await signOut(page);
    await page.goto("/sign-in");
    await signIn(page, email, PASSWORD);
    await expect(page.locator("#main").getByRole("alert")).toHaveText(
      "That email and password do not match.",
    );
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/profile$/);
  });
});

test.describe("AI Studio", () => {
  test("a researcher sees the overview but not administrator panels", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email, "Rita Researcher");
    await setRole(email, "RESEARCHER");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Hey, Rita" })).toBeVisible();
    await expect(page.locator("#main").getByText("Connected ·")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Integrations" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recent activity" })).toHaveCount(0);

    await page.goto("/profile");
    await expect(page.locator("#main").getByTestId("role-badge")).toHaveText("Researcher");
    await expect(page.getByRole("link", { name: "Open the Studio" })).toBeVisible();
  });

  test("a super administrator sees database status, integrations and the audit trail", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email, "Sam Super");
    await setRole(email, "SUPER_ADMINISTRATOR");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Hey, Sam" })).toBeVisible();
    await expect(page.locator("#main").getByText("Connected ·")).toBeVisible();

    const integrations = page.getByRole("table");
    await expect(integrations.getByRole("row", { name: /PostgreSQL/ })).toContainText("Configured");
    await expect(integrations.getByRole("row", { name: /PostgreSQL/ })).toContainText("Yes");
    await expect(integrations.getByRole("row", { name: /YouTube Data API/ })).toContainText(
      "Not configured",
    );
    await expect(integrations.getByRole("row", { name: /YouTube Data API/ })).toContainText(
      "Milestone 12",
    );

    const activity = page.getByRole("region", { name: "Recent activity" });
    await expect(activity.getByText("user.registered").first()).toBeVisible();
    // The page must never render secrets or connection strings.
    await expect(page.locator("body")).not.toContainText(/postgres(ql)?:\/\//);
  });

  test("a demotion takes effect on the very next request", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email, "Eddie Editor");
    await setRole(email, "EDITOR");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Hey, Eddie" })).toBeVisible();

    await setRole(email, "USER");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /don't have access to the Studio/i }),
    ).toBeVisible();
  });

  test("studio navigation lists unbuilt modules without linking to them", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await setRole(email, "ADMINISTRATOR");
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Studio" });
    // Milestones 3–7 modules are links; later ones are labelled with their milestone.
    await expect(nav.getByRole("link")).toHaveCount(16);
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Historical Media Library" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Video Editor" })).toHaveCount(0);
    await expect(nav.getByText("Video Editor")).toBeVisible();
  });
});

test.describe("data imports", () => {
  test("readers are refused; researchers see imported data with its source and review status", async ({
    page,
  }, testInfo) => {
    const qid = `Q9${Date.now()}${testInfo.workerIndex}`;
    await withTestClient(async (client) => {
      const id = `e2e-${qid}`;
      await client.query(
        `INSERT INTO "entities" ("id","kind","slug","name","summary","wikidataId","updatedAt") VALUES ($1,'PERSON',$2,$3,'e2e fixture record',$4,now())`,
        [id, `e2e-${qid.toLowerCase()}`, `Fixture Person ${qid}`, qid],
      );
      await client.query(
        `INSERT INTO "historical_claims" ("id","statement","origin","verification","entityId","property","updatedAt") VALUES ($1,'fixture claim','IMPORT','UNVERIFIED',$2,'P31',now())`,
        [`claim-${qid}`, id],
      );
    });

    const email = uniqueEmail(testInfo);
    await signUp(page, email);
    await page.goto("/admin/imports");
    await expect(
      page.getByRole("heading", { name: /don't have access to the Studio/i }),
    ).toBeVisible();

    await setRole(email, "RESEARCHER");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Imported data" })).toBeVisible();
    const row = page
      .locator("#main")
      .getByRole("row", { name: new RegExp(`Fixture Person ${qid}`) });
    await expect(row).toContainText("1 · 1 unverified");
    await expect(row).toContainText("draft");
    await expect(row.getByRole("link", { name: qid })).toHaveAttribute(
      "href",
      `https://www.wikidata.org/wiki/${qid}`,
    );
    await expect(page.locator("#main")).toContainText("unreviewed draft");
  });
});

test.describe("accessibility", () => {
  for (const path of ["/sign-in", "/sign-up"]) {
    test(`${path} has no detectable violations`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }

  for (const theme of ["dark", "light"] as const) {
    test(`profile and studio have no detectable violations (${theme})`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      const email = uniqueEmail(testInfo);
      await signUp(page, email);
      await setRole(email, "SUPER_ADMINISTRATOR");
      for (const path of ["/profile", "/admin", "/admin/imports"]) {
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
});
