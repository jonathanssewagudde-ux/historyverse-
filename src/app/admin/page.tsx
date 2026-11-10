import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { milestones } from "@/config/milestones";
import { hasPermission, roleLabels } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { getStudioOverview } from "@/server/admin/overview";
import { authorize } from "@/server/auth/session";
import { getIntegrationStates } from "@/server/integrations/status";
import type { IntegrationState } from "@/server/integrations/types";

export default function StudioOverviewPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <StudioOverview />
    </Suspense>
  );
}

async function StudioOverview() {
  const auth = await authorize("studio:access", "/admin");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;

  const { user } = auth;
  const canSeeAudit = hasPermission(user.role, "audit:view");
  const canSeeIntegrations = hasPermission(user.role, "integration:view");
  const overview = await getStudioOverview({ includeAudit: canSeeAudit });
  const done = milestones.filter((m) => m.status === "complete").length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-primary to-pink p-6 text-[oklch(0.99_0_0)] sm:p-8">
        <p className="font-mono text-xs">ai studio · overview</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">Hey, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-xl">
          You&apos;re signed in as <strong>{roleLabels[user.role]}</strong>. The Studio modules
          arrive milestone by milestone; {done} of {milestones.length} milestones are complete.
        </p>
      </section>

      <section aria-labelledby="db-title" className="rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="db-title" className="text-2xl font-bold">
            Database
          </h2>
          <DatabaseBadge health={overview.database} />
        </div>
        {overview.counts.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {overview.counts.map((c) => (
              <div key={c.label} className="flex flex-col-reverse rounded-2xl bg-muted p-4">
                <dt className="text-sm text-muted-foreground">{c.label}</dt>
                <dd className="font-display text-4xl font-extrabold tabular-nums">{c.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {canSeeIntegrations && <Integrations states={getIntegrationStates()} />}

      {canSeeAudit && (
        <section aria-labelledby="audit-title" className="rounded-3xl border bg-card p-6">
          <h2 id="audit-title" className="text-2xl font-bold">
            Recent activity
          </h2>
          {overview.recentAudit.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="mt-4 divide-y">
              {overview.recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="font-mono">{entry.action}</span>
                  <span className="text-muted-foreground">
                    {entry.actorEmail ?? "system"} ·{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }).format(entry.createdAt)}{" "}
                    UTC
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function DatabaseBadge({
  health,
}: {
  health: Awaited<ReturnType<typeof getStudioOverview>>["database"];
}) {
  if (health.status === "up") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-sm font-semibold text-lime-foreground">
        <CircleCheck className="size-4" aria-hidden /> Connected · {health.latencyMs} ms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-sm font-semibold text-destructive">
      <CircleAlert className="size-4" aria-hidden />
      {health.status === "not_configured" ? "Not configured" : `Unreachable (${health.error})`}
    </span>
  );
}

const statusLabel: Record<IntegrationState["status"], string> = {
  not_configured: "Not configured",
  configured: "Configured",
  connected: "Connected",
  connection_failed: "Connection failed",
  disabled: "Disabled",
};

function Integrations({ states }: { states: IntegrationState[] }) {
  return (
    <section aria-labelledby="integrations-title" className="rounded-3xl border bg-card p-6">
      <h2 id="integrations-title" className="text-2xl font-bold">
        Integrations
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Status comes from configuration only. &quot;Connected&quot; will appear once live connection
        tests ship with the full Integrations page (Milestone 7).
      </p>
      <div
        role="region"
        aria-label="Integrations table"
        tabIndex={0}
        className="mt-4 overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="font-mono text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-4 font-normal">
                integration
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                type
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                status
              </th>
              <th scope="col" className="py-2 font-normal">
                built
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {states.map((s) => (
              <tr key={s.id}>
                <th scope="row" className="py-2.5 pr-4 font-medium">
                  {s.name}
                </th>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {s.classification === "optional" ? "Optional" : "Mandatory"}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      s.status === "configured" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.status === "configured" ? (
                      <CircleCheck className="size-4 text-primary" aria-hidden />
                    ) : (
                      <CircleDashed className="size-4" aria-hidden />
                    )}
                    {statusLabel[s.status]}
                  </span>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {s.implemented ? "Yes" : `Milestone ${s.milestone}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
