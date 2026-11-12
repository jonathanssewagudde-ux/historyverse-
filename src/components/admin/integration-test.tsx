"use client";

import { useActionState } from "react";

import { testIntegrationAction, type TestState } from "@/app/admin/integrations/actions";
import { Button } from "@/components/ui/button";

const statusText = {
  connected: "Connected",
  connection_failed: "Connection failed",
  not_testable: "Not testable yet",
} as const;

export function IntegrationTest({ id, name }: { id: string; name: string }) {
  const [state, run, pending] = useActionState<TestState, FormData>(testIntegrationAction, null);
  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="integrationId" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Test ${name}`}
      >
        {pending ? "Testing…" : "Test connection"}
      </Button>
      <div aria-live="polite" className="text-sm">
        {state && !state.ok && <p className="text-destructive">{state.message}</p>}
        {state?.ok && (
          <p
            className={
              state.result.status === "connected"
                ? "font-semibold"
                : state.result.status === "connection_failed"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {statusText[state.result.status]}
            {state.result.latencyMs !== null && ` · ${state.result.latencyMs} ms`}
            <span className="block font-normal text-muted-foreground">{state.result.detail}</span>
          </p>
        )}
      </div>
    </form>
  );
}
