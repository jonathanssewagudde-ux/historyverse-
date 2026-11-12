import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { NewDocumentaryForm } from "@/components/admin/documentary-forms";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listDocumentaries } from "@/server/documentary/view";

export const metadata: Metadata = { title: "Documentary Script Studio" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
const minutes = (s: number) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;

export default function ScriptsPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Scripts />
    </Suspense>
  );
}

async function Scripts() {
  const auth = await authorize("documentary:edit", "/admin/scripts");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const [docs, articles] = await Promise.all([
    listDocumentaries(db),
    db.article.findMany({
      where: { deletedAt: null, sections: { some: {} } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, status: true },
      take: 200,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · scripts</p>
        <h1 className="mt-2 text-4xl font-extrabold">Documentary Script Studio</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          A script is built from an article&apos;s reviewed text, in documentary order: hook,
          background, origins, key developments, important figures, turning points, consequences,
          significance and conclusion. Every scene keeps the citations of the text it narrates.
          Nothing is invented; a part of the structure with no material is left out. An editor
          approves the script once the article is published.
        </p>
        <div className="mt-6">
          <NewDocumentaryForm articles={articles} />
        </div>
      </section>
      <section aria-labelledby="docs-title" className="rounded-3xl border bg-card p-6">
        <h2 id="docs-title" className="text-2xl font-bold">
          Documentaries
        </h2>
        {docs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No documentaries yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/admin/documentaries/${d.id}` as Route}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {d.title}
                  </Link>
                  {d.script && (
                    <p className="text-sm text-muted-foreground">
                      script v{d.script.version} · {d.script.scenes} scenes ·{" "}
                      {minutes(d.script.seconds)} · narrated {d.script.narrated}/{d.script.scenes}
                    </p>
                  )}
                </div>
                <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                  {d.script ? label(d.script.status) : "no script"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
