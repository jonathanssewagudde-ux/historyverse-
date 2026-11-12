"use client";

import { useActionState, useId, useState } from "react";

import { documentaryAction, type DocumentaryState } from "@/app/admin/documentaries/actions";
import { uploadMusicAction, type MusicState } from "@/app/admin/video-editor/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function Status({ state }: { state: DocumentaryState | MusicState }) {
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

export function RenderForm({
  documentaryId,
  formats,
  music,
  enabled,
}: {
  documentaryId: string;
  formats: { value: string; label: string; burnCaptions: boolean }[];
  music: { id: string; title: string; license: string }[];
  enabled: boolean;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  const [format, setFormat] = useState(formats[0]?.value ?? "");
  const [burn, setBurn] = useState(formats[0]?.burnCaptions ?? false);
  return (
    <form onSubmit={keepValues(act)} className="space-y-3">
      <input type="hidden" name="intent" value="render" />
      <input type="hidden" name="documentaryId" value={documentaryId} />
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Format</legend>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <label
              key={f.value}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="format"
                value={f.value}
                checked={format === f.value}
                onChange={() => {
                  setFormat(f.value);
                  setBurn(f.burnCaptions);
                }}
                className="accent-[var(--primary)]"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-m`}>Music bed</Label>
          <select id={`${id}-m`} name="musicId" className={selectClass} defaultValue="">
            <option value="">No music</option>
            {music.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.license})
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input
            type="checkbox"
            name="burnCaptions"
            value="yes"
            checked={burn}
            onChange={(e) => setBurn(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Burn captions into the picture (Shorts); SRT and WebVTT files are always made
        </label>
      </div>
      <Button type="submit" variant="lime" disabled={pending || !enabled}>
        {pending ? "Queuing…" : "Render video"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function ThumbnailForm({
  documentaryId,
  images,
  defaultHeadline,
}: {
  documentaryId: string;
  images: { id: string; title: string; reconstruction: boolean }[];
  defaultHeadline: string;
}) {
  const id = useId();
  const [state, act, pending] = useActionState<DocumentaryState, FormData>(documentaryAction, null);
  return (
    <form
      onSubmit={keepValues(act)}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="intent" value="thumbnail" />
      <input type="hidden" name="documentaryId" value={documentaryId} />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-i`}>Picture</Label>
        <select id={`${id}-i`} name="mediaId" className={selectClass}>
          {images.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
              {m.reconstruction ? " (AI reconstruction, labelled)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-h`}>Headline</Label>
        <Input
          id={`${id}-h`}
          name="headline"
          maxLength={70}
          defaultValue={defaultHeadline.slice(0, 70)}
          className="h-11"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending || images.length === 0}>
        {pending ? "Making…" : "Make thumbnail"}
      </Button>
      <div className="sm:col-span-3">
        <Status state={state} />
      </div>
    </form>
  );
}

export function MusicUploadForm({ licenses }: { licenses: { id: string; name: string }[] }) {
  const id = useId();
  const [state, act, pending] = useActionState<MusicState, FormData>(uploadMusicAction, null);
  return (
    <form onSubmit={keepValues(act)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-f`}>Track (WAV or MP3, up to 10 MB)</Label>
          <Input
            id={`${id}-f`}
            name="file"
            type="file"
            accept="audio/wav,audio/x-wav,audio/mpeg"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-t`}>Title</Label>
          <Input id={`${id}-t`} name="title" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-l`}>Licence</Label>
          <select id={`${id}-l`} name="licenseId" className={selectClass}>
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-a`}>Attribution (composer, performer, where it came from)</Label>
          <Input id={`${id}-a`} name="attribution" className="h-11" />
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add track"}
      </Button>
      <Status state={state} />
    </form>
  );
}
