"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { approveJobCost, cancelJob, JobServiceError, retryJob } from "@/server/jobs/service";
import {
  approveSourceSet,
  createProject,
  ProjectError,
  reopenSourceSet,
  requestArticleDraft,
  rerunResearch,
  reviewResearchSource,
} from "@/server/research/projects";

export type ProjectActionState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof ProjectError || error instanceof JobServiceError)
    return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const queuedNote = (queued: boolean) =>
  queued ? "" : " It will run when the job queue and a worker are available.";

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  let id: string;
  try {
    const actor = await assertPermission("project:create");
    const budget = text(formData, "budgetUsd").trim();
    const { project } = await createProject(getDb(), actor, {
      topic: text(formData, "topic"),
      subjectQid: text(formData, "subjectQid"),
      budgetUsd: budget === "" ? 0 : Number(budget),
    });
    id = project.id;
  } catch (error) {
    return failure(error);
  }
  redirect(`/admin/projects/${id}` as Route);
}

/** Every decision on a project page, by `intent`. Permissions are re-checked in each service. */
export async function projectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const intent = text(formData, "intent");
  const projectId = text(formData, "projectId");
  const db = getDb();
  try {
    switch (intent) {
      case "research": {
        const actor = await assertPermission("research:run");
        const { queued } = await rerunResearch(db, actor, projectId);
        refresh();
        return { ok: true, message: `Research queued.${queuedNote(queued)}` };
      }
      case "review_source": {
        const actor = await assertPermission("research:run");
        const decision = text(formData, "decision");
        if (decision !== "ACCEPTED" && decision !== "REJECTED" && decision !== "CANDIDATE") {
          return { ok: false, message: "Unknown decision." };
        }
        await reviewResearchSource(
          db,
          actor,
          text(formData, "sourceId"),
          decision,
          text(formData, "note"),
        );
        refresh();
        return {
          ok: true,
          message:
            decision === "ACCEPTED"
              ? "Accepted."
              : decision === "REJECTED"
                ? "Rejected."
                : "Undecided.",
        };
      }
      case "approve_sources": {
        const actor = await assertPermission("research:run");
        await approveSourceSet(db, actor, projectId);
        refresh();
        return {
          ok: true,
          message: "Source set approved. Drafts may now use the accepted sources.",
        };
      }
      case "reopen_sources": {
        const actor = await assertPermission("research:run");
        await reopenSourceSet(db, actor, projectId);
        refresh();
        return { ok: true, message: "Source set reopened." };
      }
      case "request_draft": {
        const actor = await assertPermission("research:run");
        const { queued, estimate } = await requestArticleDraft(db, actor, projectId);
        refresh();
        return {
          ok: true,
          message:
            estimate.amount > 0
              ? `Draft requested. Estimated cost up to $${estimate.amount.toFixed(4)}: it waits for an administrator's approval.`
              : `Draft queued (no charge).${queuedNote(queued)}`,
        };
      }
      case "approve_cost": {
        const actor = await assertPermission("spend:approve");
        if (formData.get("confirm") !== "yes") {
          return { ok: false, message: "Confirm that you approve this spending." };
        }
        const { queued } = await approveJobCost(db, actor, text(formData, "jobId"));
        refresh();
        return {
          ok: true,
          message: `Spending approved; the draft is queued.${queuedNote(queued)}`,
        };
      }
      case "cancel_job": {
        const actor = await assertPermission("research:run");
        await cancelJob(db, actor, text(formData, "jobId"));
        refresh();
        return { ok: true, message: "Cancelled." };
      }
      case "retry_job": {
        const actor = await assertPermission("research:run");
        const { queued, needsApproval } = await retryJob(db, actor, text(formData, "jobId"));
        refresh();
        return {
          ok: true,
          message: needsApproval
            ? "Ready to run again; its cost must be approved again."
            : `Queued again.${queuedNote(queued)}`,
        };
      }
      default:
        return { ok: false, message: "Unknown action." };
    }
  } catch (error) {
    return failure(error);
  }
}
