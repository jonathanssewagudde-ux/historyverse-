import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { JobStatus } from "@/components/admin/job-status";
import { MusicUploadForm } from "@/components/admin/video-forms";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getFfmpegStatus, listMusic, listVideoOverview } from "@/server/video/view";

export const metadata: Metadata = { title: "Video Editor" };

const duration = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function VideoEditorPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <VideoEditor />
    </Suspense>
  );
}

async function VideoEditor() {
  const auth = await authorize("documentary:edit", "/admin/video-editor");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const [docs, music, ffmpeg, licenses] = await Promise.all([
    listVideoOverview(db),
    listMusic(db),
    getFfmpegStatus(),
    db.mediaLicense.findMany({ where: { publishable: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · video</p>
        <h1 className="mt-2 text-4xl font-extrabold">Video Editor</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Approved scripts become MP4 documentaries: approved pictures with slow camera moves,
          narration, an optional music bed, captions and a source-and-licence manifest. Rendering
          uses FFmpeg on the worker, so it is free. Open a documentary to render it.
        </p>
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          <span className="text-xs text-muted-foreground">Render engine</span>
          <br />
          {ffmpeg.ok ? (
            <span className="font-mono">{ffmpeg.detail}</span>
          ) : (
            <span className="text-destructive">{ffmpeg.detail}</span>
          )}
        </p>
      </section>

      <section aria-labelledby="docs-title" className="rounded-3xl border bg-card p-6">
        <h2 id="docs-title" className="text-2xl font-bold">
          Documentaries
        </h2>
        <ul className="mt-4 divide-y">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <Link
                href={`/admin/documentaries/${d.id}#video` as Route}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {d.title}
              </Link>
              <span className="flex flex-wrap items-center gap-2">
                {d.approvedScript === null ? (
                  <span className="text-muted-foreground">script not approved yet</span>
                ) : d.latest ? (
                  <>
                    <JobStatus status={d.latest.status} />
                    {d.latest.format}
                    {d.latest.seconds !== null && ` · ${duration(d.latest.seconds)}`}
                  </>
                ) : (
                  <span>ready for a first render</span>
                )}
                <span className="text-muted-foreground">
                  · {d.finishedRenders} render(s) · {d.thumbnails} thumbnail(s)
                </span>
              </span>
            </li>
          ))}
          {docs.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No documentaries yet.</li>
          )}
        </ul>
      </section>

      <section aria-labelledby="music-title" className="space-y-4 rounded-3xl border bg-card p-6">
        <div>
          <h2 id="music-title" className="text-2xl font-bold">
            Music library
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only tracks under a licence that allows publication can be added, with the attribution
            the licence asks for. It is printed in the video&apos;s manifest and, in Milestone 12,
            in the YouTube description. Music plays quietly under the narration and loops if it is
            shorter than the film.
          </p>
        </div>
        <ul className="divide-y">
          {music.map((m) => (
            <li key={m.id} className="space-y-1 py-3 text-sm">
              <p>
                <span className="font-semibold">{m.title}</span> · {m.license}
                {m.seconds !== null && ` · ${duration(m.seconds)}`}
                {!m.publishable && (
                  <span className="text-destructive"> · licence no longer allows publication</span>
                )}
              </p>
              {m.attribution && <p className="text-xs text-muted-foreground">{m.attribution}</p>}
              <audio
                controls
                preload="none"
                src={`/video-assets/${m.id}`}
                className="w-full max-w-md"
                aria-label={`Listen to ${m.title}`}
              />
            </li>
          ))}
          {music.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No music yet.</li>
          )}
        </ul>
        <MusicUploadForm licenses={licenses.map((l) => ({ id: l.id, name: l.name }))} />
      </section>
    </div>
  );
}
