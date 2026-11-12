import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getLanguageModel } from "@/server/ai/providers";
import { getServerEnv } from "@/server/env";
import { getQueue } from "@/server/jobs/queue";
import { monthlyCommittedUsd } from "@/server/jobs/service";
import { ProviderUnavailableError } from "@/server/providers/contracts";
import type { GroundingReport } from "./grounding";
import type { ResearchReport } from "./research-job";

export interface QueueStatus {
  configured: boolean;
  /** Workers currently connected to the queue; null when Redis could not be reached. */
  workers: number | null;
}

/** Whether jobs can actually run: a queue, and at least one worker listening to it. */
export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = getQueue();
  if (!queue) return { configured: false, workers: 0 };
  try {
    const workers = await Promise.race([
      queue.getWorkersCount(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return { configured: true, workers };
  } catch {
    return { configured: true, workers: null };
  }
}

export function getModelStatus():
  { ok: true; id: string; priceBasis: string; free: boolean } | { ok: false; reason: string } {
  try {
    const { provider, price } = getLanguageModel();
    return {
      ok: true,
      id: provider.id,
      priceBasis: price.basis,
      free: price.input === 0 && price.output === 0,
    };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof ProviderUnavailableError
          ? error.message
          : "The language model is not usable.",
    };
  }
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export async function listProjects(db: PrismaClient) {
  const projects = await db.contentProject.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { name: true } },
      jobs: { orderBy: { createdAt: "desc" }, select: { type: true, status: true } },
      _count: { select: { researchSources: true } },
    },
  });
  return projects.map((p) => ({
    id: p.id,
    topic: p.topic,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy?.name ?? "operator",
    sources: p._count.researchSources,
    research: p.jobs.find((j) => j.type === "RESEARCH")?.status ?? null,
    draft: p.jobs.find((j) => j.type === "ARTICLE_DRAFT")?.status ?? null,
    articleId: p.articleId,
  }));
}

export async function getProjectView(db: PrismaClient, id: string) {
  const project = await db.contentProject.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      sourceSetApprovedBy: { select: { name: true } },
      primaryEntity: { select: { id: true, name: true } },
      article: { select: { id: true, title: true, status: true } },
      jobs: {
        orderBy: { createdAt: "desc" },
        include: {
          approvedBy: { select: { name: true } },
          requestedBy: { select: { name: true } },
        },
      },
      mediaCandidates: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: { reviewedBy: { select: { name: true } } },
      },
      _count: { select: { reconstructions: true } },
      documentaries: {
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
      },
      researchSources: {
        orderBy: [{ status: "asc" }, { kind: "asc" }, { publishedYear: "asc" }],
        include: { reviewedBy: { select: { name: true } } },
      },
    },
  });
  if (!project) return null;

  const describe = (j: (typeof project.jobs)[number] | undefined) => {
    if (!j) return null;
    const output = (j.output ?? {}) as Record<string, unknown>;
    return {
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      step: typeof output.step === "string" ? output.step : null,
      error: j.error,
      costEstimateUsd: j.costEstimateUsd ? Number(j.costEstimateUsd) : null,
      actualCostUsd: j.actualCostUsd ? Number(j.actualCostUsd) : null,
      estimateBasis:
        typeof (j.input as Record<string, unknown>)?.estimateBasis === "string"
          ? String((j.input as Record<string, unknown>).estimateBasis)
          : null,
      approvedBy: j.approvedBy?.name ?? null,
      requestedBy: j.requestedBy?.name ?? null,
      createdAt: j.createdAt.toISOString(),
      startedAt: iso(j.startedAt),
      finishedAt: iso(j.finishedAt),
      output,
    };
  };
  const job = (type: "RESEARCH" | "ARTICLE_DRAFT" | "MEDIA_SEARCH") =>
    describe(project.jobs.find((x) => x.type === type));
  const research = job("RESEARCH");
  const mediaSearch = job("MEDIA_SEARCH");
  const imageApprovals = project.jobs
    .filter(
      (j) =>
        (j.type === "IMAGE_GENERATION" || j.type === "NARRATION") &&
        j.status === "AWAITING_APPROVAL",
    )
    .map((j) => describe(j)!);
  const draft = job("ARTICLE_DRAFT");
  const { env } = getServerEnv();

  return {
    id: project.id,
    slug: project.slug,
    topic: project.topic,
    status: project.status,
    subjectQid: project.subjectQid,
    budgetUsd: Number(project.budgetUsd),
    spentUsd: Number(project.spentUsd),
    monthlyCeilingUsd: env.AI_MONTHLY_BUDGET_USD,
    monthlyCommittedUsd: await monthlyCommittedUsd(db),
    createdBy: project.createdBy?.name ?? "operator",
    createdAt: project.createdAt.toISOString(),
    subject: project.primaryEntity,
    article: project.article,
    sourceSetApprovedAt: iso(project.sourceSetApprovedAt),
    sourceSetApprovedBy: project.sourceSetApprovedBy?.name ?? null,
    research,
    mediaSearch,
    imageApprovals,
    documentaries: project.documentaries,
    reconstructions: project._count.reconstructions,
    candidates: project.mediaCandidates.map((c) => ({
      id: c.id,
      provider: c.provider,
      title: c.title,
      sourceUrl: c.sourceUrl,
      thumbnailUrl: c.thumbnailUrl,
      creator: c.creator,
      dateText: c.dateText,
      licenseCode: c.licenseCode,
      licenseName: c.licenseName,
      rightsStatement: c.rightsStatement,
      width: c.width,
      height: c.height,
      status: c.status,
      note: c.note,
      reviewedBy: c.reviewedBy?.name ?? null,
      mediaId: c.mediaId,
    })),
    report: (research?.status === "SUCCEEDED"
      ? research.output.report
      : null) as ResearchReport | null,
    draft,
    grounding: (draft?.status === "SUCCEEDED"
      ? draft.output.grounding
      : null) as GroundingReport | null,
    sources: project.researchSources.map((s) => ({
      id: s.id,
      kind: s.kind,
      tier: s.tier,
      provider: s.provider,
      title: s.title,
      authors: s.authors,
      publishedYear: s.publishedYear,
      url: s.url,
      licenseNote: s.licenseNote,
      excerpts: Array.isArray(s.excerpts)
        ? (s.excerpts as { heading: string; text: string }[])
        : [],
      status: s.status,
      note: s.note,
      reviewedBy: s.reviewedBy?.name ?? null,
      retrievedAt: s.retrievedAt.toISOString(),
    })),
    activeJobs: project.jobs.some((j) => ["QUEUED", "RUNNING"].includes(j.status)),
  };
}

export type ProjectView = NonNullable<Awaited<ReturnType<typeof getProjectView>>>;
