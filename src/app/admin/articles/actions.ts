"use server";

import { refresh, updateTag } from "next/cache";

import { slugify } from "@/server/sources/wikidata/mapper";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { uncitedSections } from "@/server/content/article-file";
import { ArticleLoadError, loadArticle } from "@/server/content/load-article";
import { PublishError, publishArticle, unpublishArticle } from "@/server/content/publish";
import { tags } from "@/server/content/public";
import { approveResearch, requestChanges, submitForReview } from "@/server/content/workflow";
import { getDb } from "@/server/db/client";

export type ActionState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof PublishError || error instanceof ArticleLoadError)
    return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

/**
 * Every editorial decision on an article, by `intent`:
 * submit | approve | request_changes | publish | unpublish.
 * Permissions are checked here, on the server, whatever the page showed.
 */
export async function articleDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const intent = String(formData.get("intent") ?? "");
  const articleId = String(formData.get("articleId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const db = getDb();
  try {
    switch (intent) {
      case "submit": {
        const actor = await assertPermission("review:request");
        await submitForReview(db, actor, articleId, note);
        refresh();
        return { ok: true, message: "Submitted for research review." };
      }
      case "approve": {
        const actor = await assertPermission("article:review");
        await approveResearch(db, actor, articleId, note);
        refresh();
        return {
          ok: true,
          message: "Research approved. The article is ready for editorial approval.",
        };
      }
      case "request_changes": {
        const actor = await assertPermission("article:review");
        await requestChanges(db, actor, articleId, note);
        refresh();
        return { ok: true, message: "Changes requested. The article is a draft again." };
      }
      case "publish": {
        const editor = await assertPermission("article:publish");
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
      }
      case "unpublish": {
        const editor = await assertPermission("article:publish");
        if (note.length < 5) return { ok: false, message: "Give a short reason for unpublishing." };
        const result = await unpublishArticle(db, editor, articleId, note);
        updateTag(tags.article(result.slug));
        updateTag(tags.articles);
        return { ok: true, message: "Unpublished. The article is a draft again." };
      }
      default:
        return { ok: false, message: "Unknown action." };
    }
  } catch (error) {
    return failure(error);
  }
}

export type SaveState =
  | { ok: true; message: string; articleId: string; version: number; warnings: string[] }
  | { ok: false; message: string; issues: string[] }
  | null;

/** Save a draft from the Studio editor (lenient validation; publication stays strict). */
export async function saveArticleDraftAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  try {
    const actor = await assertPermission("article:draft");
    const articleId = String(formData.get("articleId") ?? "") || undefined;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "The editor sent malformed data.", issues: [] };
    }
    if (!payload.slug && typeof payload.title === "string")
      payload.slug = slugify(payload.title, "article");

    const report = await loadArticle(getDb(), payload, actor, { mode: "lenient", articleId, createOnly: !articleId });
    const sections = (payload.sections ?? []) as { kind: string; heading?: string; body: string }[];
    const uncited = uncitedSections({ sections: sections as never }).map(
      (i) =>
        `“${sections[i]?.heading || (sections[i]?.kind === "INTRODUCTION" ? "Introduction" : `Section ${i + 1}`)}” has no citations yet; it cannot be published like this.`,
    );
    return {
      ok: true,
      message: `Saved as version ${report.version}.`,
      articleId: report.articleId,
      version: report.version,
      warnings: [...uncited, ...report.warnings],
    };
  } catch (error) {
    if (error instanceof ArticleLoadError) {
      const [first, ...rest] = error.message.split("\n");
      const invalid = first?.startsWith("Invalid article file");
      return {
        ok: false,
        message: invalid ? "This draft cannot be saved yet." : (first ?? error.message),
        issues: rest.map((r) => friendlyIssue(r.trim())).filter(Boolean),
      };
    }
    return { ...failure(error), issues: [] };
  }
}

const fieldNames: Record<string, string> = {
  slug: "Address",
  title: "Title",
  summary: "Summary",
  primaryEntity: "Subject",
  sources: "Source",
  sections: "Section",
  keyDates: "Key date",
  entities: "Linked entity",
  media: "Image",
};

/** "sections.2.body: section has no citations" → "Section 3 (body): section has no citations". */
function friendlyIssue(issue: string): string {
  const match = /^([\w.]+|\(file\)): (.*)$/.exec(issue);
  if (!match) return issue;
  const [, path, message] = match;
  const [field, index, ...rest] = path!.split(".");
  const name = fieldNames[field!] ?? field;
  const position =
    index && /^\d+$/.test(index) ? ` ${Number(index) + 1}` : index ? ` ${index}` : "";
  const detail = rest.filter((p) => !/^\d+$/.test(p)).join(" ");
  return `${name}${position}${detail ? ` (${detail})` : ""}: ${message}`;
}
