"use client";

import type { Route } from "next";
import Link from "next/link";
import { useActionState } from "react";

import { articleDecisionAction, type ActionState } from "@/app/admin/articles/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WorkflowStatus =
  "DRAFT" | "RESEARCH_REVIEW" | "EDITORIAL_APPROVAL" | "PUBLISHED" | "UPDATED" | "ARCHIVED";

const titles: Record<WorkflowStatus, string> = {
  DRAFT: "Draft",
  RESEARCH_REVIEW: "Research review",
  EDITORIAL_APPROVAL: "Editorial approval",
  PUBLISHED: "Published",
  UPDATED: "Published",
  ARCHIVED: "Archived",
};

const steps = ["DRAFT", "RESEARCH_REVIEW", "EDITORIAL_APPROVAL", "PUBLISHED"] as const;

/**
 * The editorial workflow for one article: draft → research review → editorial approval →
 * published. Buttons are shown by permission, but every decision is re-checked on the server.
 */
export function PublishControls({
  articleId,
  status,
  path,
  withheld,
  uncited,
  can,
  lastNote,
}: {
  articleId: string;
  status: WorkflowStatus;
  path: string | null;
  withheld: { title: string; reason: string }[];
  /** Headings of sections that cite nothing (publication refuses them). */
  uncited: string[];
  can: { edit: boolean; submit: boolean; review: boolean; publish: boolean };
  /** The latest reviewer note, e.g. why changes were requested. */
  lastNote: { decision: string; note: string; by: string } | null;
}) {
  // One action for every decision, so the message always reflects the latest one.
  const [state, decide, pending] = useActionState<ActionState, FormData>(
    articleDecisionAction,
    null,
  );
  const published = status === "PUBLISHED" || status === "UPDATED";
  const current = published ? 3 : steps.indexOf(status as (typeof steps)[number]);

  const hidden = (intent: string) => (
    <>
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="intent" value={intent} />
    </>
  );

  return (
    <section aria-labelledby="workflow-title" className="rounded-3xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="workflow-title" className="text-2xl font-bold">
          {titles[status]}
        </h2>
        {can.edit && status === "DRAFT" && (
          <Button asChild variant="outline">
            <Link href={`/admin/articles/${articleId}/edit` as Route}>Edit draft</Link>
          </Button>
        )}
      </div>

      <ol aria-label="Workflow" className="mt-4 flex flex-wrap gap-2 font-mono text-xs">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className={
              i === current
                ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                : i < current
                  ? "rounded-full border border-primary px-3 py-1 text-primary"
                  : "rounded-full border px-3 py-1 text-muted-foreground"
            }
          >
            {i + 1}. {titles[s].toLowerCase()}
          </li>
        ))}
      </ol>

      {lastNote && !published && (
        <blockquote className="mt-4 rounded-2xl border-l-4 border-pink bg-muted/50 p-3 text-sm">
          <p className="font-semibold">
            {lastNote.decision} · {lastNote.by}
          </p>
          <p className="mt-1">{lastNote.note}</p>
        </blockquote>
      )}

      <div className="mt-3">
        <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      </div>

      {uncited.length > 0 && !published && (
        <p className="mt-3 rounded-2xl border border-dashed border-destructive/60 p-3 text-sm">
          Cannot be published until these sections cite a source: {uncited.join(", ")}.
        </p>
      )}

      {status === "DRAFT" &&
        (can.submit ? (
          <form action={decide} className="mt-4 space-y-3">
            {hidden("submit")}
            <div className="space-y-2">
              <Label htmlFor="submit-note">Note for the reviewer (optional)</Label>
              <Input id="submit-note" name="note" placeholder="what changed, what to check" />
            </div>
            <Button type="submit" variant="lime" disabled={pending}>
              {pending ? "Submitting…" : "Submit for research review"}
            </Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Researchers submit drafts for review.
          </p>
        ))}

      {(status === "RESEARCH_REVIEW" || status === "EDITORIAL_APPROVAL") && !can.review && (
        <p className="mt-4 text-sm text-muted-foreground">
          Waiting for an editor to review this article.
        </p>
      )}

      {status === "RESEARCH_REVIEW" && can.review && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form action={decide} className="space-y-3 rounded-2xl border p-4">
            {hidden("approve")}
            <p className="text-sm">
              Approve the research: the sources are appropriate and the text says what they say.
            </p>
            <div className="space-y-2">
              <Label htmlFor="approve-note">Note (optional)</Label>
              <Input id="approve-note" name="note" />
            </div>
            <Button type="submit" variant="lime" disabled={pending}>
              Approve research
            </Button>
          </form>
          <RequestChanges decide={decide} pending={pending} hidden={hidden("request_changes")} />
        </div>
      )}

      {status === "EDITORIAL_APPROVAL" && can.review && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {can.publish ? (
            <form action={decide} className="space-y-4 rounded-2xl border p-4">
              {hidden("publish")}
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Publishing records you as the approving editor and marks the article&apos;s key
                  dates as verified by you.
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
                  I have checked this article against its cited sources and approve it for
                  publication.
                </span>
              </label>
              <Button type="submit" variant="lime" size="lg" disabled={pending}>
                {pending ? "Publishing…" : "Approve and publish"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Only editors can publish.</p>
          )}
          <RequestChanges decide={decide} pending={pending} hidden={hidden("request_changes")} />
        </div>
      )}

      {published && (
        <div className="mt-4 space-y-4">
          {path && (
            <p className="text-sm">
              Live at{" "}
              <a href={path} className="font-mono text-primary underline-offset-4 hover:underline">
                {path}
              </a>
            </p>
          )}
          {can.publish && (
            <form action={decide} className="space-y-4">
              {hidden("unpublish")}
              <div className="space-y-2">
                <Label htmlFor="unpublish-note">Reason for unpublishing</Label>
                <Input
                  id="unpublish-note"
                  name="note"
                  placeholder="e.g. a reader reported an incorrect date"
                />
              </div>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Unpublishing…" : "Unpublish"}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function RequestChanges({
  decide,
  pending,
  hidden,
}: {
  decide: (formData: FormData) => void;
  pending: boolean;
  hidden: React.ReactNode;
}) {
  return (
    <form action={decide} className="space-y-3 rounded-2xl border p-4">
      {hidden}
      <div className="space-y-2">
        <Label htmlFor="changes-note">What needs to change</Label>
        <Input
          id="changes-note"
          name="note"
          placeholder="e.g. the 1894 date needs a second source"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Request changes
      </Button>
    </form>
  );
}
