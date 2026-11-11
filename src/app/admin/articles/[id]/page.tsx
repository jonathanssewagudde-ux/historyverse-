import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { PublishControls } from "@/components/admin/publish-controls";
import { ArticlePage } from "@/components/content/article-page";
import { hasPermission } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { buildArticleView } from "@/server/content/article-view";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Article preview" };

export default function ArticlePreviewPage({ params }: PageProps<"/admin/articles/[id]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("article:draft", `/admin/articles/${id}`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;

  const article = await buildArticleView(getDb(), { id }, { publicOnly: false });
  if (!article) notFound();
  const published = article.status === "PUBLISHED" || article.status === "UPDATED";
  const withheld = [article.hero, ...article.gallery]
    .filter((m) => m?.blocker && m.blocker !== "awaiting approval at publication")
    .map((m) => ({ title: m!.title, reason: m!.blocker! }));

  return (
    <div className="space-y-6">
      {hasPermission(auth.user.role, "article:publish") ? (
        <div className="mx-auto max-w-6xl">
          <PublishControls
            articleId={article.id}
            published={published}
            path={article.path}
            withheld={withheld}
          />
        </div>
      ) : (
        <p className="mx-auto max-w-6xl rounded-2xl border p-4 text-sm text-muted-foreground">
          Only editors can approve articles for publication.
        </p>
      )}
      <div className="overflow-hidden rounded-3xl border bg-background">
        <ArticlePage article={article} preview />
      </div>
    </div>
  );
}
