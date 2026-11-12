"use server";

import { refresh } from "next/cache";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { getStorage } from "@/server/storage";
import { LibraryError, uploadMusic } from "@/server/video/library";

export type MusicState = { ok: boolean; message: string } | null;

export async function uploadMusicAction(
  _prev: MusicState,
  formData: FormData,
): Promise<MusicState> {
  try {
    const actor = await assertPermission("documentary:edit");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose a WAV or MP3 file." };
    }
    await uploadMusic(getDb(), getStorage(), actor, {
      body: new Uint8Array(await file.arrayBuffer()),
      title: String(formData.get("title") ?? ""),
      licenseId: String(formData.get("licenseId") ?? ""),
      attribution: String(formData.get("attribution") ?? ""),
    });
    refresh();
    return { ok: true, message: "Track added to the music library." };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { ok: false, message: "You do not have permission to do that." };
    if (error instanceof LibraryError) return { ok: false, message: error.message };
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}
