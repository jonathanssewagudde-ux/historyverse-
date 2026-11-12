"use client";

import { useActionState, useId } from "react";

import {
  createDocumentaryAction,
  documentaryAction,
  type DocumentaryState,
} from "@/app/admin/documentaries/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

const textareaClass =
  "w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function Status({ state }: { state: DocumentaryState }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-sm" : "text-sm font-medium text-destructive"}
    >
      {state.message}
    </p>
  );
}

export function NewDocumentaryForm({
  articles,
}: {
  articles: { id: string; title: string; status: string }[];
}) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(
    createDocumentaryAction,
    null,
  );
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor={`${id}-a`}>Article</Label>
        <select id={`${id}-a`} name="articleId" className={selectClass}>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({a.status.toLowerCase().replace(/_/g, " ")})
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="lime" disabled={pending || articles.length === 0}>
        Build a script from the article
      </Button>
      <div className="w-full">
        <FormMessage kind="error">{state && !state.ok ? state.message : undefined}</FormMessage>
      </div>
    </form>
  );
}

/** One documentary decision as a button. */
export function DocButton({
  intent,
  fields,
  label,
  variant = "outline",
  ariaLabel,
}: {
  intent: string;
  fields: Record<string, string>;
  label: string;
  variant?: "lime" | "outline" | "ghost" | "destructive";
  ariaLabel?: string;
}) {
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <form action={act} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={pending} aria-label={ariaLabel}>
        {label}
      </Button>
      {state && !state.ok && <Status state={state} />}
    </form>
  );
}

export function ReturnScriptForm({ scriptId }: { scriptId: string }) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <form onSubmit={keepValues(act)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="return" />
      <input type="hidden" name="scriptId" value={scriptId} />
      <div className="space-y-1">
        <Label htmlFor={`${id}-n`} className="text-xs">
          What needs to change
        </Label>
        <Input id={`${id}-n`} name="note" className="h-9 w-72 text-sm" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Send back
      </Button>
      <Status state={state} />
    </form>
  );
}

export function LexiconForm({
  documentaryId,
  lexicon,
}: {
  documentaryId: string;
  lexicon: string;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <form onSubmit={keepValues(act)} className="space-y-2">
      <input type="hidden" name="intent" value="lexicon" />
      <input type="hidden" name="documentaryId" value={documentaryId} />
      <Label htmlFor={`${id}-l`}>Pronunciation guide (one per line: word = how to say it)</Label>
      <textarea
        id={`${id}-l`}
        name="lexicon"
        rows={4}
        defaultValue={lexicon}
        className={`${textareaClass} font-mono`}
        placeholder="Kabaka = kah-BAH-kah"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save guide
      </Button>
      <Status state={state} />
    </form>
  );
}

export function NarrateForm({ scriptId, enabled }: { scriptId: string; enabled: boolean }) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="intent" value="narrate" />
      <input type="hidden" name="scriptId" value={scriptId} />
      <div className="space-y-1">
        <Label htmlFor={`${id}-s`} className="text-xs">
          Speed
        </Label>
        <select
          id={`${id}-s`}
          name="speed"
          defaultValue="1"
          className="h-9 rounded-xl border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {["0.9", "1", "1.1"].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="lime" disabled={pending || !enabled}>
        Narrate every scene
      </Button>
      <div className="w-full">
        <Status state={state} />
      </div>
    </form>
  );
}

export interface SceneFormData {
  id: string;
  position: number;
  beatLabel: string;
  narration: string;
  visualDescription: string;
  onScreenText: string;
  durationSeconds: number;
  mediaIds: string[];
  citationIds: string[];
}

export function SceneForm({
  scene,
  media,
  citations,
}: {
  scene: SceneFormData;
  media: { id: string; title: string; kind: string }[];
  citations: { id: string; label: string }[];
}) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  const n = scene.position + 1;
  return (
    <form onSubmit={keepValues(act)} className="space-y-3">
      <input type="hidden" name="intent" value="save_scene" />
      <input type="hidden" name="sceneId" value={scene.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-nar`}>Narration (scene {n})</Label>
        <textarea
          id={`${id}-nar`}
          name="narration"
          rows={4}
          defaultValue={scene.narration}
          className={textareaClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-vis`}>Visual description</Label>
          <Input id={`${id}-vis`} name="visualDescription" defaultValue={scene.visualDescription} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-ost`}>On-screen text</Label>
          <Input id={`${id}-ost`} name="onScreenText" defaultValue={scene.onScreenText} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-dur`}>Seconds</Label>
          <Input
            id={`${id}-dur`}
            name="durationSeconds"
            type="number"
            min={1}
            max={600}
            step="0.1"
            defaultValue={scene.durationSeconds}
          />
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Images (approved and publishable)</legend>
        {media.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No approved images yet: approve some in the media library or the AI Image Studio.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {media.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs has-[:checked]:border-primary"
              >
                <input
                  type="checkbox"
                  name="mediaId"
                  value={m.id}
                  defaultChecked={scene.mediaIds.includes(m.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                {m.title}
                {m.kind === "AI_RECONSTRUCTION" && " (AI reconstruction)"}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Citations ({scene.citationIds.length})
        </summary>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {citations.map((c) => (
            <label key={c.id} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="citationId"
                value={c.id}
                defaultChecked={scene.citationIds.includes(c.id)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              {c.label}
            </label>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save scene {n}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function UploadTakeForm({ sceneId, position }: { sceneId: string; position: number }) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <details>
      <summary className="cursor-pointer text-xs">
        Upload a recorded take for scene {position + 1}
      </summary>
      <form onSubmit={keepValues(act)} className="mt-2 space-y-2">
        <input type="hidden" name="intent" value="upload_take" />
        <input type="hidden" name="sceneId" value={sceneId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-f`} className="text-xs">
              Recording (WAV or MP3)
            </Label>
            <Input
              id={`${id}-f`}
              name="file"
              type="file"
              accept="audio/wav,audio/x-wav,audio/mpeg"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-sp`} className="text-xs">
              Speaker
            </Label>
            <Input id={`${id}-sp`} name="speaker" className="h-9 text-sm" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            name="consent"
            value="yes"
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          The speaker agreed to their voice being published in this documentary.
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Upload take
        </Button>
        <Status state={state} />
      </form>
    </details>
  );
}
