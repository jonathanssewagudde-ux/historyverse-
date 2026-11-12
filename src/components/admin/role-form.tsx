"use client";

import { useActionState, useId } from "react";

import { changeRoleAction, type RoleState } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import { roleLabels, roles, type Role } from "@/lib/auth/roles";

export function RoleForm({ userId, name, role }: { userId: string; name: string; role: Role }) {
  const id = useId();
  const [state, act, pending] = useActionState<RoleState, FormData>(changeRoleAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label htmlFor={`${id}-role`} className="sr-only">
        Role for {name}
      </label>
      <select
        id={`${id}-role`}
        name="role"
        defaultValue={role}
        className="h-9 rounded-xl border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabels[r]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Change
      </Button>
      {state && (
        <span
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm" : "text-sm text-destructive"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
