import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { isRouteAvailable } from "../src/config/navigation";

test.describe("homepage", () => {
  test("renders all fifteen sections in order", async ({ page }) => {
    await page.goto("/");
    const headings = page.getByRole("heading", { level: 2 });
    await expect(headings.first()).toHaveText("Featured Historical Stories");
    // Footer group headings are h2 too; the homepage sections come first.
    const texts = await headings.allTextContents();
    expect(texts.slice(0, 15)).toEqual([
      "Featured Historical Stories",
      "Today in History",
      "Explore the World",
      "Ancient Civilizations",
      "Kings and Queens",
      "Presidents and World Leaders",
      "Great African Kingdoms",
      "Historical Mysteries",
      "Famous Historical Figures",
      "History of Technology",
      "Interactive World Timeline",
      "Explore by Continent",
      "Latest Documentaries",
      "Popular Searches",
      "Recently Published Stories",
    ]);
  });

  test("search explains it is not open yet instead of faking results", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: /search any country/i });
    await page.getByRole("button", { name: "All kings of Buganda" }).click();
    await expect(box).toHaveValue("All kings of Buganda");
    await box.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: /not open yet/ })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("today's date comes from the browser", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-03-15T12:00:00"));
    await page.goto("/");
    await expect(page.getByTestId("today-date")).toHaveText("15 March");
  });

  test("era timeline is keyboard operable", async ({ page }) => {
    await page.goto("/");
    const first = page.getByRole("tab", { name: "Prehistory" });
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Medieval" })).toBeFocused();
    await expect(page.getByTestId("era-range")).toHaveText("c. 500 – c. 1500");
  });

  test("every link points to an implemented route", async ({ page }) => {
    await page.goto("/");
    // Wait for the header's account control so its link is included in the check.
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) {
      expect(href.startsWith("#") || isRouteAvailable(href), `unexpected link: ${href}`).toBe(true);
    }
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("no horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`has no detectable accessibility violations (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      }));
      expect(summary).toEqual([]);
    });
  }
});

test.describe("mobile navigation", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("menu opens, lists sections with their milestones, and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Countries")).toBeVisible();
    await expect(dialog.getByText("soon · M13").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });
});
