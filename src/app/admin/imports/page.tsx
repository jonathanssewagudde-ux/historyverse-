import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { authorize } from "@/server/auth/session";
import { getImportedData } from "@/server/admin/imports";

export const metadata: Metadata = { title: "Data imports" };

export default function ImportsPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Imports />
    </Suspense>
  );
}

const kindLabel = (kind: string) => kind.replace(/_/g, " ").toLowerCase();
const when = (date: Date | null) =>
  date
    ? `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`
    : "—";

async function Imports() {
  const auth = await authorize("entity:edit", "/admin/imports");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const { entities, runs, totals } = await getImportedData();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · data imports</p>
        <h1 className="mt-2 text-4xl font-extrabold">Imported data</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Records imported from Wikidata and Wikimedia Commons. Everything here is an{" "}
          <strong className="text-foreground">unreviewed draft</strong>: imported statements are
          leads with a source attached, not verified facts, and nothing is public until an editor
          reviews it.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Entities", totals.entities],
            ["Imported claims", totals.claims],
            ["Verified claims", totals.verified],
            ["Media records", totals.media],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse rounded-2xl bg-muted p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-display text-4xl font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="entities-title" className="rounded-3xl border bg-card p-6">
        <h2 id="entities-title" className="text-2xl font-bold">
          Entities
        </h2>
        {entities.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing has been imported yet. Run{" "}
            <code className="font-mono">pnpm ingest:wikidata</code> to import a dataset.
          </p>
        ) : (
          <div
            role="region"
            aria-label="Imported entities table"
            tabIndex={0}
            className="mt-4 overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="font-mono text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    name
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    kind
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    dates (as imported)
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    claims
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    status
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entities.map((e) => (
                  <tr key={e.id}>
                    <th scope="row" className="py-2.5 pr-4 align-top font-medium">
                      {e.name}
                      {e.summary && (
                        <span className="block max-w-xs text-xs font-normal text-muted-foreground">
                          {e.summary}
                        </span>
                      )}
                    </th>
                    <td className="py-2.5 pr-4 align-top text-muted-foreground">
                      {kindLabel(e.kind)}
                    </td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap">{e.dates ?? "—"}</td>
                    <td className="py-2.5 pr-4 align-top whitespace-nowrap">
                      {e.claims}
                      <span className="text-muted-foreground">
                        {" "}
                        · {e.unverifiedClaims} unverified
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <span className="rounded-full border border-dashed px-2 py-0.5 font-mono text-xs">
                        {kindLabel(e.status)}
                      </span>
                    </td>
                    <td className="py-2.5 align-top">
                      <a
                        href={`https://www.wikidata.org/wiki/${e.wikidataId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary underline-offset-4 hover:underline"
                      >
                        {e.wikidataId}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="runs-title" className="rounded-3xl border bg-card p-6">
        <h2 id="runs-title" className="text-2xl font-bold">
          Import runs
        </h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No import has run yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  <span className="mr-2 rounded-full border px-2 py-0.5 font-mono text-xs">
                    {run.status.toLowerCase()}
                  </span>
                  {run.created} created · {run.updated} updated · {run.failed} failed ·{" "}
                  {run.warnings} warnings
                  {run.error && <span className="block text-xs text-destructive">{run.error}</span>}
                </span>
                <span className="text-muted-foreground">
                  {when(run.finishedAt ?? run.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
