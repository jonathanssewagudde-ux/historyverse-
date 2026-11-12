"use server";

import { refresh } from "next/cache";

import { MediaAdminError, reviewMedia, updateMedia, uploadMedia } from "@/server/admin/media";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { fetchCommonsMedia } from "@/server/content/media-files";
import { getDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import { createSourceHttpClient } from "@/server/sources/http";
import { getStorage } from "@/server/storage";

export type MediaActionState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof MediaAdminError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function updateMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const actor = await assertPermission("media:upload");
    await updateMedia(getDb(), actor, text(formData, "mediaId"), {
      title: text(formData, "title"),
      kind: text(formData, "kind"),
      altText: text(formData, "altText"),
      description: text(formData, "description"),
      attribution: text(formData, "attribution"),
      licenseId: text(formData, "licenseId"),
    });
    refresh();
    return { ok: true, message: "Saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  const decision = text(formData, "decision");
  if (decision !== "APPROVED" && decision !== "REJECTED")
    return { ok: false, message: "Unknown decision." };
  try {
    const actor = await assertPermission("media:approve");
    await reviewMedia(getDb(), actor, text(formData, "mediaId"), decision);
    refresh();
    return { ok: true, message: decision === "APPROVED" ? "Approved." : "Rejected." };
  } catch (error) {
    return failure(error);
  }
}

export async function uploadMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    const actor = await assertPermission("media:upload");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, message: "Choose an image file." };
    await uploadMedia(getDb(), getStorage(), actor, {
      body: new Uint8Array(await file.arrayBuffer()),
      title: text(formData, "title"),
      kind: text(formData, "kind"),
      licenseId: text(formData, "licenseId"),
      attribution: text(formData, "attribution"),
      altText: text(formData, "altText"),
      sourceName: text(formData, "sourceName"),
      sourceUrl: text(formData, "sourceUrl"),
    });
    refresh();
    return { ok: true, message: "Uploaded. It waits for classification and editor approval." };
  } catch (error) {
    return failure(error);
  }
}

/** Download an imported Wikimedia Commons file into storage. */
export async function fetchMediaAction(
  _prev: MediaActionState,
  formData: FormData,
): Promise<MediaActionState> {
  try {
    await assertPermission("media:upload");
    const userAgent = getServerEnv().env.WIKIMEDIA_USER_AGENT;
    if (!userAgent)
      return { ok: false, message: "WIKIMEDIA_USER_AGENT is not configured on the server." };
    const http = createSourceHttpClient({
      userAgent,
      minIntervalMs: 1500,
      maxRetries: 2,
      maxBackoffMs: 20_000,
    });
    const [result] = await fetchCommonsMedia({ db: getDb(), storage: getStorage(), http }, [
      text(formData, "mediaId"),
    ]);
    refresh();
    if (!result || result.status === "failed" || result.status === "skipped")
      return { ok: false, message: `Not downloaded: ${result?.detail ?? "unknown error"}` };
    return { ok: true, message: result.status === "stored" ? "Downloaded." : "Already stored." };
  } catch (error) {
    return failure(error);
  }
}
