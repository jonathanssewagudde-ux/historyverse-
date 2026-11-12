import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { RoleForm } from "@/components/admin/role-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAssignRole, roleLabels, type Role } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorize("user:view", "/admin/users");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const db = getDb();
  const [users, counts] = await Promise.all([
    db.user.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      take: 200,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.user.groupBy({ by: ["role"], _count: true }),
  ]);
  const me = auth.user;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · users</p>
        <h1 className="mt-2 text-4xl font-extrabold">Users and roles</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Only Super Administrators assign roles. Nobody can change their own role, and the last
          Super Administrator cannot be demoted. Every change is recorded in the audit log.
        </p>
        <dl className="mt-6 flex flex-wrap gap-3">
          {counts.map((c) => (
            <div key={c.role} className="rounded-2xl bg-muted px-4 py-2">
              <dt className="text-xs text-muted-foreground">{roleLabels[c.role as Role]}</dt>
              <dd className="font-display text-2xl font-extrabold tabular-nums">{c._count}</dd>
            </div>
          ))}
        </dl>
        <form
          role="search"
          aria-label="Search users"
          className="mt-6 flex max-w-xl items-end gap-2"
        >
          <div className="flex-1 space-y-1.5">
            <label htmlFor="user-q" className="text-sm font-medium">
              Search by name or email
            </label>
            <Input id="user-q" name="q" type="search" defaultValue={query} />
          </div>
          <Button type="submit" variant="lime">
            Search
          </Button>
        </form>
      </section>
      <section aria-label="Users" className="rounded-3xl border bg-card p-6">
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">
                  {u.name}
                  {u.id === me.id && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
              {canAssignRole(me, u, u.role as Role) ? (
                <RoleForm userId={u.id} name={u.name} role={u.role as Role} />
              ) : (
                <span className="rounded-full border px-3 py-1 font-mono text-xs">
                  {roleLabels[u.role as Role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
