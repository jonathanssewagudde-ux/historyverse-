"use client";

import { useActionState, useEffect, useId, useState } from "react";

import {
  discoveryAction,
  reconstructionAction,
  reconstructionPromptAction,
  type MediaStudioState,
} from "@/app/admin/ai-images/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const textareaClass =
  "w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function Message({ state }: { state: MediaStudioState }) {
  return <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>;
}

export function MediaSearchForm({
  projectId,
  defaultQuery,
}: {
  projectId: string;
  defaultQuery: string;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(discoveryAction, null);
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="search" />
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-q`}>Search the archives for</Label>
        <Input id={`${id}-q`} name="query" defaultValue={defaultQuery} className="w-64" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        Search archives
      </Button>
      <div className="w-full">
        <Message state={state} />
      </div>
    </form>
  );
}

export function CandidateDecision({ candidateId, title }: { candidateId: string; title: string }) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(discoveryAction, null);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          name="licenseConfirmed"
          value="yes"
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span>I checked the licence on the source page.</span>
      </label>
      <Label htmlFor={`${id}-note`} className="sr-only">
        Note on {title}
      </Label>
      <Input
        id={`${id}-note`}
        name="note"
        placeholder="note (needed to reject)"
        className="h-8 text-xs"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="intent"
          value="select"
          size="sm"
          variant="lime"
          disabled={pending}
          aria-label={`Add ${title} to the library`}
        >
          Add to library
        </Button>
        <Button
          type="submit"
          name="intent"
          value="reject"
          size="sm"
          variant="ghost"
          disabled={pending}
          aria-label={`Reject ${title}`}
        >
          Reject
        </Button>
      </div>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-xs" : "text-xs font-medium text-destructive"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

export interface PromptFormProject {
  id: string;
  topic: string;
  sources: { ref: string; title: string }[];
}

export function ReconstructionPromptForm({ projects }: { projects: PromptFormProject[] }) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(
    reconstructionPromptAction,
    null,
  );
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (state?.suggestion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fill the fields from the suggestion once
      setPrompt(state.suggestion.prompt);
      setNegative(state.suggestion.negativePrompt);
    }
  }, [state]);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Start a project and run its research first: prompts are written from a project&apos;s
        sources.
      </p>
    );
  }
  return (
    <form action={act} className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-project`}>Project</Label>
          <select
            id={`${id}-project`}
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" name="intent" value="suggest" variant="outline" disabled={pending}>
          Start from the subject
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-prompt`}>Prompt</Label>
        <textarea
          id={`${id}-prompt`}
          name="prompt"
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={textareaClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-neg`}>Leave out (negative prompt)</Label>
        <Input
          id={`${id}-neg`}
          name="negativePrompt"
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-ev`}>What rests on evidence</Label>
          <textarea
            id={`${id}-ev`}
            name="evidenceNotes"
            rows={4}
            className={textareaClass}
            placeholder="e.g. bark-cloth garments and the palace layout follow the cited descriptions"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-int`}>What is interpretation</Label>
          <textarea
            id={`${id}-int`}
            name="interpretationNotes"
            rows={4}
            className={textareaClass}
            placeholder="e.g. faces, colours and weather are invented"
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Sources the scene is based on (at least one, with what it supports)
        </legend>
        {project?.sources.length ? (
          project.sources.map((s) => (
            <div key={s.ref} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_20rem]">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="source"
                  value={s.ref}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span>{s.title}</span>
              </label>
              <Input
                name={`note:${s.ref}`}
                aria-label={`What ${s.title} supports`}
                placeholder="what it supports"
                className="h-9 text-sm"
              />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            This project has no accepted sources yet. Review its source set first.
          </p>
        )}
      </fieldset>
      <Button type="submit" name="intent" value="save" variant="lime" disabled={pending}>
        Save prompt
      </Button>
      <Message state={state} />
    </form>
  );
}

export function GenerateForm({
  reconstructionId,
  available,
}: {
  reconstructionId: string;
  available: boolean;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(
    reconstructionAction,
    null,
  );
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="generate" />
      <input type="hidden" name="reconstructionId" value={reconstructionId} />
      <div className="space-y-1">
        <Label htmlFor={`${id}-n`} className="text-xs">
          Images
        </Label>
        <select
          id={`${id}-n`}
          name="variations"
          defaultValue="1"
          className="h-9 rounded-xl border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !available}>
        Generate
      </Button>
      <div className="w-full">
        <Message state={state} />
      </div>
    </form>
  );
}

export function UploadReconstructionForm({ reconstructionId }: { reconstructionId: string }) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(
    reconstructionAction,
    null,
  );
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="intent" value="upload" />
      <input type="hidden" name="reconstructionId" value={reconstructionId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-f`} className="text-xs">
            Image made elsewhere
          </Label>
          <Input
            id={`${id}-f`}
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-t`} className="text-xs">
            Tool used
          </Label>
          <Input
            id={`${id}-t`}
            name="toolName"
            placeholder="e.g. a local Stable Diffusion"
            className="h-9 text-sm"
          />
        </div>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Upload as reconstruction
      </Button>
      <Message state={state} />
    </form>
  );
}

export function ReviewReconstructionForm({ reconstructionId }: { reconstructionId: string }) {
  const id = useId();
  const [state, act, pending] = useActionState<MediaStudioState, FormData>(
    reconstructionAction,
    null,
  );
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="reconstructionId" value={reconstructionId} />
      <Label htmlFor={`${id}-alt`} className="text-xs">
        Describe what the image shows (alt text)
      </Label>
      <Input id={`${id}-alt`} name="altText" className="h-9 text-sm" />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="intent"
          value="approve"
          size="sm"
          variant="lime"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="intent"
          value="reject"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}
