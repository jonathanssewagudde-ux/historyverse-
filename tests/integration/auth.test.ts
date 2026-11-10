import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Authentication and authorisation against the real Better Auth API and a real database.
 * `next/headers` is replaced so the session data-access layer can be exercised outside a request.
 */

let requestHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ set: () => {}, get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { getAuth } = await import("@/server/auth/auth");
const { getDb } = await import("@/server/db/client");
const { changeUserRole, RoleChangeError } = await import("@/server/users/roles");
const session = await import("@/server/auth/session");

let db: PrismaClient;
const PASSWORD = "correct horse battery staple";

/** Sign up through the public API and return the user id plus a Cookie header for that session. */
async function signUp(email: string, extra: Record<string, unknown> = {}) {
  const { headers, response } = await getAuth().api.signUpEmail({
    body: { email, password: PASSWORD, name: "Test User", ...extra },
    returnHeaders: true,
  });
  return { id: response.user.id, cookie: cookieHeader(headers) };
}

function cookieHeader(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** React `cache` only memoises inside a render, so each call here re-reads the session. */
async function currentUserFor(cookie: string | null) {
  requestHeaders = new Headers(cookie ? { cookie } : {});
  return session.getCurrentUser();
}

beforeAll(() => {
  db = getDb();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registration", () => {
  it("creates a reader account with a hashed password and an audit entry", async () => {
    const { id } = await signUp("reader@test.invalid");
    const user = await db.user.findUniqueOrThrow({ where: { id }, include: { accounts: true } });
    expect(user.role).toBe("USER");
    expect(user.email).toBe("reader@test.invalid");

    const stored = user.accounts[0]?.password;
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(PASSWORD);

    const audit = await db.auditLog.findFirst({
      where: { action: "user.registered", targetId: id },
    });
    expect(audit?.actorEmail).toBe("reader@test.invalid");
  });

  it("ignores or rejects an attempt to self-assign a role at sign-up", async () => {
    let id: string | undefined;
    try {
      ({ id } = await signUp("escalation@test.invalid", { role: "SUPER_ADMINISTRATOR" }));
    } catch {
      // Rejecting the request outright is also acceptable.
    }
    const user = await db.user.findUnique({ where: { email: "escalation@test.invalid" } });
    if (id) expect(user?.role).toBe("USER");
    else expect(user).toBeNull();
    expect(await db.user.count({ where: { role: "SUPER_ADMINISTRATOR" } })).toBe(0);
  });

  it("rejects short passwords and duplicate emails", async () => {
    await expect(
      getAuth().api.signUpEmail({
        body: { email: "short@test.invalid", password: "short", name: "S" },
      }),
    ).rejects.toThrow();
    expect(await db.user.count({ where: { email: "short@test.invalid" } })).toBe(0);

    await expect(signUp("reader@test.invalid")).rejects.toThrow();
    expect(await db.user.count({ where: { email: "reader@test.invalid" } })).toBe(1);
  });
});

describe("sessions", () => {
  it("rejects a wrong password and accepts the right one", async () => {
    await expect(
      getAuth().api.signInEmail({
        body: { email: "reader@test.invalid", password: "definitely wrong" },
      }),
    ).rejects.toThrow();

    const { headers } = await getAuth().api.signInEmail({
      body: { email: "reader@test.invalid", password: PASSWORD },
      returnHeaders: true,
    });
    const user = await currentUserFor(cookieHeader(headers));
    expect(user).toMatchObject({ email: "reader@test.invalid", role: "USER" });
  });

  it("treats missing and forged cookies as signed out", async () => {
    expect(await currentUserFor(null)).toBeNull();
    expect(await currentUserFor("hv.session_token=forged-value.forged-signature")).toBeNull();
  });

  it("redirects anonymous callers to sign in, preserving the destination", async () => {
    requestHeaders = new Headers();
    await expect(session.requireUser("/admin")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?next=%2Fadmin",
    );
  });

  it("invalidates the session on sign-out", async () => {
    const { cookie } = await signUp("signout@test.invalid");
    expect(await currentUserFor(cookie)).not.toBeNull();
    await getAuth().api.signOut({ headers: new Headers({ cookie }) });
    expect(await currentUserFor(cookie)).toBeNull();
  });

  it("does not let a user change their own role through the profile API", async () => {
    const { id, cookie } = await signUp("selfpromote@test.invalid");
    await getAuth()
      .api.updateUser({
        headers: new Headers({ cookie }),
        body: { name: "Renamed", role: "SUPER_ADMINISTRATOR" } as { name: string },
      })
      .catch(() => {});
    expect((await db.user.findUniqueOrThrow({ where: { id } })).role).toBe("USER");
  });
});

describe("authorisation", () => {
  it("grants and denies permissions by role", async () => {
    const { id, cookie } = await signUp("staff@test.invalid");

    requestHeaders = new Headers({ cookie });
    expect((await session.authorize("studio:access")).allowed).toBe(false);
    await expect(session.assertPermission("studio:access")).rejects.toThrow(session.ForbiddenError);

    await changeUserRole({ kind: "system", label: "test" }, id, "RESEARCHER");
    requestHeaders = new Headers({ cookie });
    expect((await session.authorize("studio:access")).allowed).toBe(true);
    expect((await session.authorize("article:publish")).allowed).toBe(false);
  });

  it("applies a demotion immediately, without waiting for the session to expire", async () => {
    const { id, cookie } = await signUp("demoted@test.invalid");
    await changeUserRole({ kind: "system", label: "test" }, id, "EDITOR");
    expect((await currentUserFor(cookie))?.role).toBe("EDITOR");
    await changeUserRole({ kind: "system", label: "test" }, id, "USER");
    expect((await currentUserFor(cookie))?.role).toBe("USER");
  });
});

describe("role changes", () => {
  it("lets only Super Administrators assign roles, never to themselves", async () => {
    const boss = await signUp("boss@test.invalid");
    const editor = await signUp("editor@test.invalid");
    const target = await signUp("target@test.invalid");
    await changeUserRole({ kind: "system", label: "test" }, boss.id, "SUPER_ADMINISTRATOR");
    await changeUserRole({ kind: "system", label: "test" }, editor.id, "ADMINISTRATOR");

    const asEditor = {
      kind: "user",
      id: editor.id,
      email: "editor@test.invalid",
      role: "ADMINISTRATOR",
    } as const;
    await expect(changeUserRole(asEditor, target.id, "EDITOR")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const asBoss = {
      kind: "user",
      id: boss.id,
      email: "boss@test.invalid",
      role: "SUPER_ADMINISTRATOR",
    } as const;
    await expect(changeUserRole(asBoss, boss.id, "USER")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const result = await changeUserRole(asBoss, target.id, "EDITOR");
    expect(result).toMatchObject({ from: "USER", to: "EDITOR", changed: true });

    const audit = await db.auditLog.findFirst({
      where: { action: "user.role_changed", targetId: target.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toMatchObject({ actorId: boss.id, actorEmail: "boss@test.invalid" });
    expect(audit?.metadata).toMatchObject({ from: "USER", to: "EDITOR" });
  });

  it("never demotes the last Super Administrator", async () => {
    const supers = await db.user.findMany({ where: { role: "SUPER_ADMINISTRATOR" } });
    expect(supers).toHaveLength(1);
    const error = await changeUserRole(
      { kind: "system", label: "test" },
      supers[0]!.id,
      "USER",
    ).catch((e) => e);
    expect(error).toBeInstanceOf(RoleChangeError);
    expect(error.code).toBe("LAST_SUPER_ADMINISTRATOR");
    expect((await db.user.findUniqueOrThrow({ where: { id: supers[0]!.id } })).role).toBe(
      "SUPER_ADMINISTRATOR",
    );
  });

  it("allows demotion once a second Super Administrator exists, and reports unknown users", async () => {
    const second = await signUp("second-boss@test.invalid");
    await changeUserRole({ kind: "system", label: "test" }, second.id, "SUPER_ADMINISTRATOR");
    const first = await db.user.findUniqueOrThrow({ where: { email: "boss@test.invalid" } });
    await expect(
      changeUserRole({ kind: "system", label: "test" }, first.id, "USER"),
    ).resolves.toMatchObject({
      changed: true,
    });
    await expect(
      changeUserRole({ kind: "system", label: "test" }, "no-such-user", "EDITOR"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
