"use client";

import { useActionState, useId } from "react";

import { updateSourceAction, type SourceActionState } from "@/app/admin/citations/actions";
import { FormMessage } from "@/components/auth/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { keepValues } from "@/components/ui/keep-values";

const TYPES = [
  "BOOK",
  "JOURNAL_ARTICLE",
  "THESIS",
  "ARCHIVE_DOCUMENT",
  "PRIMARY_SOURCE",
  "NEWSPAPER",
  "WEBSITE",
  "ENCYCLOPEDIA",
  "DATASET",
  "ORAL_TRADITION",
  "MUSEUM_RECORD",
  "OTHER",
];

export type SourceFormData = {
  id: string;
  type: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  url: string | null;
  archiveUrl: string | null;
  isbn: string | null;
  doi: string | null;
  accessedAt: string | null;
  reliabilityNote: string | null;
};

export function SourceForm({ source }: { source: SourceFormData }) {
  const id = useId();
  const [state, save, pending] = useActionState<SourceActionState, FormData>(
    updateSourceAction,
    null,
  );
  const field = (
    name: keyof SourceFormData,
    text: string,
    value: string | number | null,
    type = "text",
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${name}`}>{text}</Label>
      <Input id={`${id}-${name}`} name={name} type={type} defaultValue={value ?? ""} />
    </div>
  );
  return (
    <form onSubmit={keepValues(save)} className="space-y-3">
      <input type="hidden" name="sourceId" value={source.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        {field("title", "Title", source.title)}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-type`}>Type</Label>
          <select
            id={`${id}-type`}
            name="type"
            defaultValue={source.type}
            className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase().replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("authors", "Authors (comma-separated)", source.authors.join(", "))}
        {field("publisher", "Publisher", source.publisher)}
        {field("publishedYear", "Year (negative for BCE)", source.publishedYear)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("url", "URL", source.url, "url")}
        {field("archiveUrl", "Archived copy URL", source.archiveUrl, "url")}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("isbn", "ISBN", source.isbn)}
        {field("doi", "DOI", source.doi)}
        {field("accessedAt", "Accessed", source.accessedAt, "date")}
      </div>
      {field("reliabilityNote", "Reliability note (shown to readers)", source.reliabilityNote)}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          Save source
        </Button>
        <FormMessage kind={state?.ok ? "success" : "error"}>{state?.message}</FormMessage>
      </div>
    </form>
  );
}
