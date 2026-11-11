"use client";

import { useActionState } from "react";

import { articleDecisionAction, type ActionState } from "@/app/admin/articles/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PublishControls({
  articleId,
  published,
  path,
  withheld,
}: {
  articleId: string;
  published: boolean;
  path: string | null;
  withheld: { title: string; reason: string }[];
}) {
  // One action for both decisions, so the message always reflects the latest one.
  const [state, decide, pending] = useActionState<ActionState, FormData>(
    articleDecisionAction,
    null,
  );

  return (
    <section aria-labelledby="publish-title" className="rounded-3xl border bg-card p-6">
      <h2 id="publish-title" className="text-2xl font-bold">
        {published ? "Published" : "Editorial approval"}
      </h2>
      <div className="mt-3">
        <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      </div>
      {published ? (
        <form action={decide} className="mt-4 space-y-4">
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="intent" value="unpublish" />
          {path && (
            <p className="text-sm">
              Live at{" "}
              <a href={path} className="font-mono text-primary underline-offset-4 hover:underline">
                {path}
              </a>
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for unpublishing</Label>
            <Input
              id="reason"
              name="reason"
              placeholder="e.g. a reader reported an incorrect date"
            />
          </div>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Unpublishing…" : "Unpublish"}
          </Button>
        </form>
      ) : (
        <form action={decide} className="mt-4 space-y-4">
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="intent" value="publish" />
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Publishing records you as the approving editor and marks the article&apos;s key dates
              as verified by you.
            </li>
            <li>
              Images that are classified, publishable and stored are approved; any others stay
              hidden.
            </li>
            {withheld.map((w) => (
              <li key={w.title} className="text-destructive">
                Will be withheld: {w.title} ({w.reason})
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              I have checked this article against its cited sources and approve it for publication.
            </span>
          </label>
          <Button type="submit" variant="lime" size="lg" disabled={pending}>
            {pending ? "Publishing…" : "Approve and publish"}
          </Button>
        </form>
      )}
    </section>
  );
}
