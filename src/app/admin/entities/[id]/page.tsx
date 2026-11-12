import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { ClaimDecision, SummaryForm } from "@/components/admin/entity-forms";
import { hasPermission } from "@/lib/auth/roles";
import { getEntityDetail } from "@/server/admin/entities";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Entity" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
const verificationStyle: Record<string, string> = {
  VERIFIED: "border-lime bg-lime text-lime-foreground",
  REJECTED: "border-destructive text-destructive line-through",
  UNVERIFIED: "border-dashed",
};

export default function EntityPage({ params }: PageProps<"/admin/entities/[id]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Entity params={params} />
    </Suspense>
  );
}

async function Entity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("entity:edit", `/admin/entities/${id}`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const entity = await getEntityDetail(getDb(), id);
  if (!entity) notFound();
  const canVerify = hasPermission(auth.user.role, "claim:verify");
  const counts = {
    verified: entity.claims.filter((c) => c.verification === "VERIFIED").length,
    unverified: entity.claims.filter((c) => c.verification === "UNVERIFIED").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">
          ai studio · entity · {label(entity.kind)}
        </p>
        <h1 className="mt-2 text-4xl font-extrabold">{entity.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {entity.dates ?? "No dates recorded"}
          {entity.wikidataId && (
            <>
              {" · "}
              <a
                href={`https://www.wikidata.org/wiki/${entity.wikidataId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-primary underline underline-offset-4"
              >
                {entity.wikidataId}
              </a>
            </>
          )}
        </p>
        {entity.aliases.length > 0 && (
          <p className="mt-2 text-sm">Also known as: {entity.aliases.join(", ")}</p>
        )}
        {entity.articles.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {entity.articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/articles/${a.id}` as Route}
                  className="rounded-full border px-3 py-1 underline-offset-4 hover:underline"
                >
                  {a.title} · {label(a.status)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6">
          <SummaryForm entityId={entity.id} summary={entity.summary} />
        </div>
      </section>

      <section aria-labelledby="claims-title" className="rounded-3xl border bg-card p-6">
        <h2 id="claims-title" className="text-2xl font-bold">
          Claims
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {entity.claims.length} claims · {counts.verified} verified · {counts.unverified} to check.
          Verify a claim only after checking it against its source.
        </p>
        {entity.claims.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No claims recorded.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {entity.claims.map((c) => (
              <li key={c.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-2xl font-medium">
                    {c.statement}
                    {c.date && <span className="text-muted-foreground"> · {c.date}</span>}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-xs ${verificationStyle[c.verification] ?? ""}`}
                  >
                    {label(c.verification)}
                    {c.verifiedBy && ` by ${c.verifiedBy}`}
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {label(c.origin)} · {label(c.type)} · {label(c.certainty)}
                </p>
                {c.sources.length === 0 ? (
                  <p className="text-sm text-destructive">No source cited.</p>
                ) : (
                  <ul className="text-sm">
                    {c.sources.map((s, i) => (
                      <li key={i}>
                        Source:{" "}
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-4"
                          >
                            {s.title}
                          </a>
                        ) : (
                          s.title
                        )}
                        {s.locator && <span className="text-muted-foreground"> ({s.locator})</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <ClaimDecision claimId={c.id} verification={c.verification} canVerify={canVerify} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
