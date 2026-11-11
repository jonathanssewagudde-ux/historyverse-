"use server";

import { updateTag } from "next/cache";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { PublishError, publishArticle, unpublishArticle } from "@/server/content/publish";
import { tags } from "@/server/content/public";
import { getDb } from "@/server/db/client";

export type ActionState = { ok: boolean; message: string } | null;

function failure(error: unknown): ActionState {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof PublishError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

/**
 * Editorial decision on an article: `intent` is "publish" or "unpublish". One action (rather than
 * two) so the page always shows the result of the latest decision. Permission is checked here,
 * on the server, regardless of what the page showed.
 */
export async function articleDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const editor = await assertPermission("article:publish");
    const articleId = String(formData.get("articleId"));
    const db = getDb();

    if (formData.get("intent") === "unpublish") {
      const reason = String(formData.get("reason") ?? "").trim();
      if (reason.length < 5) return { ok: false, message: "Give a short reason for unpublishing." };
      const result = await unpublishArticle(db, editor, articleId, reason);
      updateTag(tags.article(result.slug));
      updateTag(tags.articles);
      return { ok: true, message: "Unpublished. The article is a draft again." };
    }

    if (formData.get("confirm") !== "yes") {
      return {
        ok: false,
        message: "Confirm that you have checked the article against its sources.",
      };
    }
    const result = await publishArticle(db, editor, articleId);
    updateTag(tags.article(result.slug));
    updateTag(tags.articles);
    const withheld =
      result.withheld.length > 0 ? ` ${result.withheld.length} image(s) were withheld.` : "";
    return { ok: true, message: `Published.${withheld}` };
  } catch (error) {
    return failure(error);
  }
}
