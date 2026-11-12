import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { CorrectionResolve } from "@/components/admin/correction-resolve";
import { getReviewQueue } from "@/server/admin/reviews";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Editorial reviews" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

export default function ReviewsPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Reviews />
    </Suspense>
  );
}

async function Reviews() {
  const auth = await authorize("article:review", "/admin/reviews");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const queue = await getReviewQueue(getDb());

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · reviews</p>
        <h1 className="mt-2 text-4xl font-extrabold">Editorial reviews</h1>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Articles waiting", queue.reviews.length, null],
              ["Reader reports", queue.corrections.length, null],
              ["Images to review", queue.pendingMedia, "/admin/media?review=PENDING"],
              ["Claims to verify", queue.unverifiedClaims, "/admin/kingdoms"],
            ] as const
          ).map(([text, n, href]) => (
            <div key={text} className="flex flex-col-reverse rounded-2xl bg-muted p-4">
              <dt className="text-sm text-muted-foreground">
                {href ? (
                  <Link href={href as Route} className="underline-offset-4 hover:underline">
                    {text}
                  </Link>
                ) : (
                  text
                )}
              </dt>
              <dd className="font-display text-4xl font-extrabold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="article-reviews" className="rounded-3xl border bg-card p-6">
        <h2 id="article-reviews" className="text-2xl font-bold">
          Articles
        </h2>
        {queue.reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No article is waiting for review.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {queue.reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/admin/articles/${r.article.id}` as Route}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {r.article.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {label(r.stage)} · since {day(r.createdAt)}
                    {r.requestedBy && ` · submitted by ${r.requestedBy}`}
                  </p>
                  {r.notes && <p className="mt-1 text-sm">“{r.notes}”</p>}
                </div>
                {r.article.containsUnreviewedAi && (
                  <span className="rounded-full border border-dashed border-primary px-2 py-0.5 font-mono text-xs text-primary">
                    unreviewed AI draft
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reader-reports" className="rounded-3xl border bg-card p-6">
        <h2 id="reader-reports" className="text-2xl font-bold">
          Reader reports
        </h2>
        {queue.corrections.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No open reports.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {queue.corrections.map((c) => (
              <li key={c.id} className="grid gap-4 py-4 md:grid-cols-[1fr_20rem]">
                <div>
                  <Link
                    href={`/admin/articles/${c.article.id}` as Route}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {c.article.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    from {c.reporter} · {day(c.createdAt)}
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-line">{c.message}</p>
                  {c.evidenceUrl && (
                    <a
                      href={c.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-1 inline-block text-sm break-all text-primary underline-offset-4 hover:underline"
                    >
                      {c.evidenceUrl}
                    </a>
                  )}
                </div>
                <CorrectionResolve correctionId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
