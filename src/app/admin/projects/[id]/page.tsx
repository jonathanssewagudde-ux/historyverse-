import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/admin/access-denied";
import { JobStatus } from "@/components/admin/job-status";
import {
  AutoRefresh,
  CostApproval,
  ProjectButton,
  SourceDecision,
} from "@/components/admin/project-forms";
import { CandidateDecision, MediaSearchForm } from "@/components/admin/media-studio-forms";
import { hasPermission } from "@/lib/auth/roles";
import { authorize } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  getModelStatus,
  getQueueStatus,
  getProjectView,
  type ProjectView,
} from "@/server/research/project-view";

export const metadata: Metadata = { title: "History project" };

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
// Small estimates need four decimals; budgets and zero read better with two.
const usd = (n: number) => `$${n.toFixed(n > 0 && n < 1 ? 4 : 2)}`;

/** The pipeline of CONTENT_PIPELINE.md, with the milestone that delivers each step. */
const PIPELINE = [
  ["Research", 8],
  ["Article draft", 8],
  ["Archival media discovery", 9],
  ["Reconstruction prompts", 9],
  ["Documentary script", 10],
  ["Scene plan", 10],
  ["Narration", 10],
  ["Video render", 11],
  ["YouTube assets", 11],
  ["Review", 12],
  ["Publication", 12],
] as const;

export default function ProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
    >
      <Project params={params} />
    </Suspense>
  );
}

function Job({
  job,
  projectId,
  canRun,
}: {
  job: NonNullable<ProjectView["research"]>;
  projectId: string;
  canRun: boolean;
}) {
  const active = ["QUEUED", "RUNNING", "AWAITING_APPROVAL"].includes(job.status);
  return (
    <div className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <JobStatus status={job.status} />
        {job.status === "RUNNING" && (
          <span className="flex items-center gap-2">
            <progress
              value={job.progress}
              max={100}
              className="h-2 w-40 accent-[var(--primary)]"
              aria-label="Progress"
            />
            {job.progress}%{" "}
            {job.step && <span className="text-muted-foreground">· {job.step}</span>}
          </span>
        )}
        {job.actualCostUsd !== null && <span>spent {usd(job.actualCostUsd)}</span>}
        <span className="text-muted-foreground">
          attempt {job.attempts}/{job.maxAttempts}
        </span>
      </div>
      {job.error && (
        <p className={job.status === "FAILED" ? "text-destructive" : "text-muted-foreground"}>
          {job.error}
        </p>
      )}
      {canRun && (
        <div className="flex flex-wrap gap-2">
          {active && (
            <ProjectButton
              projectId={projectId}
              intent="cancel_job"
              fields={{ jobId: job.id }}
              label="Cancel"
              variant="ghost"
            />
          )}
          {(job.status === "FAILED" || job.status === "CANCELLED") && (
            <ProjectButton
              projectId={projectId}
              intent="retry_job"
              fields={{ jobId: job.id }}
              label="Retry"
            />
          )}
        </div>
      )}
    </div>
  );
}

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize("research:run", `/admin/projects/${id}`);
  if (!auth.allowed) return <AccessDenied role={auth.user.role} />;
  const project = await getProjectView(getDb(), id);
  if (!project) notFound();
  const [queue, model] = [await getQueueStatus(), getModelStatus()];
  const role = auth.user.role;
  const canRun = hasPermission(role, "research:run");
  const canSpend = hasPermission(role, "spend:approve");
  const canMedia = hasPermission(role, "media:upload");
  const locked = Boolean(project.sourceSetApprovedAt);
  const report = project.report;
  const accepted = project.sources.filter((s) => s.status === "ACCEPTED");
  const draft = project.draft;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AutoRefresh active={project.activeJobs} />
      <section className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="font-mono text-xs text-muted-foreground">
          ai studio · project · {label(project.status)}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{project.topic}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Started by {project.createdBy} · budget {usd(project.budgetUsd)} · spent{" "}
          {usd(project.spentUsd)}
          {project.subject && (
            <>
              {" · subject "}
              <Link
                href={`/admin/entities/${project.subject.id}` as Route}
                className="text-primary underline underline-offset-4"
              >
                {project.subject.name}
              </Link>
            </>
          )}
        </p>
        {(!queue.configured || queue.workers === 0 || queue.workers === null) && (
          <p
            role="status"
            className="mt-3 rounded-2xl border border-dashed border-pink p-3 text-sm"
          >
            {!queue.configured
              ? "No job queue is configured (REDIS_URL), so jobs wait in the database until one is."
              : queue.workers === null
                ? "The job queue (Redis) cannot be reached right now; jobs wait until it can."
                : "No worker is running, so queued jobs are waiting. Start one with pnpm worker."}
          </p>
        )}
        <ol aria-label="Pipeline" className="mt-5 flex flex-wrap gap-2 font-mono text-xs">
          {PIPELINE.map(([name, milestone], i) => (
            <li
              key={name}
              className={
                milestone <= 9
                  ? "rounded-full border border-primary px-3 py-1"
                  : "rounded-full border px-3 py-1 text-muted-foreground"
              }
            >
              {i + 1}. {name}
              {milestone > 9 && ` · M${milestone}`}
            </li>
          ))}
        </ol>
      </section>

      {/* Step 1 ------------------------------------------------------------------------------ */}
      <section aria-labelledby="step-research" className="space-y-4 rounded-3xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="step-research" className="text-2xl font-bold">
            1. Research
          </h2>
          {canRun &&
            !locked &&
            project.research &&
            !["QUEUED", "RUNNING"].includes(project.research.status) && (
              <ProjectButton projectId={project.id} intent="research" label="Research again" />
            )}
        </div>
        {project.research ? (
          <Job job={project.research} projectId={project.id} canRun={canRun} />
        ) : (
          <p className="text-sm">Not started.</p>
        )}

        {report && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 rounded-2xl border p-4">
              <h3 className="font-bold">Subject</h3>
              <p>
                <a
                  href={`https://www.wikidata.org/wiki/${report.subject.qid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {report.subject.name} ({report.subject.qid})
                </a>{" "}
                · {label(report.subject.kind)} · {report.subject.dates ?? "no dates"}
              </p>
              {report.subject.summary && (
                <p className="text-sm text-muted-foreground">{report.subject.summary}</p>
              )}
              {report.subject.matchedBy === "search" && (
                <div className="text-sm">
                  <p className="font-medium">
                    Chosen as the best Wikidata match. If it is wrong, start a project with the
                    right Wikidata id. Other matches:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {report.subject.alternatives.map((a) => (
                      <li key={a.qid}>
                        {a.label} ({a.qid}){a.description && ` — ${a.description}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.warnings.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-destructive">
                  {report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2 rounded-2xl border p-4">
              <h3 className="font-bold">Accounts that disagree</h3>
              {report.conflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No differing dates in the structured data. Read the sources for disagreements in
                  the narrative.
                </p>
              ) : (
                report.conflicts.map((c) => (
                  <div key={c.property} className="text-sm">
                    <p className="font-mono text-xs">{c.property}</p>
                    <ul className="list-disc pl-5">
                      {c.values.map((v, i) => (
                        <li key={i}>
                          <strong>{v.label}</strong>: {v.statement}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
              {(report.people.length > 0 ||
                report.places.length > 0 ||
                report.events.length > 0 ||
                report.periods.length > 0) && (
                <>
                  <h3 className="pt-2 font-bold">Related records already in the database</h3>
                  <ul className="list-disc pl-5 text-sm">
                    {[...report.people, ...report.places].map((p, i) => (
                      <li key={`r${i}`}>{p.relation}</li>
                    ))}
                    {[...report.events, ...report.periods].map((e, i) => (
                      <li key={`e${i}`}>
                        {e.name}
                        {e.dates && ` (${e.dates})`}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="rounded-2xl border p-4 lg:col-span-2">
              <h3 className="font-bold">Dates in the structured data ({report.dates.length})</h3>
              <p className="text-xs text-muted-foreground">
                Imported from Wikidata as unverified leads; each is checked against the sources
                before use.
              </p>
              <ol className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {report.dates.map((d, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs text-primary">{d.label}</span> {d.statement}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>

      {/* Source set review --------------------------------------------------------------------- */}
      {project.sources.length > 0 && (
        <section
          aria-labelledby="step-sources"
          className="space-y-4 rounded-3xl border bg-card p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="step-sources" className="text-2xl font-bold">
              Source set ({accepted.length} accepted of {project.sources.length})
            </h2>
            {canRun &&
              (locked ? (
                <ProjectButton
                  projectId={project.id}
                  intent="reopen_sources"
                  label="Reopen the source set"
                  variant="ghost"
                />
              ) : (
                <ProjectButton
                  projectId={project.id}
                  intent="approve_sources"
                  label="Approve the source set"
                  variant="lime"
                />
              ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {locked
              ? `Approved by ${project.sourceSetApprovedBy ?? "a researcher"}. Drafts may use only the accepted sources with retrieved text; accepted books appear as further reading.`
              : "Accept the sources a draft may use and reject the rest (with a reason). Encyclopedias and Wikidata are tertiary: useful for orientation, to be checked against scholarship. Book tiers are unknown until someone checks them."}
          </p>
          <ul className="divide-y">
            {project.sources.map((s) => (
              <li key={s.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline underline-offset-4"
                    >
                      {s.title}
                    </a>
                    <p className="text-sm text-muted-foreground">
                      {[
                        s.authors.join(", "),
                        s.publishedYear,
                        s.provider,
                        label(s.kind),
                        `tier: ${label(s.tier)}`,
                        s.licenseNote,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {s.note && <p className="text-sm">Note: {s.note}</p>}
                  </div>
                  <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                    {label(s.status)}
                    {s.reviewedBy && ` · ${s.reviewedBy}`}
                  </span>
                </div>
                {s.excerpts.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Retrieved text: {s.excerpts.length} sections
                    </summary>
                    <div className="mt-2 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-muted/50 p-3">
                      {s.excerpts.map((e, i) => (
                        <div key={i}>
                          <p className="font-semibold">{e.heading}</p>
                          <p className="whitespace-pre-line text-muted-foreground">{e.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {canRun && (
                  <SourceDecision
                    projectId={project.id}
                    sourceId={s.id}
                    status={s.status}
                    locked={locked}
                    title={s.title}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Step 2 ------------------------------------------------------------------------------ */}
      <section aria-labelledby="step-draft" className="space-y-4 rounded-3xl border bg-card p-6">
        <h2 id="step-draft" className="text-2xl font-bold">
          2. Article draft
        </h2>
        <p className="text-sm">
          Language model:{" "}
          {model.ok ? (
            <>
              <span className="font-mono">{model.id}</span> · {model.priceBasis}
            </>
          ) : (
            <span className="text-muted-foreground">not available — {model.reason}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          The model sees only the accepted evidence and must cite it in every sentence. Sentences
          without a valid citation, and dates whose year is not in the cited excerpt, are removed
          automatically and listed below. The result is saved as an unreviewed AI draft in the
          Article Studio and goes through research review and editorial approval like any other.
        </p>
        {draft && <Job job={draft} projectId={project.id} canRun={canRun} />}

        {draft?.status === "AWAITING_APPROVAL" && draft.costEstimateUsd !== null && (
          <div className="space-y-3 rounded-2xl border border-dashed border-pink p-4">
            <p className="font-semibold">Estimated cost: up to {usd(draft.costEstimateUsd)}</p>
            {draft.estimateBasis && (
              <p className="text-sm text-muted-foreground">{draft.estimateBasis}</p>
            )}
            <p className="text-sm">
              Project budget {usd(project.budgetUsd)}, spent {usd(project.spentUsd)}. Monthly
              ceiling {usd(project.monthlyCeilingUsd)} (AI_MONTHLY_BUDGET_USD), committed this month{" "}
              {usd(project.monthlyCommittedUsd)}.
            </p>
            {canSpend ? (
              <CostApproval
                projectId={project.id}
                jobId={draft.id}
                amount={draft.costEstimateUsd}
              />
            ) : (
              <p className="text-sm">An administrator must approve this spending.</p>
            )}
          </div>
        )}

        {!project.article &&
          canRun &&
          locked &&
          model.ok &&
          (!draft || ["FAILED", "CANCELLED"].includes(draft.status)) && (
            <ProjectButton
              projectId={project.id}
              intent="request_draft"
              label="Request an AI-assisted draft"
              variant="lime"
            />
          )}
        {!locked && (
          <p className="text-sm text-muted-foreground">
            Approve the source set to request a draft.
          </p>
        )}

        {project.article && (
          <p className="rounded-2xl bg-muted/50 p-4">
            Draft saved:{" "}
            <Link
              href={`/admin/articles/${project.article.id}` as Route}
              className="font-semibold text-primary underline underline-offset-4"
            >
              {project.article.title}
            </Link>{" "}
            ({label(project.article.status)})
          </p>
        )}

        {project.grounding && (
          <div className="space-y-3 rounded-2xl border p-4 text-sm">
            <h3 className="font-bold">Grounding check</h3>
            <p>
              {project.grounding.keptSentences} sentences kept ·{" "}
              {project.grounding.removedSentences.length} removed ·{" "}
              {project.grounding.removedKeyDates.length} key dates removed ·{" "}
              {project.grounding.copiedPhrases.length} copied phrases to rewrite
            </p>
            {project.grounding.removedSentences.length > 0 && (
              <details>
                <summary className="cursor-pointer">Removed sentences</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {project.grounding.removedSentences.map((r, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">
                        [{r.section}] {r.reason}:
                      </span>{" "}
                      {r.sentence}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {project.grounding.removedKeyDates.length > 0 && (
              <details>
                <summary className="cursor-pointer">Removed key dates</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {project.grounding.removedKeyDates.map((r, i) => (
                    <li key={i}>
                      {r.statement} <span className="text-muted-foreground">({r.reason})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {project.grounding.copiedPhrases.length > 0 && (
              <details open>
                <summary className="cursor-pointer">
                  Phrases copied from the sources (rewrite before publishing)
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {project.grounding.copiedPhrases.map((c, i) => (
                    <li key={i}>
                      [{c.section}] “{c.phrase}”
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Step 3 ------------------------------------------------------------------------------ */}
      <section aria-labelledby="step-media" className="space-y-4 rounded-3xl border bg-card p-6">
        <h2 id="step-media" className="text-2xl font-bold">
          3. Archival media
        </h2>
        <p className="text-sm text-muted-foreground">
          Images found in free archives (Wikimedia Commons, and the Library of Congress when
          enabled), with the licence each archive states. Check the licence on the source page
          before adding an image: it then enters the media library unclassified and is shown to
          readers only after classification and an editor&apos;s approval.
        </p>
        {project.mediaSearch && (
          <Job job={project.mediaSearch} projectId={project.id} canRun={canRun} />
        )}
        {canMedia && project.subject && (
          <MediaSearchForm projectId={project.id} defaultQuery={project.subject.name} />
        )}
        {!project.subject && (
          <p className="text-sm">Run research first: the subject is not known yet.</p>
        )}
        {project.candidates.length > 0 && (
          <ul aria-label="Images found" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.candidates.map((c) => (
              <li key={c.id} className="space-y-2 rounded-2xl border p-3 text-sm">
                {c.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- archive-hosted preview, not stored by us
                  <img
                    src={c.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full rounded-xl bg-muted object-cover"
                  />
                )}
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-semibold break-words text-primary underline underline-offset-4"
                >
                  {c.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {[
                    c.creator,
                    c.dateText,
                    c.provider === "commons" ? "Wikimedia Commons" : "Library of Congress",
                    c.width && c.height ? `${c.width}×${c.height}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className={c.licenseCode === "UNKNOWN" ? "text-xs text-destructive" : "text-xs"}>
                  Licence as stated: {c.licenseName}
                  {c.rightsStatement && ` — ${c.rightsStatement}`}
                </p>
                {c.status === "CANDIDATE" ? (
                  canMedia && <CandidateDecision candidateId={c.id} title={c.title} />
                ) : (
                  <p className="font-mono text-xs">
                    {label(c.status)}
                    {c.reviewedBy && ` · ${c.reviewedBy}`}
                    {c.note && ` · ${c.note}`}
                    {c.mediaId && (
                      <>
                        {" · "}
                        <Link
                          href={"/admin/media?review=PENDING" as Route}
                          className="text-primary underline underline-offset-4"
                        >
                          in the library
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Step 4 ------------------------------------------------------------------------------ */}
      <section aria-labelledby="step-recon" className="space-y-4 rounded-3xl border bg-card p-6">
        <h2 id="step-recon" className="text-2xl font-bold">
          4. Reconstruction prompts
        </h2>
        <p className="text-sm">
          {project.reconstructions} prompt(s).{" "}
          <Link
            href={"/admin/ai-images" as Route}
            className="font-semibold text-primary underline underline-offset-4"
          >
            Open the AI Image Studio
          </Link>{" "}
          to write evidence-based prompts and make labelled reconstructions.
        </p>
        {project.imageApprovals.map((job) => (
          <div key={job.id} className="space-y-3 rounded-2xl border border-dashed border-pink p-4">
            <p className="font-semibold">
              Image generation waiting for approval: up to {usd(job.costEstimateUsd ?? 0)}
            </p>
            {job.estimateBasis && (
              <p className="text-sm text-muted-foreground">{job.estimateBasis}</p>
            )}
            <p className="text-sm">
              Project budget {usd(project.budgetUsd)}, spent {usd(project.spentUsd)}. Monthly
              ceiling {usd(project.monthlyCeilingUsd)}, committed this month{" "}
              {usd(project.monthlyCommittedUsd)}.
            </p>
            {canSpend ? (
              <CostApproval
                projectId={project.id}
                jobId={job.id}
                amount={job.costEstimateUsd ?? 0}
                what="these images"
              />
            ) : (
              <p className="text-sm">An administrator must approve this spending.</p>
            )}
            {canRun && (
              <ProjectButton
                projectId={project.id}
                intent="cancel_job"
                fields={{ jobId: job.id }}
                label="Cancel"
                variant="ghost"
              />
            )}
          </div>
        ))}
      </section>

      <p className="px-1 text-sm text-muted-foreground">
        Steps 5–11 (documentary, narration, video, YouTube) arrive in Milestones 10–12.
      </p>
    </div>
  );
}
