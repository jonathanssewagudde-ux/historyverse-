import type { Metadata, Route } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { Button } from "@/components/ui/button";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Articles" };

export default function ArticlesPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Articles />
    </Suspense>
  );
}

async function Articles() {
  const auth = await authorize("article:draft", "/admin/articles");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const articles = await getDb().article.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      version: true,
      containsUnreviewedAi: true,
      updatedAt: true,
      _count: { select: { citations: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · articles</p>
        <h1 className="mt-2 text-4xl font-extrabold">Articles</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Write drafts here or load them from reviewable data files with{" "}
          <code className="font-mono">pnpm article:load</code>. Each article goes through research
          review and editorial approval before an editor publishes it.
        </p>
        <Button asChild variant="lime" className="mt-4">
          <Link href={"/admin/articles/new" as Route}>
            <Plus aria-hidden /> New article
          </Link>
        </Button>
      </section>
      <section aria-label="All articles" className="rounded-3xl border bg-card p-6">
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No articles yet.</p>
        ) : (
          <ul className="divide-y">
            {articles.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/admin/articles/${a.id}` as Route}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {a.title}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">
                    /{a.slug} · v{a.version} · {a._count.citations} citations
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.status === "DRAFT" && (
                    <Link
                      href={`/admin/articles/${a.id}/edit` as Route}
                      className="text-sm font-semibold underline-offset-4 hover:underline"
                      aria-label={`Edit ${a.title}`}
                    >
                      edit
                    </Link>
                  )}
                  {a.containsUnreviewedAi && (
                    <span className="rounded-full border border-dashed border-primary px-2 py-0.5 font-mono text-xs text-primary">
                      unreviewed AI draft
                    </span>
                  )}
                  <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                    {a.status.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
