import { describe, expect, it } from "vitest";
import {
  canAssignRole,
  hasPermission,
  hasRoleAtLeast,
  isRole,
  permissionsFor,
  roles,
  type Permission,
} from "./roles";

describe("roles", () => {
  it("is a strict hierarchy: each role keeps every permission of the role below", () => {
    for (let i = 1; i < roles.length; i++) {
      const lower = permissionsFor(roles[i - 1]!);
      const higher = permissionsFor(roles[i]!);
      for (const p of lower) expect(higher).toContain(p);
      expect(higher.length).toBeGreaterThan(lower.length);
    }
  });

  it("keeps readers out of the Studio and reserves publishing for editors and above", () => {
    expect(hasPermission("USER", "studio:access")).toBe(false);
    expect(hasPermission("RESEARCHER", "studio:access")).toBe(true);
    expect(hasPermission("RESEARCHER", "article:draft")).toBe(true);
    expect(hasPermission("RESEARCHER", "article:publish")).toBe(false);
    expect(hasPermission("EDITOR", "article:publish")).toBe(true);
    expect(hasPermission("EDITOR", "claim:verify")).toBe(true);
  });

  it("reserves spending and YouTube publishing for administrators", () => {
    const sensitive: Permission[] = ["spend:approve", "youtube:upload", "youtube:publish"];
    for (const p of sensitive) {
      expect(hasPermission("EDITOR", p)).toBe(false);
      expect(hasPermission("ADMINISTRATOR", p)).toBe(true);
    }
  });

  it("reserves role assignment and settings for super administrators", () => {
    const top: Permission[] = [
      "role:assign",
      "user:manage",
      "integration:manage",
      "settings:manage",
    ];
    for (const p of top) {
      expect(hasPermission("ADMINISTRATOR", p)).toBe(false);
      expect(hasPermission("SUPER_ADMINISTRATOR", p)).toBe(true);
    }
  });

  it("compares seniority and validates role strings", () => {
    expect(hasRoleAtLeast("EDITOR", "RESEARCHER")).toBe(true);
    expect(hasRoleAtLeast("RESEARCHER", "EDITOR")).toBe(false);
    expect(hasRoleAtLeast("EDITOR", "EDITOR")).toBe(true);
    expect(isRole("EDITOR")).toBe(true);
    expect(isRole("ROOT")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("only lets super administrators assign roles, and never to themselves", () => {
    const boss = { id: "1", role: "SUPER_ADMINISTRATOR" } as const;
    expect(canAssignRole(boss, { id: "2" }, "EDITOR")).toBe(true);
    expect(canAssignRole(boss, { id: "1" }, "USER")).toBe(false);
    expect(canAssignRole({ id: "3", role: "ADMINISTRATOR" }, { id: "2" }, "EDITOR")).toBe(false);
  });
});
