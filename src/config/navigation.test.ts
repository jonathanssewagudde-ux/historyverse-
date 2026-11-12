import { describe, expect, it } from "vitest";
import { availableRoutes, footerNav, isRouteAvailable, primaryNav } from "./navigation";

describe("navigation", () => {
  it("only marks implemented routes as available", () => {
    expect([...availableRoutes].sort()).toEqual([
      "/",
      "/admin",
      "/admin/articles",
      "/admin/calendar",
      "/admin/categories",
      "/admin/citations",
      "/admin/civilizations",
      "/admin/countries",
      "/admin/events",
      "/admin/imports",
      "/admin/integrations",
      "/admin/kingdoms",
      "/admin/media",
      "/admin/people",
      "/admin/projects/new",
      "/admin/research",
      "/admin/reviews",
      "/admin/settings",
      "/admin/users",
      "/countries",
      "/explore",
      "/kingdoms",
      "/people",
      "/profile",
      "/search",
      "/sign-in",
      "/sign-up",
    ]);
    expect(isRouteAvailable("/")).toBe(true);
    expect(isRouteAvailable("/countries")).toBe(true);
    expect(isRouteAvailable("/timeline")).toBe(false);
    expect(isRouteAvailable("/search?q=uganda")).toBe(true);
    expect(isRouteAvailable("/#search")).toBe(true);
  });

  it("assigns every unavailable item to a future milestone", () => {
    const all = [...primaryNav, ...footerNav.flatMap((g) => g.items)];
    for (const item of all) {
      if (!isRouteAvailable(item.href)) expect(item.milestone).toBeGreaterThan(2);
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("has unique primary links", () => {
    const hrefs = primaryNav.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
