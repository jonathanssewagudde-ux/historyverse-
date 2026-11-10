import { describe, expect, it } from "vitest";
import { redact } from "./logger";

describe("redact", () => {
  it("masks secret-looking keys at any depth", () => {
    expect(
      redact({
        user: "ada",
        apiKey: "sk-123",
        nested: { AUTH_SECRET: "x", list: [{ access_token: "t", ok: 1 }] },
        headers: { Authorization: "Bearer y" },
      }),
    ).toEqual({
      user: "ada",
      apiKey: "[redacted]",
      nested: { AUTH_SECRET: "[redacted]", list: [{ access_token: "[redacted]", ok: 1 }] },
      headers: { Authorization: "[redacted]" },
    });
  });

  it("passes primitives through", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(null)).toBeNull();
  });
});
