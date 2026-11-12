"use server";

import { refresh } from "next/cache";

import { isRole } from "@/lib/auth/roles";
import { assertPermission, ForbiddenError } from "@/server/auth/session";
import { changeUserRole, RoleChangeError } from "@/server/users/roles";

export type RoleState = { ok: boolean; message: string } | null;

export async function changeRoleAction(_prev: RoleState, formData: FormData): Promise<RoleState> {
  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) return { ok: false, message: "Unknown role." };
  try {
    const actor = await assertPermission("role:assign");
    const result = await changeUserRole(
      { kind: "user", id: actor.id, email: actor.email, role: actor.role },
      String(formData.get("userId") ?? ""),
      role,
    );
    refresh();
    return { ok: true, message: result.changed ? "Role changed." : "No change." };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return { ok: false, message: "Only Super Administrators assign roles." };
    if (error instanceof RoleChangeError) return { ok: false, message: error.message };
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}
