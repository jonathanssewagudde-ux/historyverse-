import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { withTestClient } from "../tests/support/database";

/**
 * Generate History Project in the Studio. The e2e server has a Redis queue but no worker and no
 * language model, so jobs stay queued and drafting is honestly unavailable; finished research
 * is seeded directly into the database.
 */
test.skip(({ isMobile }) => isMobile, "Studio flows run once, on desktop");

const PASSWORD = "correct horse battery staple";
let counter = 0;

async function signUpAs(page: Page, testInfo: TestInfo, role: string, name: string) {
  counter += 1;
  const email = `research-${testInfo.workerIndex}-${Date.now()}-${counter}@test.invalid`;
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

/** A project whose research has finished, with two candidate sources. */
async function seedResearchedProject(tag: string, extra?: { draftEstimate?: number }) {
  const id = `proj-${tag}`;
  const report = {
    subject: {
      qid: "Q473748",
      name: "Buganda",
      kind: "KINGDOM",
      dates: "1420 (Julian) – 1966",
      summary: "a Bantu kingdom within Uganda",
      matchedBy: "search",
      alternatives: [
        { qid: "Q6695337", label: "Lubiri", description: "Official palace for Buganda Kingdom" },
      ],
    },
    periods: [],
    people: [],
    events: [],
    places: [],
    dates: [
      { label: "1420 (Julian)", statement: "Buganda: inception is 1420.", sortKey: "14200000" },
    ],
    conflicts: [],
    counts: { sources: 2, byProvider: { wikipedia: 1, openlibrary: 1 } },
    warnings: [],
  };
  await withTestClient(async (c) => {
    await c.query(
      `INSERT INTO "content_projects" ("id","slug","topic","status","updatedAt") VALUES ($1,$2,$3,'IN_PROGRESS',now())`,
      [id, `project-${tag}`, `Research test ${tag}`],
    );
    await c.query(
      `INSERT INTO "production_jobs" ("id","projectId","type","status","progress","attempts","output","startedAt","finishedAt","updatedAt")
       VALUES ($1,$2,'RESEARCH','SUCCEEDED',100,1,$3,now(),now(),now())`,
      [`job-r-${tag}`, id, JSON.stringify({ report })],
    );
    await c.query(
      `INSERT INTO "research_sources" ("id","projectId","kind","tier","provider","title","authors","url","licenseNote","excerpts","retrievedAt","updatedAt")
       VALUES ($1,$2,'ENCYCLOPEDIA','TERTIARY','wikipedia','Wikipedia: Buganda','{}',$3,'CC BY-SA 4.0',$4,now(),now()),
              ($5,$2,'BOOK','UNKNOWN','openlibrary','A history of Buganda','{"M. S. M. Kiwanuka"}',$6,NULL,NULL,now(),now())`,
      [
        `rs-wp-${tag}`,
        id,
        `https://en.wikipedia.org/wiki/Buganda?${tag}`,
        JSON.stringify([
          { heading: "Introduction", text: "Buganda is a Bantu kingdom within Uganda." },
        ]),
        `rs-book-${tag}`,
        `https://openlibrary.org/works/OL-${tag}W`,
      ],
    );
    if (extra?.draftEstimate) {
      await c.query(
        `INSERT INTO "production_jobs" ("id","projectId","type","status","costEstimateUsd","input","updatedAt")
         VALUES ($1,$2,'ARTICLE_DRAFT','AWAITING_APPROVAL',$3,$4,now())`,
        [
          `job-d-${tag}`,
          id,
          extra.draftEstimate,
          JSON.stringify({ estimateBasis: "≈9,000 input tokens + up to 16,000 output tokens" }),
        ],
      );
    }
  });
  return id;
}

test("an administrator starts a project; research waits honestly for a worker", async ({
  page,
}, testInfo) => {
  await signUpAs(page, testInfo, "ADMINISTRATOR", "Ana Admin");
  await page.goto("/admin/research");
  await page.getByRole("link", { name: "Generate History Project" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Generate History Project" }),
  ).toBeVisible();
  await expect(page.locator("#main")).toContainText("no worker is running");
  await expect(page.locator("#main")).toContainText(
    "not available: No language model is configured",
  );

  const topic = `The History of Testland ${testInfo.workerIndex}-${Date.now()}`;
  await page.getByRole("textbox", { name: "Topic" }).fill(topic);
  await page.getByRole("button", { name: "Start research" }).click();
  await expect(page).toHaveURL(/\/admin\/projects\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { level: 1, name: topic })).toBeVisible();
  const research = page.getByRole("region", { name: "1. Research" });
  await expect(research).toContainText("queued");
  await expect(page.getByRole("status").filter({ hasText: "No worker is running" })).toBeVisible();
  // Steps after drafting are labelled with their milestone.
  await expect(page.getByRole("list", { name: "Pipeline" })).toContainText("Review · M12");
  await research.getByRole("button", { name: "Cancel" }).click();
  await expect(research).toContainText("cancelled");
});

test("researchers cannot start projects", async ({ page }, testInfo) => {
  await signUpAs(page, testInfo, "RESEARCHER", "Rob Researcher");
  await page.goto("/admin/projects/new");
  await expect(
    page.getByRole("heading", { name: /don't have access to this page/i }),
  ).toBeVisible();
});

test("a researcher reviews the source set; drafting says why it is unavailable", async ({
  page,
}, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  const id = await seedResearchedProject(tag);
  await signUpAs(page, testInfo, "RESEARCHER", "Rhea Reviewer");
  await page.goto(`/admin/projects/${id}`);

  const research = page.getByRole("region", { name: "1. Research" });
  await expect(research).toContainText("Buganda (Q473748)");
  await expect(research).toContainText("Chosen as the best Wikidata match");
  await expect(research).toContainText("Lubiri (Q6695337)");

  const sources = page.getByRole("region", { name: /Source set/ });
  await sources.getByRole("button", { name: "Approve the source set" }).click();
  await expect(sources.getByRole("alert").first()).toContainText("Accept at least one source");

  await sources.getByRole("button", { name: "Reject A history of Buganda" }).click();
  await expect(
    sources.getByRole("listitem").filter({ hasText: "A history of Buganda" }).getByRole("alert"),
  ).toContainText("Say briefly why");
  await sources.getByRole("button", { name: "Accept Wikipedia: Buganda" }).click();
  await expect(
    sources.getByRole("heading", { name: "Source set (1 accepted of 2)" }),
  ).toBeVisible();
  await sources.getByRole("button", { name: "Approve the source set" }).click();
  await expect(sources).toContainText("Approved by Rhea Reviewer");
  await expect(sources.getByRole("button", { name: /Accept|Reject/ })).toHaveCount(0);

  const draft = page.getByRole("region", { name: "2. Article draft" });
  await expect(draft).toContainText("not available — No language model is configured");
  await expect(draft.getByRole("button", { name: "Request an AI-assisted draft" })).toHaveCount(0);
});

test("spending needs an administrator's explicit approval within the budget", async ({
  page,
}, testInfo) => {
  const tag = `${testInfo.workerIndex}${Date.now()}`;
  const id = await seedResearchedProject(tag, { draftEstimate: 0.42 });
  await signUpAs(page, testInfo, "ADMINISTRATOR", "Bea Budget");
  await page.goto(`/admin/projects/${id}`);
  const draft = page.getByRole("region", { name: "2. Article draft" });
  await expect(draft).toContainText("awaiting cost approval");
  await expect(draft).toContainText("Estimated cost: up to $0.4200");
  await expect(draft).toContainText("Monthly ceiling $0.00 (AI_MONTHLY_BUDGET_USD)");

  await draft.getByRole("button", { name: "Approve spending" }).click();
  await expect(draft.getByRole("alert")).toHaveText("Confirm that you approve this spending.");
  await draft.getByRole("checkbox", { name: /I approve spending up to \$0\.4200/ }).check();
  await draft.getByRole("button", { name: "Approve spending" }).click();
  await expect(draft.getByRole("alert")).toContainText("Over the project budget");
});

for (const theme of ["dark", "light"] as const) {
  test(`research pages have no detectable accessibility violations (${theme})`, async ({
    page,
  }, testInfo) => {
    const id = await seedResearchedProject(`axe${theme}${testInfo.workerIndex}${Date.now()}`, {
      draftEstimate: 0.1,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await signUpAs(page, testInfo, "ADMINISTRATOR", "Axe Admin");
    for (const path of ["/admin/research", "/admin/projects/new", `/admin/projects/${id}`]) {
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
