import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { Badge } from "@/components/ui/badge";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listThumbnails } from "@/server/video/view";

export const metadata: Metadata = { title: "Thumbnail Generator" };

export default function ThumbnailsPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Thumbnails />
    </Suspense>
  );
}

async function Thumbnails() {
  const auth = await authorize("documentary:edit", "/admin/thumbnails");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const docs = await listThumbnails(getDb());
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · thumbnails</p>
        <h1 className="mt-2 text-4xl font-extrabold">Thumbnail Generator</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          1280×720 YouTube thumbnails from an approved picture and a short headline, made with
          FFmpeg (free). A thumbnail made from an AI reconstruction carries the reconstruction
          label, just like the video. Make and choose thumbnails on each documentary&apos;s page.
        </p>
      </section>
      {docs.map((d) => (
        <section
          key={d.id}
          aria-label={d.title}
          className="space-y-3 rounded-3xl border bg-card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{d.title}</h2>
            <Link
              href={`/admin/documentaries/${d.id}#video` as Route}
              className="text-sm text-primary underline underline-offset-4"
            >
              {d.thumbnails.length === 0 ? "Make a thumbnail" : "Make or choose thumbnails"}
            </Link>
          </div>
          {d.thumbnails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No thumbnails yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-3">
              {d.thumbnails.map((t) => (
                <li key={t.id} className="space-y-2">
                  {/* Staff-only route; next/image cannot optimise it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/thumbnails/${t.id}`}
                    alt={`Thumbnail: ${t.headline ?? "no headline"}`}
                    width={1280}
                    height={720}
                    loading="lazy"
                    className="h-auto w-full rounded-xl"
                  />
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    {t.isSelected && (
                      <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-lime-foreground">
                        selected
                      </span>
                    )}
                    {t.usesSyntheticMedia && (
                      <Badge variant="reconstruction">AI reconstruction</Badge>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {docs.length === 0 && (
        <p className="rounded-3xl border bg-card p-6 text-sm text-muted-foreground">
          No documentaries yet.
        </p>
      )}
    </div>
  );
}
