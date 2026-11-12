import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPermission, roleLabels, type Role } from "@/lib/auth/roles";

export function AccessDenied({ role }: { role: Role }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 rounded-3xl border bg-card p-8">
      <span className="grid size-14 -rotate-6 place-items-center rounded-2xl bg-destructive/15 text-destructive">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      {hasPermission(role, "studio:access") ? (
        <>
          <h1 className="text-3xl font-extrabold">You don&apos;t have access to this page</h1>
          <p className="text-muted-foreground">
            Your <strong className="text-foreground">{roleLabels[role]}</strong> account cannot use
            this part of the Studio. If you need it, ask a Super Administrator to update your role.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">You don&apos;t have access to the Studio</h1>
          <p className="text-muted-foreground">
            Your account is a <strong className="text-foreground">{roleLabels[role]}</strong>{" "}
            account. The AI Studio is for researchers, editors and administrators. If you should
            have access, ask a Super Administrator to update your role.
          </p>
        </>
      )}
      <Button asChild variant="outline">
        <Link href="/">Back to HISTORYVERSE</Link>
      </Button>
    </div>
  );
}
