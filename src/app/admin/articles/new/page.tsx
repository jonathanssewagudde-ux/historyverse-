import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { ArticleEditor } from "@/components/admin/article-editor";
import { authorize } from "@/server/auth/session";
import type { ArticleDraft } from "@/server/content/article-file";
import { loadEditorOptions } from "@/server/content/editor-options";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "New article" };

const blank: ArticleDraft = {
  slug: "",
  title: "",
  template: "GENERAL",
  primaryEntity: {},
  authoring: "human",
  sources: [],
  sections: [{ kind: "INTRODUCTION", body: "" }],
  keyDates: [],
  entities: [],
  media: [],
} as unknown as ArticleDraft;

export default function NewArticlePage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <NewArticle />
    </Suspense>
  );
}

async function NewArticle() {
  const auth = await authorize("article:draft", "/admin/articles/new");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const options = await loadEditorOptions(getDb());
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · articles · new</p>
        <h1 className="mt-2 text-4xl font-extrabold">New article</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Drafts can be saved unfinished. To be published, every section must cite a source and the
          article must pass research review and editorial approval.
        </p>
      </header>
      <ArticleEditor articleId={null} initial={blank} options={options} />
    </div>
  );
}
