import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { JobStatus } from "@/components/admin/job-status";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listProjects } from "@/server/research/project-view";

export const metadata: Metadata = { title: "Historical research" };

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

export default function ResearchPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Research />
    </Suspense>
  );
}

async function Research() {
  const auth = await authorize("research:run", "/admin/research");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const projects = await listProjects(getDb());

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · research</p>
        <h1 className="mt-2 text-4xl font-extrabold">Historical research</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Each project gathers sources from free archives and catalogues, reports what they say
          (including where they disagree), and waits for a person to review the source set before
          any draft is written.
        </p>
        {hasPermission(auth.user.role, "project:create") && (
          <Button asChild variant="lime" className="mt-4">
            <Link href={"/admin/projects/new" as Route}>Generate History Project</Link>
          </Button>
        )}
      </section>
      <section aria-labelledby="projects-title" className="rounded-3xl border bg-card p-6">
        <h2 id="projects-title" className="text-2xl font-bold">
          Projects
        </h2>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/admin/projects/${p.id}` as Route}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {p.topic}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {day(p.createdAt)} · {p.createdBy} · {p.sources} sources
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">research</span>
                  <JobStatus status={p.research} />
                  <span className="text-muted-foreground">draft</span>
                  <JobStatus status={p.draft} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
