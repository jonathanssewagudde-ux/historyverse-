import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { cache } from "react";

import { hasPermission, isRole, type Permission, type Role } from "@/lib/auth/roles";
import { getDb } from "@/server/db/client";
import { getAuth, isAuthConfigured } from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  bio: string | null;
  locale: string;
  createdAt: Date;
}

/**
 * The signed-in user, or null. Data Access Layer entry point for authentication:
 *  - validates the session cookie against the database (no trust in client-side state);
 *  - re-reads the role from the users table on every request, so a demotion takes effect
 *    immediately rather than when a cached session expires.
 * Memoised per request with React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isAuthConfigured()) return null;

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      bio: true,
      locale: true,
      createdAt: true,
    },
  });
  if (!user || !isRole(user.role)) return null;
  return { ...user, role: user.role };
});

function signInUrl(next?: string): Route {
  return (next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in") as Route;
}

/** Require a signed-in user; anonymous visitors are sent to sign in and back afterwards. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInUrl(next));
  return user;
}

export type Authorization =
  { allowed: true; user: CurrentUser } | { allowed: false; user: CurrentUser; missing: Permission };

/**
 * Require a signed-in user and report whether they hold `permission`. Pages render an
 * access-denied state when `allowed` is false; server actions and route handlers must refuse.
 */
export async function authorize(permission: Permission, next?: string): Promise<Authorization> {
  const user = await requireUser(next);
  return hasPermission(user.role, permission)
    ? { allowed: true, user }
    : { allowed: false, user, missing: permission };
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** For server actions and route handlers: throws unless the caller holds `permission`. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, permission)) throw new ForbiddenError(permission);
  return user;
}
