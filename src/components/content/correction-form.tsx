"use client";

import { useActionState, useId } from "react";

import { submitCorrectionAction, type CorrectionState } from "@/app/admin/reviews/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

/** "Report an error" for readers. Signing in is checked when the report is sent. */
export function CorrectionForm({ articleId }: { articleId: string }) {
  const id = useId();
  const [state, send, pending] = useActionState<CorrectionState, FormData>(
    submitCorrectionAction,
    null,
  );
  if (state?.ok) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-lime px-4 py-3 text-sm font-semibold text-lime-foreground"
      >
        {state.message}
      </p>
    );
  }
  return (
    <details className="rounded-3xl border p-5">
      <summary className="cursor-pointer font-semibold">Spotted an error? Report it</summary>
      <form onSubmit={keepValues(send)} className="mt-4 space-y-3">
        <input type="hidden" name="articleId" value={articleId} />
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-m`}>What is wrong?</Label>
          <textarea
            id={`${id}-m`}
            name="message"
            rows={4}
            maxLength={2000}
            required
            className="w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-e`}>A source that shows it (optional)</Label>
          <Input id={`${id}-e`} name="evidenceUrl" type="url" placeholder="https://" />
        </div>
        <p className="text-xs text-muted-foreground">
          You need to be signed in. Editors read every report; accepted corrections are made by
          editing the article and its sources.
        </p>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
        <FormMessage kind="error">{state?.message}</FormMessage>
      </form>
    </details>
  );
}
