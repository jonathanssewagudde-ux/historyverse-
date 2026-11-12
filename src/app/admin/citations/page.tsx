import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { SourceForm } from "@/components/admin/source-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSources } from "@/server/admin/sources";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "References" };

export default function ReferencesPage({ searchParams }: PageProps<"/admin/citations">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <References searchParams={searchParams} />
    </Suspense>
  );
}

async function References({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorize("source:manage", "/admin/citations");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const sources = await listSources(getDb(), query);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · references</p>
        <h1 className="mt-2 text-4xl font-extrabold">References</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every source cited by an article or a claim. Correcting a source here corrects every
          reference to it, including on published pages. Sources are added by citing them in an
          article or by importing records.
        </p>
        <form
          role="search"
          aria-label="Search references"
          className="mt-6 flex max-w-xl items-end gap-2"
        >
          <div className="flex-1 space-y-1.5">
            <label htmlFor="source-q" className="text-sm font-medium">
              Search by title, author, publisher or URL
            </label>
            <Input id="source-q" name="q" type="search" defaultValue={query} />
          </div>
          <Button type="submit" variant="lime">
            Search
          </Button>
        </form>
      </section>

      <section aria-labelledby="sources-count" className="space-y-3">
        <h2 id="sources-count" className="px-1 text-xl font-bold">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
          {query && ` matching “${query}”`}
        </h2>
        {sources.map((s) => (
          <details key={s.id} className="rounded-3xl border bg-card p-5">
            <summary className="cursor-pointer">
              <span className="font-semibold">{s.title}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {s.type.toLowerCase().replace(/_/g, " ")} · cited {s.citations}×
                {s.claims > 0 && ` · supports ${s.claims} claim(s)`}
              </span>
            </summary>
            {s.articles.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {s.articles.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/articles/${a.id}` as Route}
                      className="rounded-full border px-3 py-1 underline-offset-4 hover:underline"
                    >
                      {a.title} · {a.status.toLowerCase().replace(/_/g, " ")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <SourceForm source={s} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
