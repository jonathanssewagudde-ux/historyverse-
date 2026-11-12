import { JobStatus } from "@/components/admin/job-status";
import { AutoRefresh } from "@/components/admin/project-forms";
import { DocButton } from "@/components/admin/documentary-forms";
import { RenderForm, ThumbnailForm } from "@/components/admin/video-forms";
import { Badge } from "@/components/ui/badge";
import { RECONSTRUCTION_LABEL } from "@/lib/media/labels";
import type { getVideoPanel } from "@/server/video/view";

type Panel = Awaited<ReturnType<typeof getVideoPanel>>;

const duration = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The documentary page's Video section: render, review, captions, thumbnails and the manifest. */
export function VideoPanel({
  documentaryId,
  title,
  panel,
  ffmpeg,
}: {
  documentaryId: string;
  title: string;
  panel: Panel;
  ffmpeg: { ok: boolean; detail: string };
}) {
  const ready = panel.problems.length === 0 && ffmpeg.ok;
  const manifest = panel.manifest;
  return (
    <section
      id="video"
      aria-labelledby="video-title"
      className="space-y-5 rounded-3xl border bg-card p-6"
    >
      <AutoRefresh active={panel.active} />
      <div>
        <h2 id="video-title" className="text-2xl font-bold">
          Video
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rendered on the worker with FFmpeg: free and local. Each picture gets a slow camera move
          and keeps its credit line; AI reconstructions carry the label “{RECONSTRUCTION_LABEL}”
          burned into the picture. Renders stay private to staff until an administrator approves
          publication.
        </p>
        <p className="mt-2 font-mono text-xs">
          engine:{" "}
          {ffmpeg.ok ? ffmpeg.detail : <span className="text-destructive">{ffmpeg.detail}</span>}
        </p>
      </div>

      {panel.problems.length > 0 ? (
        <div role="note" className="rounded-2xl border border-dashed border-pink p-4 text-sm">
          <p className="font-semibold">Before rendering:</p>
          <ul className="mt-1 list-disc pl-5">
            {panel.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm">
          Ready to render script v{panel.scriptVersion}: every scene has approved pictures and
          narration.
        </p>
      )}
      <RenderForm
        documentaryId={documentaryId}
        formats={panel.formats}
        music={panel.music}
        enabled={ready}
      />

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Renders</h3>
        {panel.renders.length === 0 && (
          <p className="text-sm text-muted-foreground">No renders yet.</p>
        )}
        <ul className="space-y-4">
          {panel.renders.map((r) => (
            <li
              key={r.id}
              className="space-y-2 rounded-2xl border p-4"
              aria-label={`Render ${r.formatLabel}`}
            >
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <JobStatus status={r.status} />
                <span className="font-semibold">{r.formatLabel}</span>
                {r.scriptVersion !== null && <span>· script v{r.scriptVersion}</span>}
                {r.status === "RENDERING" && <span>· {r.progress}%</span>}
                {r.seconds !== null && <span>· {duration(r.seconds)}</span>}
                {r.megabytes !== null && (
                  <span>
                    ·{" "}
                    {r.megabytes < 1
                      ? `${Math.max(1, Math.round(r.megabytes * 1024))} KB`
                      : `${r.megabytes.toFixed(1)} MB`}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  · {new Date(r.createdAt).toUTCString().replace(" GMT", " UTC")}
                </span>
              </p>
              {r.error && <p className="text-sm text-destructive">{r.error}</p>}
              {r.status === "SUCCEEDED" && (
                <>
                  <video
                    controls
                    preload="metadata"
                    src={`/video/${r.id}`}
                    className={`rounded-xl bg-black ${r.vertical ? "max-h-[70vh] w-auto" : "w-full"}`}
                    aria-label={`${title}, ${r.formatLabel}`}
                  >
                    {r.captions
                      .filter((c) => c.ext === "vtt")
                      .map((c) => (
                        <track
                          key={c.id}
                          kind="captions"
                          src={`/video-assets/${c.id}`}
                          srcLang={c.language ?? "en"}
                          label="Captions"
                        />
                      ))}
                  </video>
                  <p className="flex flex-wrap gap-3 text-sm">
                    <a
                      className="text-primary underline underline-offset-4"
                      href={`/video/${r.id}?download=1`}
                    >
                      Download MP4
                    </a>
                    {r.captions.map((c) => (
                      <a
                        key={c.id}
                        className="text-primary underline underline-offset-4"
                        href={`/video-assets/${c.id}?download=1`}
                      >
                        Captions ({c.ext.toUpperCase()})
                      </a>
                    ))}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Thumbnails</h3>
        <p className="text-sm text-muted-foreground">
          1280×720 for YouTube, from an approved picture. Thumbnails made from AI reconstructions
          carry the reconstruction label.
        </p>
        <ThumbnailForm
          documentaryId={documentaryId}
          images={panel.imageOptions}
          defaultHeadline={title}
        />
        {panel.thumbnails.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {panel.thumbnails.map((t) => (
              <li key={t.id} className="space-y-2 rounded-2xl border p-3">
                {/* Staff-only route; next/image cannot optimise it. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/thumbnails/${t.id}`}
                  alt={`Thumbnail: ${t.headline ?? "no headline"}`}
                  width={1280}
                  height={720}
                  className="h-auto w-full rounded-xl"
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {t.usesSyntheticMedia && (
                    <Badge variant="reconstruction">AI reconstruction</Badge>
                  )}
                  {t.isSelected ? (
                    <span className="rounded-full bg-lime px-2 py-0.5 font-mono text-xs text-lime-foreground">
                      selected
                    </span>
                  ) : (
                    <DocButton
                      intent="select_thumbnail"
                      fields={{ thumbnailId: t.id }}
                      label="Use this one"
                      ariaLabel={`Use thumbnail “${t.headline}”`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {manifest && (
        <details className="rounded-2xl border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Source and licence manifest (render of{" "}
            {new Date(manifest.generatedAt).toUTCString().replace(" GMT", " UTC")})
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Script v{manifest.script.version}
              {manifest.script.approvedBy && `, approved by ${manifest.script.approvedBy}`}.{" "}
              {manifest.containsAiReconstruction && (
                <Badge variant="reconstruction">Contains AI reconstruction</Badge>
              )}{" "}
              {manifest.syntheticVoice && "Narrated with a synthetic voice."}
            </p>
            <div>
              <p className="font-semibold">Pictures</p>
              <ul className="list-disc pl-5">
                {manifest.images.map((m) => (
                  <li key={`${m.title}-${m.scenes.join()}`}>
                    {m.title} — {m.kind} · {m.license} · {m.attribution} (scenes{" "}
                    {m.scenes.join(", ")})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Narration</p>
              <ul className="list-disc pl-5">
                {[
                  ...new Set(
                    manifest.narration.map(
                      (n) =>
                        `${n.provider ?? "recording"} · ${n.voice ?? "—"} · ${n.voiceLicense ?? "voice licence not stated"}`,
                    ),
                  ),
                ].map((v) => (
                  <li key={v} className={v.endsWith("not stated") ? "text-destructive" : ""}>
                    {v}
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="font-semibold">Music:</span>{" "}
              {manifest.music
                ? `${manifest.music.title} · ${manifest.music.license}${manifest.music.attribution ? ` · ${manifest.music.attribution}` : ""}`
                : "none"}
            </p>
            <div>
              <p className="font-semibold">Sources cited in the narration</p>
              {manifest.sources.length === 0 ? (
                <p className="text-muted-foreground">None.</p>
              ) : (
                <ul className="list-disc pl-5">
                  {manifest.sources.map((s) => (
                    <li key={s.title}>
                      {s.title} (scenes {s.scenes.join(", ")})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
