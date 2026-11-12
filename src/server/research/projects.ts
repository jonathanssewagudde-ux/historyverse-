import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { getLanguageModel } from "@/server/ai/providers";
import { recordAudit } from "@/server/audit";
import { createJob, JobServiceError, userIdOf } from "@/server/jobs/service";
import { ProviderUnavailableError } from "@/server/providers/contracts";
import { isQid } from "@/server/sources/wikidata/client";
import { slugify } from "@/server/sources/wikidata/mapper";
import { buildDraftRequest } from "./draft-job";

type Actor = { id: string; email?: string | null; role: Role };

export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectError";
  }
}

/** "Generate History Project": create the project and queue its research step. */
export async function createProject(
  db: PrismaClient,
  actor: Actor,
  input: { topic: string; subjectQid: string; budgetUsd: number },
) {
  if (!hasPermission(actor.role, "project:create")) {
    throw new ProjectError("Only administrators can start projects.");
  }
  const topic = input.topic.trim().replace(/\s+/g, " ");
  if (topic.length < 3 || topic.length > 160)
    throw new ProjectError("Give a topic of 3 to 160 characters.");
  const qid = input.subjectQid.trim().toUpperCase();
  if (qid && !isQid(qid)) throw new ProjectError("The Wikidata id must look like Q1036.");
  if (!Number.isFinite(input.budgetUsd) || input.budgetUsd < 0 || input.budgetUsd > 1000) {
    throw new ProjectError("The budget must be between $0 and $1,000.");
  }
  if (input.budgetUsd > 0 && !hasPermission(actor.role, "spend:approve")) {
    throw new ProjectError("Only administrators who approve spending can give a project a budget.");
  }
  const base = slugify(topic, "project").slice(0, 60);
  let slug = base;
  for (let n = 2; await db.contentProject.findUnique({ where: { slug } }); n++)
    slug = `${base}-${n}`;

  const project = await db.contentProject.create({
    data: {
      slug,
      topic,
      subjectQid: qid || null,
      budgetUsd: new Prisma.Decimal(input.budgetUsd.toFixed(2)),
      createdById: userIdOf(actor),
    },
  });
  await recordAudit({
    action: "project.created",
    actor,
    target: { type: "project", id: project.id },
    metadata: { topic, subjectQid: qid || null, budgetUsd: input.budgetUsd },
  });
  const { queued } = await createJob(db, actor, { projectId: project.id, type: "RESEARCH" });
  return { project, queued };
}

export async function rerunResearch(db: PrismaClient, actor: Actor, projectId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new ProjectError("You cannot run research.");
  const project = await db.contentProject.findUnique({ where: { id: projectId } });
  if (!project) throw new ProjectError("Project not found.");
  if (project.sourceSetApprovedAt) {
    throw new ProjectError("The source set is approved. Reopen it before researching again.");
  }
  return createJob(db, actor, { projectId, type: "RESEARCH" });
}

function assertOpen(project: { sourceSetApprovedAt: Date | null } | null) {
  if (!project) throw new ProjectError("Project not found.");
  if (project.sourceSetApprovedAt) {
    throw new ProjectError("The source set is approved and locked. Reopen it to change decisions.");
  }
}

/** Accept or reject one candidate source. Accepting a source records it for citation. */
export async function reviewResearchSource(
  db: PrismaClient,
  actor: Actor,
  researchSourceId: string,
  decision: "ACCEPTED" | "REJECTED" | "CANDIDATE",
  note: string,
) {
  if (!hasPermission(actor.role, "research:run"))
    throw new ProjectError("You cannot review sources.");
  const rs = await db.researchSource.findUnique({
    where: { id: researchSourceId },
    include: { project: true },
  });
  if (!rs) throw new ProjectError("Source not found.");
  assertOpen(rs.project);
  if (decision === "REJECTED" && note.trim().length < 3) {
    throw new ProjectError("Say briefly why the source is rejected.");
  }
  await db.researchSource.update({
    where: { id: rs.id },
    data: {
      status: decision,
      reviewedById: decision === "CANDIDATE" ? null : actor.id,
      reviewedAt: decision === "CANDIDATE" ? null : new Date(),
      note: note.trim() || rs.note,
    },
  });
  await recordAudit({
    action: `research_source.${decision.toLowerCase()}`,
    actor,
    target: { type: "research_source", id: rs.id },
    metadata: { projectId: rs.projectId, url: rs.url },
  });
}

/**
 * Approval checkpoint: the reviewed source set is what any draft may use. Candidates still
 * undecided are left out. At least one accepted source with retrieved text is required.
 */
export async function approveSourceSet(db: PrismaClient, actor: Actor, projectId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new ProjectError("You cannot approve sources.");
  const project = await db.contentProject.findUnique({ where: { id: projectId } });
  assertOpen(project);
  const research = await db.productionJob.findFirst({
    where: { projectId, type: "RESEARCH" },
    orderBy: { createdAt: "desc" },
  });
  if (research?.status !== "SUCCEEDED") throw new ProjectError("Research has not finished yet.");
  const accepted = await db.researchSource.findMany({ where: { projectId, status: "ACCEPTED" } });
  const withText = accepted.filter(
    (s) => s.kind === "STRUCTURED_DATA" || Array.isArray(s.excerpts),
  );
  if (withText.length === 0) {
    throw new ProjectError(
      "Accept at least one source with retrieved text (Wikidata or an encyclopedia article).",
    );
  }
  await db.contentProject.update({
    where: { id: projectId },
    data: { sourceSetApprovedAt: new Date(), sourceSetApprovedById: actor.id },
  });
  await recordAudit({
    action: "project.source_set_approved",
    actor,
    target: { type: "project", id: projectId },
    metadata: { accepted: accepted.length },
  });
}

/** Reopen the source set. Draft jobs not yet started are cancelled: they were based on it. */
export async function reopenSourceSet(db: PrismaClient, actor: Actor, projectId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new ProjectError("You cannot change the source set.");
  const project = await db.contentProject.findUnique({ where: { id: projectId } });
  if (!project?.sourceSetApprovedAt) throw new ProjectError("The source set is not approved.");
  const running = await db.productionJob.findFirst({
    where: { projectId, type: "ARTICLE_DRAFT", status: "RUNNING" },
  });
  if (running)
    throw new ProjectError(
      "A draft is being written from this source set. Wait for it or cancel it.",
    );
  await db.$transaction([
    db.productionJob.updateMany({
      where: { projectId, type: "ARTICLE_DRAFT", status: { in: ["QUEUED", "AWAITING_APPROVAL"] } },
      data: { status: "CANCELLED", finishedAt: new Date(), error: "The source set was reopened." },
    }),
    db.contentProject.update({
      where: { id: projectId },
      data: { sourceSetApprovedAt: null, sourceSetApprovedById: null },
    }),
  ]);
  await recordAudit({
    action: "project.source_set_reopened",
    actor,
    target: { type: "project", id: projectId },
  });
}

/**
 * Ask for an AI-assisted article draft. The cost is estimated from the real prompt first; a draft
 * that costs anything waits for an administrator's approval within the budgets.
 */
export async function requestArticleDraft(db: PrismaClient, actor: Actor, projectId: string) {
  if (!hasPermission(actor.role, "research:run"))
    throw new ProjectError("You cannot request drafts.");
  const project = await db.contentProject.findUnique({ where: { id: projectId } });
  if (!project) throw new ProjectError("Project not found.");
  if (!project.sourceSetApprovedAt) throw new ProjectError("Approve the source set first.");
  if (project.articleId) {
    throw new ProjectError(
      "This project already has an article draft. Edit it in the Article Studio.",
    );
  }
  let model;
  try {
    model = getLanguageModel();
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw new ProjectError(error.message);
    throw error;
  }
  const { request } = await buildDraftRequest(db, projectId);
  const estimate = model.provider.estimateCost(request);
  try {
    const { job, queued } = await createJob(db, actor, {
      projectId,
      type: "ARTICLE_DRAFT",
      input: { model: model.provider.id, estimateBasis: estimate.basis },
      costEstimateUsd: estimate.amount,
      // A failed paid call is not retried automatically: a person decides whether to pay again.
      maxAttempts: estimate.amount > 0 ? 1 : 2,
    });
    return { job, queued, estimate };
  } catch (error) {
    if (error instanceof JobServiceError) throw new ProjectError(error.message);
    throw error;
  }
}
