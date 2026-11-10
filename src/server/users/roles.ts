import "server-only";

import { canAssignRole, isRole, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { getDb } from "@/server/db/client";

export class RoleChangeError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "LAST_SUPER_ADMINISTRATOR" | "INVALID_ROLE",
    message: string,
  ) {
    super(message);
    this.name = "RoleChangeError";
  }
}

/** `system` is for trusted operator tooling (CLI); everything else must pass a real user. */
export type RoleActor =
  { kind: "user"; id: string; email: string; role: Role } | { kind: "system"; label: string };

/**
 * Change a user's role. Rules:
 *  - only a Super Administrator (or operator tooling) may assign roles;
 *  - nobody changes their own role;
 *  - the last Super Administrator can never be demoted, so the platform cannot be locked out.
 * Every change is written to the audit log.
 */
export async function changeUserRole(actor: RoleActor, targetUserId: string, newRole: Role) {
  if (!isRole(newRole))
    throw new RoleChangeError("INVALID_ROLE", `Unknown role: ${String(newRole)}`);
  if (actor.kind === "user" && !canAssignRole(actor, { id: targetUserId }, newRole)) {
    throw new RoleChangeError("FORBIDDEN", "You are not allowed to change this user's role.");
  }

  const db = getDb();
  const result = await db.$transaction(async (tx) => {
    // Lock the super-administrator rows so two concurrent demotions cannot both succeed.
    const superAdmins = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "users" WHERE "role" = 'SUPER_ADMINISTRATOR' FOR UPDATE`;
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true },
    });
    if (!target) throw new RoleChangeError("NOT_FOUND", "User not found.");
    if (target.role === newRole) return { target, previousRole: target.role, changed: false };

    const demotingLastSuperAdmin =
      target.role === "SUPER_ADMINISTRATOR" &&
      superAdmins.length === 1 &&
      superAdmins[0]!.id === target.id;
    if (demotingLastSuperAdmin) {
      throw new RoleChangeError(
        "LAST_SUPER_ADMINISTRATOR",
        "The last Super Administrator cannot be demoted. Promote another user first.",
      );
    }

    await tx.user.update({ where: { id: target.id }, data: { role: newRole } });
    return { target, previousRole: target.role, changed: true };
  });

  if (result.changed) {
    await recordAudit({
      action: "user.role_changed",
      actor: actor.kind === "user" ? actor : { id: `system:${actor.label}`, role: "SYSTEM" },
      target: { type: "user", id: result.target.id },
      metadata: { email: result.target.email, from: result.previousRole, to: newRole },
    });
  }
  return {
    userId: result.target.id,
    email: result.target.email,
    from: result.previousRole,
    to: newRole,
    changed: result.changed,
  };
}
