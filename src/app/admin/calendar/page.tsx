import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { CalendarButton, ScheduleForm } from "@/components/admin/calendar-forms";
import { authorize } from "@/server/auth/session";
import { listSchedules } from "@/server/content/schedule";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";

export const metadata: Metadata = { title: "Publishing calendar" };

const utc = (iso: string) =>
  `${new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`;

export default function CalendarPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Calendar />
    </Suspense>
  );
}

async function Calendar() {
  const auth = await authorize("article:publish", "/admin/calendar");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const { upcoming, recent, ready } = await listSchedules(getDb());
  const cronConfigured = Boolean(getServerEnv().env.CRON_SECRET);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · calendar</p>
        <h1 className="mt-2 text-4xl font-extrabold">Publishing calendar</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Schedule an approved article for a later time. At that time it is published with every
          check of publishing by hand, as you. If changes are requested in the meantime, the
          schedule is cancelled.
        </p>
        <p className="mt-3 text-sm">
          {cronConfigured
            ? "Automatic publishing is configured: a scheduler calls the publish endpoint."
            : "Automatic publishing is not configured (CRON_SECRET is not set). Due articles are published when an editor runs them below."}
        </p>
        <div className="mt-6 rounded-2xl border p-4">
          <h2 className="mb-3 font-semibold">Schedule an article</h2>
          <ScheduleForm articles={ready} />
        </div>
      </section>

      <section aria-labelledby="upcoming-title" className="rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="upcoming-title" className="text-2xl font-bold">
            Upcoming
          </h2>
          <CalendarButton intent="run">Publish due articles now</CalendarButton>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing is scheduled.</p>
        ) : (
          <ol className="mt-4 divide-y">
            {upcoming.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-mono text-sm text-primary">
                    {utc(s.when)}
                    {s.overdue && <span className="ml-2 text-destructive">due</span>}
                  </p>
                  <Link
                    href={`/admin/articles/${s.article.id}` as Route}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {s.article.title}
                  </Link>
                  {s.approvedBy && (
                    <p className="text-xs text-muted-foreground">approved by {s.approvedBy}</p>
                  )}
                </div>
                <CalendarButton intent="cancel" scheduleId={s.id}>
                  Cancel
                </CalendarButton>
              </li>
            ))}
          </ol>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="rounded-3xl border bg-card p-6">
          <h2 id="recent-title" className="text-2xl font-bold">
            Recent
          </h2>
          <ul className="mt-4 divide-y text-sm">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{s.article.title}</span>
                <span className="text-muted-foreground">
                  {s.status.toLowerCase()} · {utc(s.when)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
