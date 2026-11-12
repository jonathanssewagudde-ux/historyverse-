"use client";

import { useActionState, useId } from "react";

import {
  claimDecisionAction,
  entitySummaryAction,
  importEntityAction,
  type EntityActionState,
} from "@/app/admin/entities/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImportEntityForm({ defaultKind }: { defaultKind: string }) {
  const [state, act, pending] = useActionState<EntityActionState, FormData>(
    importEntityAction,
    null,
  );
  const id = useId();
  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="kind" value={defaultKind} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-qid`}>Wikidata id</Label>
          <Input
            id={`${id}-qid`}
            name="qid"
            placeholder="Q1036"
            className="w-40 font-mono"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Importing…" : "Import from Wikidata"}
        </Button>
      </div>
      <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}

export function ClaimDecision({
  claimId,
  verification,
  canVerify,
}: {
  claimId: string;
  verification: string;
  canVerify: boolean;
}) {
  const [state, act, pending] = useActionState<EntityActionState, FormData>(
    claimDecisionAction,
    null,
  );
  if (!canVerify) return null;
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="claimId" value={claimId} />
      {verification !== "VERIFIED" && (
        <Button
          type="submit"
          name="decision"
          value="VERIFIED"
          size="sm"
          variant="lime"
          disabled={pending}
        >
          Verify
        </Button>
      )}
      {verification !== "REJECTED" && (
        <Button
          type="submit"
          name="decision"
          value="REJECTED"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Reject
        </Button>
      )}
      {verification !== "UNVERIFIED" && (
        <Button
          type="submit"
          name="decision"
          value="UNVERIFIED"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Undo
        </Button>
      )}
      {state && !state.ok && (
        <span role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function SummaryForm({ entityId, summary }: { entityId: string; summary: string | null }) {
  const [state, act, pending] = useActionState<EntityActionState, FormData>(
    entitySummaryAction,
    null,
  );
  const id = useId();
  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="entityId" value={entityId} />
      <Label htmlFor={`${id}-summary`}>Summary (neutral, one or two sentences)</Label>
      <textarea
        id={`${id}-summary`}
        name="summary"
        rows={3}
        maxLength={600}
        defaultValue={summary ?? ""}
        className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Save summary
        </Button>
        <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      </div>
    </form>
  );
}
