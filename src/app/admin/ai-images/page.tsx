import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import {
  GenerateForm,
  ReconstructionPromptForm,
  ReviewReconstructionForm,
  UploadReconstructionForm,
  type PromptFormProject,
} from "@/components/admin/media-studio-forms";
import { MediaFrame, RECONSTRUCTION_LABEL } from "@/components/media/media-frame";
import { hasPermission } from "@/lib/auth/roles";
import { getImageModel } from "@/server/ai/images";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listReconstructions } from "@/server/media/reconstructions";
import { ProviderUnavailableError } from "@/server/providers/contracts";

export const metadata: Metadata = { title: "AI Image Studio" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");

export default function AiImagesPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Studio />
    </Suspense>
  );
}

function imageStatus() {
  try {
    const { provider, perImageUsd } = getImageModel();
    return { ok: true as const, text: `${provider.id} · $${perImageUsd} per image` };
  } catch (error) {
    return {
      ok: false as const,
      text:
        error instanceof ProviderUnavailableError
          ? error.message
          : "The image generator is not usable.",
    };
  }
}

async function Studio() {
  const auth = await authorize("media:upload", "/admin/ai-images");
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const db = getDb();
  const [reconstructions, projects] = await Promise.all([
    listReconstructions(db),
    db.contentProject.findMany({
      where: { primaryEntityId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        topic: true,
        researchSources: { where: { status: "ACCEPTED" }, select: { id: true, title: true } },
      },
    }),
  ]);
  const formProjects: PromptFormProject[] = projects.map((p) => ({
    id: p.id,
    topic: p.topic,
    sources: p.researchSources.map((s) => ({ ref: `rs:${s.id}`, title: s.title })),
  }));
  const generator = imageStatus();
  const canReview = hasPermission(auth.user.role, "media:approve");

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">ai studio · images</p>
        <h1 className="mt-2 text-4xl font-extrabold">AI Image Studio</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Reconstructions illustrate what the sources describe when no authentic image exists. Each
          prompt records the evidence it rests on and what is invented. Every image made from it is
          stored as an AI reconstruction and shown everywhere with the label{" "}
          <strong className="text-reconstruction">“{RECONSTRUCTION_LABEL}”</strong>, which cannot be
          removed.
        </p>
        <p className="mt-3 text-sm">
          Image generator:{" "}
          {generator.ok ? (
            generator.text
          ) : (
            <span className="text-muted-foreground">not available — {generator.text}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Without a generator, write the prompt here, make the image with any tool, and upload it:
          it is labelled the same way.
        </p>
      </section>

      <section aria-labelledby="new-prompt" className="rounded-3xl border bg-card p-6">
        <h2 id="new-prompt" className="mb-4 text-2xl font-bold">
          New reconstruction prompt
        </h2>
        <ReconstructionPromptForm projects={formProjects} />
      </section>

      <section aria-labelledby="prompts" className="space-y-3">
        <h2 id="prompts" className="px-1 text-2xl font-bold">
          Reconstructions ({reconstructions.length})
        </h2>
        {reconstructions.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">No prompts yet.</p>
        )}
        {reconstructions.map((r) => (
          <article
            key={r.id}
            aria-label={`Reconstruction for ${r.subject ?? "a project"}`}
            className="space-y-4 rounded-3xl border bg-card p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.subject ?? "Untitled subject"}</p>
                {r.project && (
                  <Link
                    href={`/admin/projects/${r.project.id}` as Route}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    {r.project.topic}
                  </Link>
                )}
              </div>
              <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                {label(r.status)}
                {r.model && ` · ${r.model}`}
                {r.costUsd !== null && ` · $${r.costUsd.toFixed(2)}`}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <p className="rounded-xl bg-muted/50 p-3 font-mono text-xs whitespace-pre-line">
                  {r.prompt}
                </p>
                {r.negativePrompt && (
                  <p className="text-xs text-muted-foreground">Leave out: {r.negativePrompt}</p>
                )}
                <p>
                  <span className="font-semibold">Evidence:</span> {r.evidenceNotes}
                </p>
                <p>
                  <span className="font-semibold">Interpretation:</span> {r.interpretationNotes}
                </p>
                <ul className="list-disc pl-5">
                  {r.sources.map((s, i) => (
                    <li key={i}>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4"
                        >
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      : {s.note}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                {r.images.length === 0 && ["PROMPT_DRAFT", "FAILED"].includes(r.status) && (
                  <>
                    {r.project && <GenerateForm reconstructionId={r.id} available={generator.ok} />}
                    <UploadReconstructionForm reconstructionId={r.id} />
                  </>
                )}
                {["QUEUED", "GENERATING"].includes(r.status) && r.images.length === 0 && (
                  <p className="text-sm">
                    Waiting: generation is queued or running. Paid generation is approved on the{" "}
                    {r.project ? (
                      <Link
                        href={`/admin/projects/${r.project.id}` as Route}
                        className="text-primary underline underline-offset-4"
                      >
                        project page
                      </Link>
                    ) : (
                      "project page"
                    )}
                    .
                  </p>
                )}
                {r.images.map((img) => (
                  <div key={img.mediaId} className="space-y-2">
                    {img.stored && (
                      <MediaFrame
                        src={`/media/${img.mediaId}`}
                        alt={img.altText ?? "AI reconstruction awaiting description"}
                        width={1536}
                        height={1024}
                        kind="ai_reconstruction"
                        caption={`Review: ${label(img.reviewStatus)}`}
                        credit={{
                          source: "HISTORYVERSE AI Image Studio",
                          license: "HISTORYVERSE original",
                        }}
                        unoptimized
                        sizes="(min-width: 1024px) 40vw, 100vw"
                      />
                    )}
                    {canReview && img.reviewStatus === "PENDING" && (
                      <ReviewReconstructionForm reconstructionId={img.reconstructionId} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
