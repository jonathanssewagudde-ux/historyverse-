import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { ArticleEditor } from "@/components/admin/article-editor";
import { authorize } from "@/server/auth/session";
import { loadEditorOptions } from "@/server/content/editor-options";
import { exportArticle } from "@/server/content/export-article";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Edit article" };

export default function EditArticlePage({
  params,
  searchParams,
}: PageProps<"/admin/articles/[id]/edit">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <EditArticle params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const auth = await authorize("article:draft", `/admin/articles/${id}/edit`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const article = await db.article.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, version: true, deletedAt: true },
  });
  if (!article || article.deletedAt) notFound();

  const header = (
    <header className="rounded-3xl border bg-card p-6 sm:p-8">
      <p className="font-mono text-xs text-muted-foreground">
        ai studio · articles · edit · v{article.version}
      </p>
      <h1 className="mt-2 text-4xl font-extrabold">{article.title}</h1>
    </header>
  );

  if (article.status !== "DRAFT") {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        {header}
        <p className="rounded-3xl border p-6">
          This article is {article.status.toLowerCase().replace(/_/g, " ")}, so it cannot be edited.
          An editor can request changes (or unpublish it) to return it to draft.{" "}
          <Link
            href={`/admin/articles/${id}` as Route}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Back to the article
          </Link>
        </p>
      </div>
    );
  }

  const [draft, options] = await Promise.all([exportArticle(db, id), loadEditorOptions(db)]);
  if (!draft) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {header}
      <ArticleEditor
        articleId={id}
        initial={draft}
        options={options}
        notice={query.created ? `Draft created as version ${article.version}.` : undefined}
      />
    </div>
  );
}
