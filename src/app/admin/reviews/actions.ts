"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";

import { resolveCorrection, ReviewAdminError, submitCorrection } from "@/server/admin/reviews";
import { assertPermission, ForbiddenError, getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { clientKey, createRateLimiter } from "@/server/rate-limit";

export type CorrectionState = { ok: boolean; message: string } | null;

const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof ReviewAdminError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was sent." };
}

/** Readers report a possible error in a published article. */
export async function submitCorrectionAction(
  _prev: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to report an error." };
  const key = `${user.id}:${clientKey(await headers())}`;
  if (!limiter.check(key).allowed)
    return { ok: false, message: "Too many reports in a short time. Please try again later." };
  try {
    await submitCorrection(getDb(), user, {
      articleId: String(formData.get("articleId") ?? ""),
      message: String(formData.get("message") ?? ""),
      evidenceUrl: String(formData.get("evidenceUrl") ?? ""),
    });
    return { ok: true, message: "Thank you. An editor will review your report." };
  } catch (error) {
    return failure(error);
  }
}

export async function resolveCorrectionAction(
  _prev: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  const status = String(formData.get("status") ?? "");
  if (status !== "ACCEPTED" && status !== "DECLINED" && status !== "DUPLICATE")
    return { ok: false, message: "Unknown decision." };
  try {
    const actor = await assertPermission("correction:resolve");
    await resolveCorrection(
      getDb(),
      actor,
      String(formData.get("correctionId") ?? ""),
      status,
      String(formData.get("resolution") ?? ""),
    );
    refresh();
    return { ok: true, message: "Resolved." };
  } catch (error) {
    return failure(error);
  }
}
