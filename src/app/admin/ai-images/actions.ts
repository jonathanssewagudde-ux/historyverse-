"use server";

import { refresh } from "next/cache";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  DiscoveryError,
  rejectCandidate,
  requestMediaSearch,
  selectCandidate,
} from "@/server/media/discovery";
import {
  ReconstructionError,
  requestGeneration,
  reviewReconstruction,
  saveReconstruction,
  sourceForResearchSource,
  suggestPrompt,
  uploadReconstruction,
} from "@/server/media/reconstructions";
import { getStorage } from "@/server/storage";

export type MediaStudioState = {
  ok: boolean;
  message: string;
  suggestion?: { prompt: string; negativePrompt: string };
} | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof DiscoveryError || error instanceof ReconstructionError)
    return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** Archival media discovery decisions (pipeline step 3). */
export async function discoveryAction(
  _prev: MediaStudioState,
  formData: FormData,
): Promise<MediaStudioState> {
  const intent = text(formData, "intent");
  const db = getDb();
  try {
    const actor = await assertPermission("media:upload");
    switch (intent) {
      case "search": {
        const { queued } = await requestMediaSearch(
          db,
          actor,
          text(formData, "projectId"),
          text(formData, "query"),
        );
        refresh();
        return {
          ok: true,
          message: queued
            ? "Archive search queued."
            : "Archive search will run when a worker is available.",
        };
      }
      case "select": {
        const result = await selectCandidate(db, actor, text(formData, "candidateId"), {
          licenseConfirmed: formData.get("licenseConfirmed") === "yes",
          note: text(formData, "note"),
        });
        refresh();
        return {
          ok: true,
          message: result.publishable
            ? "Added to the media library. Classify it there; an editor approves it."
            : `Added to the media library, but its licence (${result.license}) does not allow publication.`,
        };
      }
      case "reject": {
        await rejectCandidate(db, actor, text(formData, "candidateId"), text(formData, "note"));
        refresh();
        return { ok: true, message: "Rejected." };
      }
      default:
        return { ok: false, message: "Unknown action." };
    }
  } catch (error) {
    return failure(error);
  }
}

/** Write or update a reconstruction prompt with its evidence. */
export async function reconstructionPromptAction(
  _prev: MediaStudioState,
  formData: FormData,
): Promise<MediaStudioState> {
  const db = getDb();
  try {
    const actor = await assertPermission("media:upload");
    if (text(formData, "intent") === "suggest") {
      const suggestion = await suggestPrompt(db, text(formData, "projectId"));
      return {
        ok: true,
        message: "Starting prompt filled in: replace each [describe …] with what the sources say.",
        suggestion,
      };
    }
    // Sources are "src:<id>" (references) or "rs:<id>" (the project's accepted research sources).
    const refs = formData.getAll("source").map(String);
    const sources: { sourceId: string; note: string }[] = [];
    for (const ref of refs) {
      const [kind, id] = ref.split(":");
      if (!id) continue;
      const sourceId = kind === "rs" ? await sourceForResearchSource(db, id) : id;
      sources.push({ sourceId, note: text(formData, `note:${ref}`) });
    }
    await saveReconstruction(db, actor, {
      projectId: text(formData, "projectId") || null,
      prompt: text(formData, "prompt"),
      negativePrompt: text(formData, "negativePrompt"),
      evidenceNotes: text(formData, "evidenceNotes"),
      interpretationNotes: text(formData, "interpretationNotes"),
      sources,
    });
    refresh();
    return { ok: true, message: "Prompt saved with its evidence." };
  } catch (error) {
    return failure(error);
  }
}

/** Generate, upload or review images for a reconstruction prompt. */
export async function reconstructionAction(
  _prev: MediaStudioState,
  formData: FormData,
): Promise<MediaStudioState> {
  const intent = text(formData, "intent");
  const id = text(formData, "reconstructionId");
  const db = getDb();
  try {
    switch (intent) {
      case "generate": {
        const actor = await assertPermission("media:upload");
        const { estimate, queued } = await requestGeneration(
          db,
          actor,
          id,
          Number(text(formData, "variations") || "1"),
        );
        refresh();
        return {
          ok: true,
          message:
            estimate.amount > 0
              ? `Requested. Estimated cost $${estimate.amount.toFixed(2)}: an administrator approves it on the project page.`
              : queued
                ? "Generation queued (no charge)."
                : "Generation will run when a worker is available.",
        };
      }
      case "upload": {
        const actor = await assertPermission("media:upload");
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0)
          return { ok: false, message: "Choose an image file." };
        await uploadReconstruction(db, getStorage(), actor, id, {
          body: new Uint8Array(await file.arrayBuffer()),
          toolName: text(formData, "toolName"),
        });
        refresh();
        return {
          ok: true,
          message: "Uploaded and labelled as an AI reconstruction. An editor reviews it next.",
        };
      }
      case "approve":
      case "reject": {
        const actor = await assertPermission("media:approve");
        await reviewReconstruction(
          db,
          actor,
          id,
          intent === "approve" ? "APPROVED" : "REJECTED",
          text(formData, "altText"),
        );
        refresh();
        return {
          ok: true,
          message:
            intent === "approve" ? "Approved, with the AI reconstruction label." : "Rejected.",
        };
      }
      default:
        return { ok: false, message: "Unknown action." };
    }
  } catch (error) {
    return failure(error);
  }
}
