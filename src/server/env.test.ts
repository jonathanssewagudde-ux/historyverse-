import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("applies safe defaults with an empty environment", () => {
    const { env, issues } = parseServerEnv({});
    expect(issues).toEqual([]);
    expect(env.AI_PROVIDER).toBe("none");
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(0);
    expect(env.INTEGRATIONS_DISABLED).toEqual([]);
    expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(true);
    expect(env.AUTH_TRUSTED_ORIGINS).toEqual([]);
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("treats empty strings as unset", () => {
    const { env, issues } = parseServerEnv({ DATABASE_URL: "", AI_PROVIDER: "" });
    expect(issues).toEqual([]);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AI_PROVIDER).toBe("none");
  });

  it("isolates malformed values instead of failing the whole environment", () => {
    const { env, issues } = parseServerEnv({
      DATABASE_URL: "mysql://nope",
      AUTH_SECRET: "short",
      AI_PROVIDER: "made-up",
      REDIS_URL: "redis://localhost:6379",
    });
    expect(issues.map((i) => i.key).sort()).toEqual(["AI_PROVIDER", "AUTH_SECRET", "DATABASE_URL"]);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AI_PROVIDER).toBe("none");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("never echoes secret values in issue messages", () => {
    const secret = "tooshort-secret";
    const { issues } = parseServerEnv({ AUTH_SECRET: secret });
    expect(JSON.stringify(issues)).not.toContain(secret);
  });

  it("parses lists, booleans and numbers", () => {
    const { env } = parseServerEnv({
      INTEGRATIONS_DISABLED: " youtube, analytics ,,",
      LOC_ENABLED: "true",
      AI_MONTHLY_BUDGET_USD: "12.5",
    });
    expect(env.INTEGRATIONS_DISABLED).toEqual(["youtube", "analytics"]);
    expect(env.LOC_ENABLED).toBe(true);
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(12.5);
  });

  it("enforces the Wikimedia User-Agent format", () => {
    expect(parseServerEnv({ WIKIMEDIA_USER_AGENT: "curl" }).issues).toHaveLength(1);
    expect(
      parseServerEnv({ WIKIMEDIA_USER_AGENT: "HISTORYVERSE/0.1 (https://example.org/contact)" })
        .issues,
    ).toHaveLength(0);
  });
});
