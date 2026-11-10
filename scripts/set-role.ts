/**
 * Change a user's role from the command line (operator tooling).
 *
 *   pnpm user:role someone@example.com EDITOR
 */
import "./_env";

import { isRole, roles } from "@/lib/auth/roles";
import { getDb } from "@/server/db/client";
import { changeUserRole } from "@/server/users/roles";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role || !isRole(role)) {
    throw new Error(`Usage: pnpm user:role <email> <${roles.join("|")}>`);
  }
  const db = getDb();
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (!user) throw new Error(`No user with email ${email}.`);

  const result = await changeUserRole({ kind: "system", label: "set-role" }, user.id, role);
  console.warn(result.changed ? `${result.email}: ${result.from} → ${result.to}` : `${result.email} already has role ${role}.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
