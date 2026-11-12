import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import {
  DocButton,
  LexiconForm,
  NarrateForm,
  ReturnScriptForm,
  SceneForm,
  UploadTakeForm,
} from "@/components/admin/documentary-forms";
import { JobStatus } from "@/components/admin/job-status";
import { AutoRefresh } from "@/components/admin/project-forms";
import { hasPermission } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getDocumentaryView, getSpeechStatus } from "@/server/documentary/view";
import { VideoPanel } from "@/components/admin/video-panel";
import { getFfmpegStatus, getVideoPanel } from "@/server/video/view";

export const metadata: Metadata = { title: "Documentary" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
const minutes = (s: number) =>
  `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;

export default function DocumentaryPage({ params }: PageProps<"/admin/documentaries/[id]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Documentary params={params} />
    </Suspense>
  );
}

async function Documentary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("documentary:edit", `/admin/documentaries/${id}`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const doc = await getDocumentaryView(db, id);
  if (!doc) notFound();
  const script = doc.script;
  const canApprove = hasPermission(auth.user.role, "article:review");
  const speech = getSpeechStatus();
  const narrationJob = script
    ? await db.productionJob.findFirst({
        where: { type: "NARRATION", input: { path: ["scriptId"], equals: script.id } },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const [videoPanel, ffmpeg] = await Promise.all([getVideoPanel(db, id), getFfmpegStatus()]);
  const draft = script?.status === "DRAFT";
  const approved = script?.status === "APPROVED";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AutoRefresh
        active={Boolean(narrationJob && ["QUEUED", "RUNNING"].includes(narrationJob.status))}
      />
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">
          ai studio · documentary · {label(doc.status)}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {doc.article && (
            <>
              From the article{" "}
              <Link
                href={`/admin/articles/${doc.article.id}` as Route}
                className="text-primary underline underline-offset-4"
              >
                {doc.article.title}
              </Link>{" "}
              ({label(doc.article.status)})
            </>
          )}
          {doc.project && (
            <>
              {" · project "}
              <Link
                href={`/admin/projects/${doc.project.id}` as Route}
                className="text-primary underline underline-offset-4"
              >
                {doc.project.topic}
              </Link>
            </>
          )}
        </p>
        {script && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border px-3 py-1 font-mono text-xs">
              script v{script.version} · {label(script.status)}
              {script.approvedBy && ` by ${script.approvedBy}`}
            </span>
            <span className="text-sm">
              {script.scenes.length} scenes · {minutes(script.seconds)}
            </span>
            {draft && (
              <DocButton
                intent="submit"
                fields={{ scriptId: script.id }}
                label="Submit for review"
                variant="lime"
              />
            )}
            {draft && (
              <DocButton
                intent="rebuild"
                fields={{ documentaryId: doc.id }}
                label="Rebuild from the article"
                variant="ghost"
              />
            )}
            {script.status === "REVIEW" && canApprove && (
              <>
                <DocButton
                  intent="approve"
                  fields={{ scriptId: script.id }}
                  label="Approve script"
                  variant="lime"
                />
                <ReturnScriptForm scriptId={script.id} />
              </>
            )}
            {approved && (
              <DocButton
                intent="revise"
                fields={{ scriptId: script.id }}
                label="Revise (new version)"
              />
            )}
          </div>
        )}
        {script && script.problems.length > 0 && (
          <div
            role="note"
            className="mt-4 rounded-2xl border border-dashed border-pink p-4 text-sm"
          >
            <p className="font-semibold">Before approval:</p>
            <ul className="mt-1 list-disc pl-5">
              {script.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section
        aria-labelledby="narration-title"
        className="space-y-4 rounded-3xl border bg-card p-6"
      >
        <h2 id="narration-title" className="text-2xl font-bold">
          Narration
        </h2>
        <p className="text-sm">
          Engine:{" "}
          {speech.ok ? (
            <>
              <span className="font-mono">{speech.id}</span> · voice {speech.voiceId} ·{" "}
              {speech.free ? "no charge" : "paid; approved per script"} ·{" "}
              <span className={speech.voiceLicense ? "" : "text-destructive"}>
                voice licence: {speech.voiceLicense ?? "not stated"}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              not available — {speech.reason} Recorded takes can still be uploaded.
            </span>
          )}
        </p>
        {narrationJob && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Last narration run: <JobStatus status={narrationJob.status} />
            {narrationJob.status === "RUNNING" && `${narrationJob.progress}%`}
            {narrationJob.error && <span className="text-destructive">{narrationJob.error}</span>}
          </p>
        )}
        {approved ? (
          <NarrateForm scriptId={script!.id} enabled={speech.ok} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Narration starts once the script is approved, so its text is final.
          </p>
        )}
        <LexiconForm documentaryId={doc.id} lexicon={doc.lexicon} />
      </section>

      {approved && (
        <VideoPanel documentaryId={doc.id} title={doc.title} panel={videoPanel} ffmpeg={ffmpeg} />
      )}

      {script && (
        <section aria-labelledby="scenes-title" className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 id="scenes-title" className="text-2xl font-bold">
              Scenes
            </h2>
            {draft && (
              <DocButton intent="add_scene" fields={{ scriptId: script.id }} label="Add a scene" />
            )}
          </div>
          <ol className="space-y-3">
            {script.scenes.map((s) => (
              <li
                key={s.id}
                aria-label={`Scene ${s.position + 1}: ${s.beatLabel}`}
                className="space-y-3 rounded-3xl border bg-card p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                      {s.position + 1}
                    </span>{" "}
                    {s.beatLabel} · {label(s.status)} · {s.durationSeconds.toFixed(1)} s ·{" "}
                    {s.citationIds.length} citation(s)
                  </p>
                  {draft && (
                    <span className="flex gap-1">
                      <DocButton
                        intent="move_up"
                        fields={{ sceneId: s.id }}
                        label="↑"
                        variant="ghost"
                        ariaLabel={`Move scene ${s.position + 1} up`}
                      />
                      <DocButton
                        intent="move_down"
                        fields={{ sceneId: s.id }}
                        label="↓"
                        variant="ghost"
                        ariaLabel={`Move scene ${s.position + 1} down`}
                      />
                      <DocButton
                        intent="delete_scene"
                        fields={{ sceneId: s.id }}
                        label="Remove"
                        variant="ghost"
                        ariaLabel={`Remove scene ${s.position + 1}`}
                      />
                    </span>
                  )}
                </div>
                {draft ? (
                  <SceneForm scene={s} media={doc.mediaOptions} citations={doc.citationOptions} />
                ) : (
                  <div className="space-y-1 text-sm">
                    <p>{s.narration}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.visualDescription}
                      {s.onScreenText && ` · on screen: “${s.onScreenText}”`}
                    </p>
                  </div>
                )}
                {s.take && (
                  <div className="space-y-1 rounded-2xl bg-muted/50 p-3 text-xs">
                    <audio
                      controls
                      preload="none"
                      src={`/audio/${s.take.id}`}
                      className="w-full"
                      aria-label={`Narration of scene ${s.position + 1}`}
                    />
                    <p>
                      {s.take.source === "UPLOADED_RECORDING" ? "Recording" : "Synthetic voice"} ·{" "}
                      {s.take.provider} · {s.take.voiceId}
                      {s.take.durationMs !== null &&
                        ` · ${(s.take.durationMs / 1000).toFixed(1)} s`}
                      {s.take.costUsd !== null &&
                        s.take.costUsd > 0 &&
                        ` · $${s.take.costUsd.toFixed(4)}`}
                      {s.earlierTakes > 0 && ` · ${s.earlierTakes} earlier take(s) kept`}
                    </p>
                    <p
                      className={s.take.voiceLicense ? "text-muted-foreground" : "text-destructive"}
                    >
                      Voice licence: {s.take.voiceLicense ?? "not stated"}
                    </p>
                  </div>
                )}
                {approved && <UploadTakeForm sceneId={s.id} position={s.position} />}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
