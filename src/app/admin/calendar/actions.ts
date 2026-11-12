"use server";

import { refresh, updateTag } from "next/cache";

import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { tags } from "@/server/content/public";
import {
  cancelSchedule,
  runDuePublications,
  ScheduleError,
  scheduleArticle,
} from "@/server/content/schedule";
import { getDb } from "@/server/db/client";

export type CalendarState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof ScheduleError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

export async function calendarAction(
  _prev: CalendarState,
  formData: FormData,
): Promise<CalendarState> {
  const intent = String(formData.get("intent") ?? "");
  try {
    const editor = await assertPermission("article:publish");
    const db = getDb();
    if (intent === "schedule") {
      if (formData.get("confirm") !== "yes") {
        return {
          ok: false,
          message: "Confirm that you have checked the article against its sources.",
        };
      }
      // datetime-local has no zone; the form states that times are UTC.
      const raw = String(formData.get("when") ?? "");
      const when = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00Z` : "invalid");
      await scheduleArticle(db, editor, String(formData.get("articleId") ?? ""), when);
      refresh();
      return {
        ok: true,
        message: `Scheduled for ${when.toISOString().replace("T", " ").slice(0, 16)} UTC.`,
      };
    }
    if (intent === "cancel") {
      await cancelSchedule(db, editor, String(formData.get("scheduleId") ?? ""));
      refresh();
      return { ok: true, message: "Schedule cancelled." };
    }
    if (intent === "run") {
      const run = await runDuePublications(db);
      for (const { slug } of run.published) updateTag(tags.article(slug));
      if (run.published.length > 0) updateTag(tags.articles);
      refresh();
      const failed =
        run.failed.length > 0
          ? ` ${run.failed.length} failed: ${run.failed.map((f) => f.reason).join("; ")}`
          : "";
      return {
        ok: run.failed.length === 0,
        message: `Published ${run.published.length} due article(s).${failed}`,
      };
    }
    return { ok: false, message: "Unknown action." };
  } catch (error) {
    return failure(error);
  }
}
