import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { MediaCard, UploadForm } from "@/components/admin/media-forms";
import { hasPermission } from "@/lib/auth/roles";
import { listMedia } from "@/server/admin/media";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Media library" };

export default function MediaLibraryPage({ searchParams }: PageProps<"/admin/media">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Library searchParams={searchParams} />
    </Suspense>
  );
}

const REVIEW_FILTERS = [
  ["", "All"],
  ["PENDING", "Pending"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
] as const;

async function Library({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await authorize("media:upload", "/admin/media");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const params = await searchParams;
  const review = typeof params.review === "string" ? params.review : "";
  const { assets, licenses } = await listMedia(getDb(), { review });
  const canApprove = hasPermission(auth.user.role, "media:approve");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · media</p>
        <h1 className="mt-2 text-4xl font-extrabold">Historical media library</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every image says what it is (photograph, artwork, map…) and carries its licence and
          attribution. Readers see an image only when it is classified, publishable under its
          licence, stored, described with alt text and approved by an editor.
        </p>
        <details className="mt-6 rounded-2xl border p-4">
          <summary className="cursor-pointer font-semibold">Upload an image</summary>
          <div className="mt-4">
            <UploadForm licenses={licenses} />
          </div>
        </details>
      </section>

      <nav aria-label="Filter by review status" className="flex flex-wrap gap-2">
        {REVIEW_FILTERS.map(([value, text]) => (
          <Link
            key={value}
            href={(value ? `/admin/media?review=${value}` : "/admin/media") as Route}
            aria-current={review === value ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              review === value && "bg-primary text-primary-foreground",
            )}
          >
            {text}
          </Link>
        ))}
      </nav>

      <section aria-label="Media" className="space-y-3">
        {assets.length === 0 ? (
          <p className="rounded-3xl border p-6 text-sm text-muted-foreground">No media here.</p>
        ) : (
          assets.map((a) => (
            <MediaCard key={a.id} asset={a} licenses={licenses} canApprove={canApprove} />
          ))
        )}
      </section>
    </div>
  );
}
