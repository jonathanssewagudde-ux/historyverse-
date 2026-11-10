import { expect, test } from "@playwright/test";

test.describe("foundation smoke tests", () => {
  test("health endpoint reports ok and is never cached", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "historyverse",
      checks: { database: "up" },
    });
    expect(Date.parse(body.time)).not.toBeNaN();
    // The public probe must not leak configuration details.
    expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|API_KEY|SECRET|postgres(ql)?:\/\//);
  });

  test("home page renders without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    await page.goto("/");
    await expect(page).toHaveTitle(/HISTORYVERSE/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /discover the story of our world/i,
    );
    expect(errors).toEqual([]);
  });

  test("theme defaults to dark and toggles to light", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/dark/);
    await page.getByRole("button", { name: /toggle colour theme/i }).click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test("layout has no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("unknown routes return the custom 404", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /lost to history/i })).toBeVisible();
  });
});
