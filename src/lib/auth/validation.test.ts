import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  changePasswordSchema,
  fieldErrors,
  safeNextPath,
  signInSchema,
  signUpSchema,
} from "./validation";

describe("safeNextPath", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin?tab=users#top", "/admin?tab=users#top"],
    ["/profile", "/profile"],
  ])("keeps same-site path %s", (input, expected) => expect(safeNextPath(input)).toBe(expected));

  it.each([
    "//evil.example",
    "//evil.example/admin",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    null,
    undefined,
  ])("rejects open-redirect attempt %s", (input) => expect(safeNextPath(input)).toBe("/profile"));
});

describe("schemas", () => {
  it("normalises emails and requires a password to sign in", () => {
    expect(signInSchema.parse({ email: "  Ada@Example.ORG ", password: "x" }).email).toBe(
      "ada@example.org",
    );
    expect(signInSchema.safeParse({ email: "nope", password: "" }).success).toBe(false);
  });

  it("enforces name and password length at sign-up with readable messages", () => {
    const result = signUpSchema.safeParse({ name: "A", email: "a@b.co", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        name: "Enter your name.",
        password: "Use at least 10 characters.",
      });
    }
    expect(
      signUpSchema.safeParse({ name: "Ada", email: "a@b.co", password: "long enough pass" })
        .success,
    ).toBe(true);
  });

  it("refuses to change a password to the same password", () => {
    const same = changePasswordSchema.safeParse({
      currentPassword: "same password!",
      newPassword: "same password!",
    });
    expect(same.success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known failures and never leaks server details", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toMatch(/do not match/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/);
    expect(authErrorMessage({ status: 503 })).toMatch(/not available/);
    expect(
      authErrorMessage({ code: "SOMETHING_INTERNAL", message: "stack trace at db.ts:42" }),
    ).toBe("Something went wrong. Please try again.");
  });
});
