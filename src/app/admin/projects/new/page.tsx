import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { NewProjectForm } from "@/components/admin/project-forms";
import { hasPermission } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { getModelStatus, getQueueStatus } from "@/server/research/project-view";

export const metadata: Metadata = { title: "Generate History Project" };

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <NewProject />
    </Suspense>
  );
}

async function NewProject() {
  const auth = await authorize("project:create", "/admin/projects/new");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const [queue, model] = [await getQueueStatus(), getModelStatus()];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · projects · new</p>
        <h1 className="mt-2 text-4xl font-extrabold">Generate History Project</h1>
        <p className="mt-2 text-muted-foreground">
          Step 1 is research from free sources (Wikidata, Wikipedia, library catalogues). Nothing is
          written or published automatically: you review the sources, then decide whether to ask for
          an AI-assisted draft, which an editor must review before publication.
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          <li>
            Job queue:{" "}
            {!queue.configured
              ? "not configured (REDIS_URL). Projects can be created; research waits for a queue."
              : queue.workers === null
                ? "configured, but Redis could not be reached."
                : queue.workers === 0
                  ? "configured, but no worker is running. Start one with pnpm worker."
                  : `ready (${queue.workers} worker${queue.workers === 1 ? "" : "s"}).`}
          </li>
          <li>
            Language model for drafts:{" "}
            {model.ok ? `${model.id} (${model.priceBasis})` : `not available: ${model.reason}`}
          </li>
        </ul>
      </section>
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <NewProjectForm canBudget={hasPermission(auth.user.role, "spend:approve")} />
      </section>
    </div>
  );
}
