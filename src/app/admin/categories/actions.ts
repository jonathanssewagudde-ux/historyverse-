"use server";

import { refresh } from "next/cache";

import { CategoryError, deleteCategory, saveCategory } from "@/server/admin/categories";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { getDb } from "@/server/db/client";

export type CategoryState = { ok: boolean; message: string } | null;

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError)
    return { ok: false, message: "You do not have permission to do that." };
  if (error instanceof CategoryError) return { ok: false, message: error.message };
  return { ok: false, message: "Something went wrong. Nothing was changed." };
}

export async function saveCategoryAction(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  try {
    const actor = await assertPermission("taxonomy:manage");
    const id = String(formData.get("categoryId") ?? "") || undefined;
    if (formData.get("intent") === "delete" && id) {
      await deleteCategory(getDb(), actor, id);
      refresh();
      return { ok: true, message: "Deleted." };
    }
    await saveCategory(getDb(), actor, {
      id,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      parentId: String(formData.get("parentId") ?? ""),
    });
    refresh();
    return { ok: true, message: id ? "Saved." : "Category created." };
  } catch (error) {
    return failure(error);
  }
}
