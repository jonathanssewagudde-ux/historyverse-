"use client";

import { useActionState, useId } from "react";

import {
  fetchMediaAction,
  reviewMediaAction,
  updateMediaAction,
  uploadMediaAction,
  type MediaActionState,
} from "@/app/admin/media/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type License = { id: string; name: string; publishable: boolean };
export type MediaCardData = {
  id: string;
  title: string;
  kind: string;
  altText: string | null;
  description: string | null;
  attribution: string;
  sourceName: string;
  sourceUrl: string | null;
  licenseId: string;
  license: string;
  stored: boolean;
  previewable: boolean;
  reviewStatus: string;
  blocker: string | null;
  articles: number;
  isCommons: boolean;
  licenseVerified: string | null;
};

const KINDS = [
  ["UNCLASSIFIED", "Not classified yet"],
  ["AUTHENTIC_PHOTO", "Authentic photograph"],
  ["AUTHENTIC_DOCUMENT", "Authentic document"],
  ["ARTWORK", "Historical artwork"],
  ["MAP", "Map"],
  ["MODERN_PHOTO", "Modern photograph"],
  ["DIAGRAM", "Diagram"],
] as const;

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 md:text-sm";

function LicenseSelect({
  id,
  licenses,
  defaultValue,
}: {
  id: string;
  licenses: License[];
  defaultValue?: string;
}) {
  return (
    <select
      id={id}
      name="licenseId"
      className={selectClass}
      defaultValue={defaultValue ?? ""}
      required
    >
      <option value="" disabled>
        Choose…
      </option>
      {licenses.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
          {l.publishable ? "" : " (not publishable)"}
        </option>
      ))}
    </select>
  );
}

function KindSelect({ id, defaultValue }: { id: string; defaultValue?: string }) {
  return (
    <select
      id={id}
      name="kind"
      className={selectClass}
      defaultValue={defaultValue ?? "UNCLASSIFIED"}
    >
      {KINDS.map(([value, text]) => (
        <option key={value} value={value}>
          {text}
        </option>
      ))}
    </select>
  );
}

export function MediaCard({
  asset,
  licenses,
  canApprove,
}: {
  asset: MediaCardData;
  licenses: License[];
  canApprove: boolean;
}) {
  const id = useId();
  // One state for every action on the card, so the message always reflects the latest one.
  const [message, act, pending] = useActionState<MediaActionState, FormData>((prev, formData) => {
    const op = formData.get("op");
    if (op === "review") return reviewMediaAction(prev, formData);
    if (op === "fetch") return fetchMediaAction(prev, formData);
    return updateMediaAction(prev, formData);
  }, null);
  const reconstruction = asset.kind === "AI_RECONSTRUCTION";

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-3xl border bg-card p-5 md:flex-row"
    >
      <div className="w-full shrink-0 md:w-48">
        {asset.previewable ? (
          // eslint-disable-next-line @next/next/no-img-element -- staff-only preview of a stored file
          <img
            src={`/media/${asset.id}`}
            alt={asset.altText ?? ""}
            className="aspect-square w-full rounded-2xl bg-muted object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
            File not downloaded
          </div>
        )}
        <p className="mt-2 font-mono text-xs">
          <span className="rounded-full border px-2 py-0.5">
            {asset.reviewStatus.toLowerCase()}
          </span>{" "}
          · used in {asset.articles}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <h3 id={`${id}-title`} className="text-lg font-bold">
          {asset.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {asset.sourceUrl ? (
            <a
              href={asset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {asset.sourceName}
            </a>
          ) : (
            asset.sourceName
          )}{" "}
          · {asset.license}
          {" · "}
          {asset.licenseVerified
            ? `licence checked by ${asset.licenseVerified}`
            : "licence not yet checked"}
        </p>
        {asset.blocker && (
          <p className="text-sm text-destructive">Cannot be shown publicly: {asset.blocker}.</p>
        )}
        {reconstruction ? (
          <p className="text-sm">
            AI reconstructions are labelled and managed in the AI Image Studio.
          </p>
        ) : (
          <form action={act} className="space-y-3">
            <input type="hidden" name="op" value="update" />
            <input type="hidden" name="mediaId" value={asset.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-t`}>Title</Label>
                <Input id={`${id}-t`} name="title" defaultValue={asset.title} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-k`}>What it is</Label>
                <KindSelect id={`${id}-k`} defaultValue={asset.kind} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-l`}>Licence</Label>
                <LicenseSelect id={`${id}-l`} licenses={licenses} defaultValue={asset.licenseId} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-at`}>Attribution</Label>
                <Input id={`${id}-at`} name="attribution" defaultValue={asset.attribution} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-alt`}>Alt text</Label>
              <Input id={`${id}-alt`} name="altText" defaultValue={asset.altText ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-d`}>Description</Label>
              <Input id={`${id}-d`} name="description" defaultValue={asset.description ?? ""} />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Save details
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          {canApprove && !reconstruction && (
            <form action={act} className="flex gap-2">
              <input type="hidden" name="op" value="review" />
              <input type="hidden" name="mediaId" value={asset.id} />
              {asset.reviewStatus !== "APPROVED" && (
                <Button
                  type="submit"
                  name="decision"
                  value="APPROVED"
                  size="sm"
                  variant="lime"
                  disabled={pending}
                >
                  Approve
                </Button>
              )}
              {asset.reviewStatus !== "REJECTED" && (
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
            </form>
          )}
          {asset.isCommons && !asset.stored && (
            <form action={act}>
              <input type="hidden" name="op" value="fetch" />
              <input type="hidden" name="mediaId" value={asset.id} />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                {pending ? "Downloading…" : "Download from Commons"}
              </Button>
            </form>
          )}
        </div>
        <FormMessage kind={message?.ok ? "success" : "error"}>{message?.message}</FormMessage>
      </div>
    </article>
  );
}

export function UploadForm({ licenses }: { licenses: License[] }) {
  const id = useId();
  const [state, upload, pending] = useActionState<MediaActionState, FormData>(
    uploadMediaAction,
    null,
  );
  return (
    <form action={upload} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-f`}>Image file (JPEG, PNG, WebP or GIF, up to 10 MB)</Label>
        <Input
          id={`${id}-f`}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-t`}>Title</Label>
          <Input id={`${id}-t`} name="title" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-k`}>What it is</Label>
          <KindSelect id={`${id}-k`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-l`}>Licence</Label>
          <LicenseSelect id={`${id}-l`} licenses={licenses} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-at`}>Attribution (creator, holder)</Label>
          <Input id={`${id}-at`} name="attribution" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-sn`}>Where it comes from</Label>
          <Input
            id={`${id}-sn`}
            name="sourceName"
            placeholder="archive, museum or website"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-su`}>Source URL (optional)</Label>
          <Input id={`${id}-su`} name="sourceUrl" type="url" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-alt`}>Alt text</Label>
        <Input id={`${id}-alt`} name="altText" />
      </div>
      <p className="text-sm text-muted-foreground">
        Only upload images you have the right to use. The licence you choose is checked by an editor
        before the image can appear publicly.
      </p>
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
    </form>
  );
}
