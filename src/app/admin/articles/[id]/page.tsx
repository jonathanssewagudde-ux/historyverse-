import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { PublishControls, type WorkflowStatus } from "@/components/admin/publish-controls";
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
  const withheld = [article.hero, ...article.gallery]
    .filter((m) => m?.blocker && m.blocker !== "awaiting approval at publication")
    .map((m) => ({ title: m!.title, reason: m!.blocker! }));
  const uncited = article.sections.flatMap((s, i) =>
    s.kind !== "FURTHER_READING" && Object.keys(s.refs).length === 0
      ? [s.heading ?? (s.kind === "INTRODUCTION" ? "Introduction" : `section ${i + 1}`)]
      : [],
  );
  // The latest decision, shown only when it explains the current state: why a draft was sent
  // back, or what the research reviewer noted before editorial approval.
  const latest = await getDb().editorialReview.findFirst({
    where: { articleId: id, decision: { in: ["CHANGES_REQUESTED", "APPROVED"] } },
    orderBy: { decidedAt: "desc" },
    include: { reviewer: { select: { name: true } } },
  });
  const review =
    latest?.notes &&
    ((article.status === "DRAFT" && latest.decision === "CHANGES_REQUESTED") ||
      (article.status === "EDITORIAL_APPROVAL" && latest.stage === "RESEARCH_REVIEW"))
      ? latest
      : null;
  const role = auth.user.role;

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-6xl">
        <PublishControls
          articleId={article.id}
          status={article.status as WorkflowStatus}
          path={article.path}
          withheld={withheld}
          uncited={uncited}
          can={{
            edit: hasPermission(role, "article:draft"),
            submit: hasPermission(role, "review:request"),
            review: hasPermission(role, "article:review"),
            publish: hasPermission(role, "article:publish"),
          }}
          lastNote={
            review?.notes
              ? {
                  decision:
                    review.decision === "CHANGES_REQUESTED" ? "Changes requested" : "Approved",
                  note: review.notes,
                  by: review.reviewer?.name ?? "an editor",
                }
              : null
          }
        />
      </div>
      <div className="overflow-hidden rounded-3xl border bg-background">
        <ArticlePage article={article} preview />
      </div>
    </div>
  );
}
