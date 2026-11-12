"use server";

import type { Route } from "next";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  addScene,
  approveScript,
  createDocumentary,
  deleteScene,
  DocumentaryError,
  moveScene,
  rebuildScript,
  returnScriptToDraft,
  reviseScript,
  setLexicon,
  submitScript,
  updateScene,
} from "@/server/documentary/documentaries";
import { requestNarration, uploadNarration } from "@/server/documentary/narration";
import { getStorage } from "@/server/storage";

export type DocumentaryState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof DocumentaryError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function createDocumentaryAction(
  _prev: DocumentaryState,
  formData: FormData,
): Promise<DocumentaryState> {
  let id: string;
  try {
    const actor = await assertPermission("documentary:edit");
    id = await createDocumentary(getDb(), actor, {
      articleId: text(formData, "articleId"),
      projectId: text(formData, "projectId") || null,
    });
  } catch (error) {
    return failure(error);
  }
  redirect(`/admin/documentaries/${id}` as Route);
}

/** Every decision on a documentary page, by `intent`. */
export async function documentaryAction(
  _prev: DocumentaryState,
  formData: FormData,
): Promise<DocumentaryState> {
  const intent = text(formData, "intent");
  const db = getDb();
  try {
    if (intent === "approve" || intent === "return") {
      const actor = await assertPermission("article:review");
      if (intent === "approve") await approveScript(db, actor, text(formData, "scriptId"));
      else await returnScriptToDraft(db, actor, text(formData, "scriptId"), text(formData, "note"));
      refresh();
      return {
        ok: true,
        message: intent === "approve" ? "Script approved." : "Sent back to draft.",
      };
    }
    const actor = await assertPermission("documentary:edit");
    switch (intent) {
      case "save_scene":
        await updateScene(db, actor, text(formData, "sceneId"), {
          narration: text(formData, "narration"),
          visualDescription: text(formData, "visualDescription"),
          onScreenText: text(formData, "onScreenText"),
          durationSeconds: Number(text(formData, "durationSeconds")),
          mediaIds: formData.getAll("mediaId").map(String),
          citationIds: formData.getAll("citationId").map(String),
        });
        break;
      case "move_up":
      case "move_down":
        await moveScene(db, actor, text(formData, "sceneId"), intent === "move_up" ? -1 : 1);
        break;
      case "delete_scene":
        await deleteScene(db, actor, text(formData, "sceneId"));
        break;
      case "add_scene":
        await addScene(db, actor, text(formData, "scriptId"));
        break;
      case "submit":
        await submitScript(db, actor, text(formData, "scriptId"));
        break;
      case "revise":
        await reviseScript(db, actor, text(formData, "scriptId"));
        break;
      case "rebuild":
        await rebuildScript(db, actor, text(formData, "documentaryId"));
        break;
      case "lexicon":
        await setLexicon(db, actor, text(formData, "documentaryId"), text(formData, "lexicon"));
        break;
      case "narrate": {
        const { estimate, queued } = await requestNarration(
          db,
          actor,
          text(formData, "scriptId"),
          Number(text(formData, "speed") || "1"),
        );
        refresh();
        return {
          ok: true,
          message:
            estimate.amount > 0
              ? `Narration requested. Estimated cost $${estimate.amount.toFixed(4)}: an administrator approves it on the project page.`
              : queued
                ? "Narration queued (no charge)."
                : "Narration will run when a worker is available.",
        };
      }
      case "upload_take": {
        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0)
          return { ok: false, message: "Choose a WAV or MP3 file." };
        await uploadNarration(db, getStorage(), actor, text(formData, "sceneId"), {
          body: new Uint8Array(await file.arrayBuffer()),
          speaker: text(formData, "speaker"),
          consentConfirmed: formData.get("consent") === "yes",
        });
        break;
      }
      default:
        return { ok: false, message: "Unknown action." };
    }
    refresh();
    return { ok: true, message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}
