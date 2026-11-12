"use server";

import { updateTag } from "next/cache";

import { SourceAdminError, updateSource } from "@/server/admin/sources";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { tags } from "@/server/content/public";
import { getDb } from "@/server/db/client";

export type SourceActionState = { ok: boolean; message: string } | null;

const FIELDS = [
  "type",
  "title",
  "authors",
  "publisher",
  "publishedYear",
  "url",
  "archiveUrl",
  "isbn",
  "doi",
  "accessedAt",
  "reliabilityNote",
] as const;

export async function updateSourceAction(
  _prev: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  try {
    const actor = await assertPermission("source:manage");
    const edit = Object.fromEntries(
      FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
    ) as Record<(typeof FIELDS)[number], string>;
    const slugs = await updateSource(getDb(), actor, String(formData.get("sourceId") ?? ""), edit);
    for (const slug of slugs) updateTag(tags.article(slug));
    if (slugs.length > 0) updateTag(tags.articles);
    return {
      ok: true,
      message:
        slugs.length > 0
          ? `Saved. ${slugs.length} published article(s) now show the corrected reference.`
          : "Saved.",
    };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { ok: false, message: "You do not have permission to do that." };
    if (error instanceof SourceAdminError) return { ok: false, message: error.message };
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}
