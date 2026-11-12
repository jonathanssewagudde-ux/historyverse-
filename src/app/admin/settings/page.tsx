import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";

export const metadata: Metadata = { title: "Settings and audit log" };

const PAGE = 50;
const when = (d: Date) =>
  `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(d)} UTC`;

export default function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}

async function Settings({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorize("audit:view", "/admin/settings");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action.trim().slice(0, 80) : "";
  const page = Math.max(1, Math.min(200, Number(params.page) || 1));
  const db = getDb();
  const where = action ? { action: { startsWith: action } } : {};
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.auditLog.count({ where }),
  ]);
  const { env } = getServerEnv();
  const settings: [string, string][] = [
    ["Site name", siteConfig.name],
    ["Public URL", siteConfig.url],
    ["Default language", siteConfig.locale],
    ["Environment", env.NODE_ENV],
    ["Log level", env.LOG_LEVEL],
    ["Storage driver", env.STORAGE_DRIVER],
    ["Auth rate limiting", env.AUTH_RATE_LIMIT_ENABLED ? "on" : "off"],
    ["Disabled integrations", env.INTEGRATIONS_DISABLED.join(", ") || "none"],
  ];
  const pageHref = (p: number) =>
    `/admin/settings?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}` as Route;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · settings</p>
        <h1 className="mt-2 text-4xl font-extrabold">Settings and audit log</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Platform settings come from the server environment and are changed by redeploying with new
          values, so they cannot be altered from a browser session. Secrets are never shown.
        </p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {settings.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-muted p-4">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-mono text-sm break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="audit-title" className="rounded-3xl border bg-card p-6">
        <h2 id="audit-title" className="text-2xl font-bold">
          Audit log
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Append-only: entries cannot be edited or deleted, even by administrators. {total} entries
          {action && ` starting with “${action}”`}.
        </p>
        <form
          role="search"
          aria-label="Filter the audit log"
          className="mt-4 flex max-w-xl items-end gap-2"
        >
          <div className="flex-1 space-y-1.5">
            <label htmlFor="audit-action" className="text-sm font-medium">
              Action (prefix, e.g. article. or user.role_changed)
            </label>
            <Input id="audit-action" name="action" defaultValue={action} className="font-mono" />
          </div>
          <Button type="submit" variant="lime">
            Filter
          </Button>
        </form>
        <div
          role="region"
          aria-label="Audit entries"
          tabIndex={0}
          className="mt-4 overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="font-mono text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-4 font-normal">
                  when
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  action
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  who
                </th>
                <th scope="col" className="py-2 font-normal">
                  target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {when(e.createdAt)}
                  </td>
                  <td className="py-2 pr-4 font-mono">{e.action}</td>
                  <td className="py-2 pr-4">
                    {e.actorEmail ?? e.actorId ?? "system"}
                    {e.actorRole && (
                      <span className="text-muted-foreground"> · {e.actorRole.toLowerCase()}</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-xs">
                    {e.targetType ? `${e.targetType}:${e.targetId}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav aria-label="Audit log pages" className="mt-4 flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>Newer</Link>
            </Button>
          )}
          {page * PAGE < total && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>Older</Link>
            </Button>
          )}
        </nav>
      </section>
    </div>
  );
}
