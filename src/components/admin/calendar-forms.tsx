"use client";

import { useActionState, useId } from "react";

import { calendarAction, type CalendarState } from "@/app/admin/calendar/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScheduleForm({ articles }: { articles: { id: string; title: string }[] }) {
  const id = useId();
  const [state, act, pending] = useActionState<CalendarState, FormData>(calendarAction, null);
  if (articles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No article is waiting for editorial approval. Articles can be scheduled once their research
        has been approved.
      </p>
    );
  }
  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="intent" value="schedule" />
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-a`}>Article</Label>
          <select
            id={`${id}-a`}
            name="articleId"
            className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-w`}>Publish at (UTC)</Label>
          <Input id={`${id}-w`} name="when" type="datetime-local" required />
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirm"
          value="yes"
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        <span>
          I have checked this article against its cited sources and approve it for publication at
          this time.
        </span>
      </label>
      <Button type="submit" variant="lime" disabled={pending}>
        Schedule publication
      </Button>
      <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}

export function CalendarButton({
  intent,
  scheduleId,
  children,
}: {
  intent: "cancel" | "run";
  scheduleId?: string;
  children: React.ReactNode;
}) {
  const [state, act, pending] = useActionState<CalendarState, FormData>(calendarAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="intent" value={intent} />
      {scheduleId && <input type="hidden" name="scheduleId" value={scheduleId} />}
      <Button
        type="submit"
        size="sm"
        variant={intent === "run" ? "lime" : "ghost"}
        disabled={pending}
      >
        {children}
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
