"use client";

import { useActionState, useId } from "react";

import { resolveCorrectionAction, type CorrectionState } from "@/app/admin/reviews/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CorrectionResolve({ correctionId }: { correctionId: string }) {
  const id = useId();
  const [state, act, pending] = useActionState<CorrectionState, FormData>(
    resolveCorrectionAction,
    null,
  );
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="correctionId" value={correctionId} />
      <Label htmlFor={`${id}-r`}>Decision note</Label>
      <Input id={`${id}-r`} name="resolution" placeholder="what was checked and decided" />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="status"
          value="ACCEPTED"
          size="sm"
          variant="lime"
          disabled={pending}
        >
          Accept
        </Button>
        <Button
          type="submit"
          name="status"
          value="DECLINED"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Decline
        </Button>
        <Button
          type="submit"
          name="status"
          value="DUPLICATE"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Duplicate
        </Button>
      </div>
      <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}
