/**
 * Create (or promote) the first Super Administrator.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-passphrase' ADMIN_NAME='Your Name' pnpm admin:create
 *
 * The password is read from the environment so it never appears in shell history arguments or
 * in the repository. If the account already exists it is only promoted; its password is untouched.
 */
import "./_env";

import { getAuth, PASSWORD_MIN_LENGTH } from "@/server/auth/auth";
import { getDb } from "@/server/db/client";
import { changeUserRole } from "@/server/users/roles";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  if (!email) throw new Error("ADMIN_EMAIL is required.");

  const db = getDb();
  let user = await db.user.findUnique({ where: { email }, select: { id: true } });

  if (!user) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`ADMIN_PASSWORD is required and must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
    const created = await getAuth().api.signUpEmail({ body: { email, password, name } });
    user = { id: created.user.id };
    console.warn(`Created account ${email}.`);
  } else {
    console.warn(`Account ${email} already exists; password left unchanged.`);
  }

  const result = await changeUserRole({ kind: "system", label: "create-admin" }, user.id, "SUPER_ADMINISTRATOR");
  console.warn(result.changed ? `${email} is now a Super Administrator.` : `${email} was already a Super Administrator.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
