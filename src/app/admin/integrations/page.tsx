import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { IntegrationTest } from "@/components/admin/integration-test";
import { authorize } from "@/server/auth/session";
import { TESTABLE_INTEGRATIONS } from "@/server/integrations/connection-tests";
import { getIntegrationStates } from "@/server/integrations/status";

export const metadata: Metadata = { title: "Integrations" };

const statusLabel: Record<string, string> = {
  not_configured: "Not configured",
  configured: "Configured",
  disabled: "Disabled",
};
const classLabel: Record<string, string> = {
  "mandatory-platform": "Mandatory · platform",
  "mandatory-external": "Mandatory · external",
  optional: "Optional",
};

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Integrations />
    </Suspense>
  );
}

async function Integrations() {
  const auth = await authorize("integration:view", "/admin/integrations");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const states = getIntegrationStates();
  const groups = ["mandatory-platform", "mandatory-external", "optional"] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · integrations</p>
        <h1 className="mt-2 text-4xl font-extrabold">Integrations</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          &quot;Configured&quot; means the settings are present; only a live test can show
          &quot;Connected&quot;. Tests are free, read-only requests. Credentials are set in the
          server environment and are never shown here. Billable services are never called without an
          approved budget.
        </p>
      </section>
      {groups.map((group) => (
        <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
          <h2 id={`group-${group}`} className="px-1 text-xl font-bold">
            {classLabel[group]}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {states
              .filter((s) => s.classification === group)
              .map((s) => (
                <li key={s.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-lg font-bold">{s.name}</h3>
                    <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </div>
                  <p className="text-sm">{s.purpose}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.implemented
                      ? "Adapter built"
                      : `Adapter arrives in Milestone ${s.milestone}`}
                    {s.billable && " · can incur charges"}
                  </p>
                  {s.missingEnv.length > 0 && (
                    <p className="font-mono text-xs text-muted-foreground">
                      Missing: {s.missingEnv.join(", ")}
                    </p>
                  )}
                  {s.errors.length > 0 && (
                    <ul className="text-xs text-destructive">
                      {s.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs">
                    <span className="font-semibold">Without it:</span> {s.fallback}
                  </p>
                  {TESTABLE_INTEGRATIONS.includes(s.id) && s.status === "configured" && (
                    <IntegrationTest id={s.id} name={s.name} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
