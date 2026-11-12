"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";

import {
  createProjectAction,
  projectAction,
  type ProjectActionState,
} from "@/app/admin/projects/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

/** Re-render the page every few seconds while a job is queued or running. */
export function AutoRefresh({
  active,
  intervalMs = 3000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);
  return null;
}

export function NewProjectForm({ canBudget }: { canBudget: boolean }) {
  const id = useId();
  const [state, act, pending] = useActionState<ProjectActionState, FormData>(
    createProjectAction,
    null,
  );
  return (
    <form onSubmit={keepValues(act)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-topic`}>Topic</Label>
        <Input
          id={`${id}-topic`}
          name="topic"
          required
          minLength={3}
          maxLength={160}
          placeholder="The Complete History of the Buganda Kingdom"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-qid`}>Wikidata id of the subject (optional)</Label>
          <Input id={`${id}-qid`} name="subjectQid" placeholder="Q473748" className="font-mono" />
          <p className="text-xs text-muted-foreground">
            Without it, research picks the best Wikidata match and shows the alternatives.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-budget`}>Budget for paid AI steps (USD)</Label>
          <Input
            id={`${id}-budget`}
            name="budgetUsd"
            type="number"
            min={0}
            max={1000}
            step="0.01"
            defaultValue="0"
            disabled={!canBudget}
          />
          <p className="text-xs text-muted-foreground">
            $0 means nothing paid can ever run. Each paid step still needs its own approval.
          </p>
        </div>
      </div>
      <Button type="submit" variant="lime" size="lg" disabled={pending}>
        {pending ? "Starting…" : "Start research"}
      </Button>
      <FormMessage kind="error">{state && !state.ok ? state.message : undefined}</FormMessage>
    </form>
  );
}

/** A single project decision as a button, with its result shown beside it. */
export function ProjectButton({
  projectId,
  intent,
  fields,
  label,
  variant = "outline",
  size = "sm",
}: {
  projectId: string;
  intent: string;
  fields?: Record<string, string>;
  label: string;
  variant?: "lime" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default" | "lg";
}) {
  const [state, act, pending] = useActionState<ProjectActionState, FormData>(projectAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {label}
      </Button>
      {state && (
        <span
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm" : "text-sm font-medium text-destructive"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}

export function SourceDecision({
  projectId,
  sourceId,
  status,
  locked,
  title,
}: {
  projectId: string;
  sourceId: string;
  status: string;
  locked: boolean;
  title: string;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<ProjectActionState, FormData>(projectAction, null);
  if (locked) return null;
  return (
    <form onSubmit={keepValues(act)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="intent" value="review_source" />
      <input type="hidden" name="sourceId" value={sourceId} />
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`} className="sr-only">
          Note on {title}
        </Label>
        <Input
          id={`${id}-note`}
          name="note"
          placeholder="note (needed to reject)"
          className="h-9 w-56 text-sm"
        />
      </div>
      {status !== "ACCEPTED" && (
        <Button
          type="submit"
          name="decision"
          value="ACCEPTED"
          size="sm"
          variant="lime"
          disabled={pending}
          aria-label={`Accept ${title}`}
        >
          Accept
        </Button>
      )}
      {status !== "REJECTED" && (
        <Button
          type="submit"
          name="decision"
          value="REJECTED"
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`Reject ${title}`}
        >
          Reject
        </Button>
      )}
      {status !== "CANDIDATE" && (
        <Button
          type="submit"
          name="decision"
          value="CANDIDATE"
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Undo decision on ${title}`}
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

export function CostApproval({
  projectId,
  jobId,
  amount,
  what = "this draft",
}: {
  projectId: string;
  jobId: string;
  amount: number;
  /** What the money is for, e.g. "these images". */
  what?: string;
}) {
  const [state, act, pending] = useActionState<ProjectActionState, FormData>(projectAction, null);
  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="intent" value="approve_cost" />
      <input type="hidden" name="jobId" value={jobId} />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirm"
          value="yes"
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        <span>
          I approve spending up to ${amount.toFixed(4)} on {what}, within this project&apos;s budget
          and the monthly ceiling.
        </span>
      </label>
      <Button type="submit" variant="lime" disabled={pending}>
        Approve spending
      </Button>
      <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}
