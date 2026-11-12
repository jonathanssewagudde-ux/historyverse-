"use client";

import { ArrowDown, ArrowUp, Plus, Quote, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { saveArticleDraftAction, type SaveState } from "@/app/admin/articles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ArticleDraft } from "@/server/content/article-file";

export type EditorOptions = {
  entities: { id: string; name: string; kind: string }[];
  media: {
    id: string;
    title: string;
    kind: string;
    license: string;
    publishable: boolean;
    stored: boolean;
  }[];
  sources: { id: string; title: string; type: string; url: string | null }[];
};

const TEMPLATES = [
  "KINGDOM",
  "COUNTRY",
  "BIOGRAPHY",
  "MONARCH",
  "PRESIDENT",
  "CIVILIZATION",
  "EVENT",
  "INVENTION",
  "GENERAL",
];
const SECTION_KINDS = [
  "INTRODUCTION",
  "OVERVIEW",
  "CHRONOLOGY",
  "PEOPLE",
  "EVENTS",
  "CULTURE",
  "LEGACY",
  "FURTHER_READING",
  "CUSTOM",
];
const SOURCE_TYPES = [
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
const MEDIA_KINDS = [
  "UNCLASSIFIED",
  "AUTHENTIC_PHOTO",
  "AUTHENTIC_DOCUMENT",
  "ARTWORK",
  "MAP",
  "MODERN_PHOTO",
  "DIAGRAM",
];
const PRECISIONS = ["day", "month", "year", "decade", "century", "millennium"] as const;

const label = (v: string) => v.toLowerCase().replace(/_/g, " ");
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClass =
  "w-full rounded-xl border border-input bg-transparent px-4 py-3 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

type Draft = ArticleDraft;
type Section = Draft["sections"][number];
type KeyDate = Draft["keyDates"][number];

/**
 * Field ids are prefixed per editor instance: Next keeps the previous page mounted (hidden) during
 * navigation, so fixed ids would collide and labels could point at the hidden copy.
 */
const IdPrefix = createContext("editor");
function useFieldId() {
  const prefix = useContext(IdPrefix);
  return (name: string) => `${prefix}-${name}`;
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function nextSourceKey(sources: Draft["sources"]) {
  let n = sources.length + 1;
  while (sources.some((s) => s.key === `s${n}`)) n += 1;
  return `s${n}`;
}

function Card({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id: string;
}) {
  const f = useFieldId();
  return (
    <section aria-labelledby={f(id)} className="rounded-3xl border bg-card p-5 sm:p-6">
      <h2 id={f(id)} className="text-xl font-bold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  id,
  label: text,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "id">) {
  const f = useFieldId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={f(id)}>{text}</Label>
      <Input id={f(id)} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

export function ArticleEditor({
  articleId,
  initial,
  options,
  notice,
}: {
  articleId: string | null;
  initial: Draft;
  options: EditorOptions;
  /** Shown before the first save on this page, e.g. after creating the article. */
  notice?: string;
}) {
  const prefix = useId().replace(/:/g, "");
  const f = (name: string) => `${prefix}-${name}`;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [dirty, setDirty] = useState(false);
  const [state, save, saving] = useActionState<SaveState, FormData>(saveArticleDraftAction, null);
  const bodies = useRef<(HTMLTextAreaElement | null)[]>([]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset after a confirmed save
      setDirty(false);
      if (!articleId) router.replace(`/admin/articles/${state.articleId}/edit?created=1` as Route);
    }
  }, [state, articleId, router]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setSection = (i: number, patch: Partial<Section>) =>
    update({ sections: draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setKeyDate = (i: number, patch: Partial<KeyDate>) =>
    update({ keyDates: draft.keyDates.map((k, j) => (j === i ? { ...k, ...patch } : k)) });

  function insertCitation(i: number, key: string, locator: string) {
    const el = bodies.current[i];
    const marker = locator.trim() ? `[@${key}|${locator.trim()}]` : `[@${key}]`;
    const body = draft.sections[i]!.body;
    const at = el ? el.selectionEnd : body.length;
    setSection(i, { body: body.slice(0, at) + marker + body.slice(at) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + marker.length, at + marker.length);
    });
  }

  const sourceKeys = draft.sources.map((s) => s.key);

  return (
    // The payload is the whole draft; the server validates it.
    <IdPrefix value={prefix}>
      <form action={save} className="space-y-4">
        <input type="hidden" name="articleId" value={articleId ?? ""} />
        <input type="hidden" name="payload" value={JSON.stringify(draft)} />

        <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-background/90 p-4 backdrop-blur">
          <div aria-live="polite" className="min-w-0 text-sm">
            {state && !state.ok && (
              <p className="font-semibold text-destructive">{state.message}</p>
            )}
            {state?.ok && <p className="font-semibold">{state.message}</p>}
            {!state && (
              <p className={dirty ? "text-muted-foreground" : "font-semibold"}>
                {dirty ? "Unsaved changes" : (notice ?? "No changes yet")}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {articleId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/articles/${articleId}` as Route)}
              >
                Preview
              </Button>
            )}
            <Button type="submit" variant="lime" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </div>

        {state && !state.ok && state.issues.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm"
          >
            <p className="font-semibold text-destructive">Fix these before saving:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {state.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {state?.ok && state.warnings.length > 0 && (
          <div
            role="status"
            className="rounded-2xl border border-dashed border-primary/60 p-4 text-sm"
          >
            <ul className="list-disc space-y-1 pl-5">
              {state.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <Card id="basics" title="Basics">
          <TextField
            id="title"
            label="Title"
            value={draft.title}
            onChange={(v) => update({ title: v })}
            required
          />
          <TextField
            id="subtitle"
            label="Subtitle"
            value={draft.subtitle}
            onChange={(v) => update({ subtitle: v || undefined })}
          />
          <div className="space-y-1.5">
            <Label htmlFor={f("summary")}>Summary (shown in listings and search)</Label>
            <textarea
              id={f("summary")}
              rows={3}
              maxLength={400}
              value={draft.summary ?? ""}
              onChange={(e) => update({ summary: e.target.value || undefined })}
              className={cn(textareaClass, "font-sans")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="slug"
              label="Address (slug)"
              value={draft.slug}
              onChange={(v) => update({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              placeholder="created from the title"
            />
            <div className="space-y-1.5">
              <Label htmlFor={f("template")}>Template</Label>
              <select
                id={f("template")}
                className={selectClass}
                value={draft.template}
                onChange={(e) => update({ template: e.target.value as Draft["template"] })}
              >
                {TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={f("subject")}>Subject</Label>
              <select
                id={f("subject")}
                className={selectClass}
                value={draft.primaryEntity.entityId ?? ""}
                onChange={(e) => update({ primaryEntity: { entityId: e.target.value } })}
              >
                <option value="">Choose…</option>
                {options.entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({label(e.kind)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {draft.authoring === "ai_draft" && (
            <p className="rounded-xl bg-primary/10 p-3 text-sm">
              This article started as an AI-assisted draft. It stays flagged until an editor
              publishes it.
            </p>
          )}
        </Card>

        <Card
          id="sources"
          title="Sources"
          description="Cite a source in the text with [@key] or [@key|page or section]. Every factual section needs at least one."
        >
          {draft.sources.map((s, i) => (
            <fieldset key={s.key} className="space-y-3 rounded-2xl border p-4">
              <legend className="px-1 font-mono text-sm">[@{s.key}]</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <TextField
                  id={`src-title-${i}`}
                  label="Title"
                  value={s.title}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) => (j === i ? { ...x, title: v } : x)),
                    })
                  }
                />
                <div className="space-y-1.5">
                  <Label htmlFor={f(`src-type-${i}`)}>Type</Label>
                  <select
                    id={f(`src-type-${i}`)}
                    className={selectClass}
                    value={s.type}
                    onChange={(e) =>
                      update({
                        sources: draft.sources.map((x, j) =>
                          j === i ? { ...x, type: e.target.value as typeof s.type } : x,
                        ),
                      })
                    }
                  >
                    {SOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {label(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id={`src-authors-${i}`}
                  label="Authors (comma-separated)"
                  value={s.authors.join(", ")}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              authors: v
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean),
                            }
                          : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`src-pub-${i}`}
                  label="Publisher"
                  value={s.publisher}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) =>
                        j === i ? { ...x, publisher: v || undefined } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`src-year-${i}`}
                  label="Year"
                  inputMode="numeric"
                  value={s.publishedYear}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) =>
                        j === i ? { ...x, publishedYear: v ? Number(v) : undefined } : x,
                      ),
                    })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <TextField
                  id={`src-url-${i}`}
                  label="URL"
                  type="url"
                  value={s.url}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) =>
                        j === i ? { ...x, url: v || undefined } : x,
                      ),
                    })
                  }
                />
                <TextField
                  id={`src-acc-${i}`}
                  label="Accessed"
                  type="date"
                  value={s.accessedAt}
                  onChange={(v) =>
                    update({
                      sources: draft.sources.map((x, j) =>
                        j === i ? { ...x, accessedAt: v || undefined } : x,
                      ),
                    })
                  }
                />
              </div>
              <TextField
                id={`src-note-${i}`}
                label="Reliability note (shown to readers)"
                value={s.reliabilityNote}
                onChange={(v) =>
                  update({
                    sources: draft.sources.map((x, j) =>
                      j === i ? { ...x, reliabilityNote: v || undefined } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => update({ sources: draft.sources.filter((_, j) => j !== i) })}
              >
                <Trash2 aria-hidden /> Remove source
              </Button>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update({
                  sources: [
                    ...draft.sources,
                    { key: nextSourceKey(draft.sources), type: "BOOK", title: "", authors: [] },
                  ],
                })
              }
            >
              <Plus aria-hidden /> New source
            </Button>
            {options.sources.length > 0 && (
              <select
                aria-label="Add an existing source"
                className={cn(selectClass, "h-9 w-auto max-w-xs text-sm")}
                value=""
                onChange={(e) => {
                  const src = options.sources.find((s) => s.id === e.target.value);
                  if (!src || draft.sources.some((s) => s.id === src.id)) return;
                  update({
                    sources: [
                      ...draft.sources,
                      {
                        id: src.id,
                        key: nextSourceKey(draft.sources),
                        type: src.type as never,
                        title: src.title,
                        authors: [],
                        url: src.url ?? undefined,
                      },
                    ],
                  });
                }}
              >
                <option value="">Add an existing source…</option>
                {options.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Card>

        <Card
          id="sections"
          title="Sections"
          description="Text supports *italic* and **bold**. Separate paragraphs with a blank line."
        >
          {draft.sections.map((s, i) => (
            <SectionEditor
              key={i}
              index={i}
              section={s}
              count={draft.sections.length}
              sourceKeys={sourceKeys}
              bodyRef={(el) => {
                bodies.current[i] = el;
              }}
              onChange={(patch) => setSection(i, patch)}
              onMove={(delta) => update({ sections: move(draft.sections, i, delta) })}
              onRemove={() => update({ sections: draft.sections.filter((_, j) => j !== i) })}
              onCite={(key, locator) => insertCitation(i, key, locator)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update({ sections: [...draft.sections, { kind: "CUSTOM", heading: "", body: "" }] })
            }
          >
            <Plus aria-hidden /> Add section
          </Button>
        </Card>

        <Card
          id="key-dates"
          title="Key dates"
          description="Shown as the article's timeline. Each date needs a source. Only dates known to the year or better answer “what happened in …” searches."
        >
          {draft.keyDates.map((k, i) => (
            <KeyDateEditor
              key={i}
              index={i}
              value={k}
              sourceKeys={sourceKeys}
              onChange={(patch) => setKeyDate(i, patch)}
              onRemove={() => update({ keyDates: draft.keyDates.filter((_, j) => j !== i) })}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update({
                keyDates: [
                  ...draft.keyDates,
                  {
                    statement: "",
                    type: "FACT",
                    certainty: "DOCUMENTED",
                    date: { year: 1900, precision: "year" },
                    cite: [{ source: sourceKeys[0] ?? "" }],
                  },
                ],
              })
            }
          >
            <Plus aria-hidden /> Add key date
          </Button>
        </Card>

        <Card
          id="related"
          title="People and places"
          description="Linked entities appear beside the article and help search."
        >
          <ul className="space-y-2">
            {draft.entities.map((e, i) => (
              <li key={`${e.entityId}-${i}`} className="flex flex-wrap items-center gap-2">
                <span className="min-w-40 font-medium">
                  {options.entities.find((x) => x.id === e.entityId)?.name ?? e.wikidataId}
                </span>
                <select
                  aria-label="Role"
                  className={cn(selectClass, "h-9 w-auto text-sm")}
                  value={e.role}
                  onChange={(ev) =>
                    update({
                      entities: draft.entities.map((x, j) =>
                        j === i ? { ...x, role: ev.target.value as typeof e.role } : x,
                      ),
                    })
                  }
                >
                  {["people", "places", "events", "related"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  onClick={() => update({ entities: draft.entities.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <select
            aria-label="Link an entity"
            className={cn(selectClass, "h-9 w-auto max-w-sm text-sm")}
            value=""
            onChange={(e) => {
              const ent = options.entities.find((x) => x.id === e.target.value);
              if (!ent || draft.entities.some((x) => x.entityId === ent.id)) return;
              update({
                entities: [
                  ...draft.entities,
                  {
                    entityId: ent.id,
                    role:
                      ent.kind === "PERSON"
                        ? "people"
                        : ent.kind === "LOCATION" || ent.kind === "COUNTRY"
                          ? "places"
                          : "related",
                  },
                ],
              });
            }}
          >
            <option value="">Link a person, place or other entity…</option>
            {options.entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({label(e.kind)})
              </option>
            ))}
          </select>
        </Card>

        <Card
          id="images"
          title="Images"
          description="Choose from the media library. Images appear publicly only if classified, under a publishable licence, downloaded, and approved at publication."
        >
          {draft.media.map((m, i) => {
            const asset = options.media.find((x) => x.id === m.mediaId);
            return (
              <fieldset key={m.mediaId ?? i} className="space-y-3 rounded-2xl border p-4">
                <legend className="px-1 font-medium">{asset?.title ?? m.sourceRef}</legend>
                <p className="text-xs text-muted-foreground">
                  {asset?.license}
                  {asset && !asset.publishable && " · licence does not allow publication"}
                  {asset && !asset.stored && " · file not downloaded"}
                </p>
                <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
                  <div className="space-y-1.5">
                    <Label htmlFor={f(`m-kind-${i}`)}>What it is</Label>
                    <select
                      id={f(`m-kind-${i}`)}
                      className={selectClass}
                      value={m.kind}
                      onChange={(e) =>
                        update({
                          media: draft.media.map((x, j) =>
                            j === i ? { ...x, kind: e.target.value as typeof m.kind } : x,
                          ),
                        })
                      }
                    >
                      {MEDIA_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {label(k)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextField
                    id={`m-cap-${i}`}
                    label="Caption"
                    value={m.caption}
                    onChange={(v) =>
                      update({
                        media: draft.media.map((x, j) => (j === i ? { ...x, caption: v } : x)),
                      })
                    }
                  />
                </div>
                <TextField
                  id={`m-alt-${i}`}
                  label="Alt text (describe the image)"
                  value={m.altText}
                  onChange={(v) =>
                    update({
                      media: draft.media.map((x, j) => (j === i ? { ...x, altText: v } : x)),
                    })
                  }
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="hero"
                      checked={m.hero}
                      onChange={() =>
                        update({ media: draft.media.map((x, j) => ({ ...x, hero: j === i })) })
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    Main image
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ media: draft.media.filter((_, j) => j !== i) })}
                  >
                    <Trash2 aria-hidden /> Remove image
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <select
            aria-label="Add an image"
            className={cn(selectClass, "h-9 w-auto max-w-sm text-sm")}
            value=""
            onChange={(e) => {
              const asset = options.media.find((x) => x.id === e.target.value);
              if (!asset || draft.media.some((x) => x.mediaId === asset.id)) return;
              update({
                media: [
                  ...draft.media,
                  {
                    mediaId: asset.id,
                    kind: (MEDIA_KINDS.includes(asset.kind) ? asset.kind : "UNCLASSIFIED") as never,
                    altText: "",
                    caption: "",
                    hero: false,
                  },
                ],
              });
            }}
          >
            <option value="">Add an image from the library…</option>
            {options.media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </Card>
      </form>
    </IdPrefix>
  );
}

function SectionEditor({
  index,
  section,
  count,
  sourceKeys,
  bodyRef,
  onChange,
  onMove,
  onRemove,
  onCite,
}: {
  index: number;
  section: Section;
  count: number;
  sourceKeys: string[];
  bodyRef: (el: HTMLTextAreaElement | null) => void;
  onChange: (patch: Partial<Section>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onCite: (key: string, locator: string) => void;
}) {
  const f = useFieldId();
  const [citeKey, setCiteKey] = useState("");
  const [locator, setLocator] = useState("");
  const n = index + 1;
  return (
    <fieldset className="space-y-3 rounded-2xl border p-4">
      <legend className="px-1 font-medium">Section {n}</legend>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={f(`sec-kind-${index}`)}>Kind</Label>
          <select
            id={f(`sec-kind-${index}`)}
            className={selectClass}
            value={section.kind}
            onChange={(e) => onChange({ kind: e.target.value as Section["kind"] })}
          >
            {SECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </div>
        <TextField
          id={`sec-heading-${index}`}
          label="Heading"
          value={section.heading}
          onChange={(v) => onChange({ heading: v || undefined })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={f(`sec-body-${index}`)}>Text</Label>
        <textarea
          id={f(`sec-body-${index}`)}
          ref={bodyRef}
          rows={8}
          value={section.body}
          onChange={(e) => onChange({ body: e.target.value })}
          className={textareaClass}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={f(`cite-src-${index}`)}>Cite</Label>
          <select
            id={f(`cite-src-${index}`)}
            className={cn(selectClass, "h-9 w-auto text-sm")}
            value={citeKey}
            onChange={(e) => setCiteKey(e.target.value)}
          >
            <option value="">source…</option>
            {sourceKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={f(`cite-loc-${index}`)}>Page or section</Label>
          <Input
            id={f(`cite-loc-${index}`)}
            className="h-9 w-48 text-sm"
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!citeKey}
          onClick={() => onCite(citeKey, locator)}
        >
          <Quote aria-hidden /> Insert citation
        </Button>
        <span className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move section ${n} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move section ${n} down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove section ${n}`}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </span>
      </div>
    </fieldset>
  );
}

function KeyDateEditor({
  index,
  value,
  sourceKeys,
  onChange,
  onRemove,
}: {
  index: number;
  value: KeyDate;
  sourceKeys: string[];
  onChange: (patch: Partial<KeyDate>) => void;
  onRemove: () => void;
}) {
  const f = useFieldId();
  const d = value.date;
  const bce = d.year < 0;
  const setDate = (patch: Partial<KeyDate["date"]>) => onChange({ date: { ...d, ...patch } });
  const cite = value.cite[0] ?? { source: "" };
  return (
    <fieldset className="space-y-3 rounded-2xl border p-4">
      <legend className="px-1 font-medium">Key date {index + 1}</legend>
      <TextField
        id={`kd-st-${index}`}
        label="What happened"
        value={value.statement}
        onChange={(v) => onChange({ statement: v })}
      />
      <div className="grid gap-3 sm:grid-cols-6">
        <TextField
          id={`kd-y-${index}`}
          label="Year"
          inputMode="numeric"
          value={Math.abs(d.year)}
          onChange={(v) => setDate({ year: (Number(v) || 1) * (bce ? -1 : 1) })}
        />
        <div className="space-y-1.5">
          <Label htmlFor={f(`kd-era-${index}`)}>Era</Label>
          <select
            id={f(`kd-era-${index}`)}
            className={selectClass}
            value={bce ? "BCE" : "CE"}
            onChange={(e) =>
              setDate({ year: Math.abs(d.year) * (e.target.value === "BCE" ? -1 : 1) })
            }
          >
            <option>CE</option>
            <option>BCE</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={f(`kd-p-${index}`)}>Precision</Label>
          <select
            id={f(`kd-p-${index}`)}
            className={selectClass}
            value={d.precision}
            onChange={(e) => {
              const precision = e.target.value as KeyDate["date"]["precision"];
              setDate({
                precision,
                month: precision === "month" || precision === "day" ? (d.month ?? 1) : undefined,
                day: precision === "day" ? (d.day ?? 1) : undefined,
              });
            }}
          >
            {PRECISIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        {(d.precision === "month" || d.precision === "day") && (
          <TextField
            id={`kd-m-${index}`}
            label="Month"
            inputMode="numeric"
            value={d.month}
            onChange={(v) => setDate({ month: Number(v) || undefined })}
          />
        )}
        {d.precision === "day" && (
          <TextField
            id={`kd-d-${index}`}
            label="Day"
            inputMode="numeric"
            value={d.day}
            onChange={(v) => setDate({ day: Number(v) || undefined })}
          />
        )}
        <label className="flex items-end gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(d.approximate)}
            onChange={(e) => setDate({ approximate: e.target.checked || undefined })}
            className="size-4 accent-[var(--primary)]"
          />
          circa
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={f(`kd-cs-${index}`)}>Source</Label>
          <select
            id={f(`kd-cs-${index}`)}
            className={selectClass}
            value={cite.source}
            onChange={(e) =>
              onChange({ cite: [{ ...cite, source: e.target.value }, ...value.cite.slice(1)] })
            }
          >
            <option value="">choose…</option>
            {sourceKeys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <TextField
          id={`kd-cl-${index}`}
          label="Page or section"
          value={cite.locator}
          onChange={(v) =>
            onChange({ cite: [{ ...cite, locator: v || undefined }, ...value.cite.slice(1)] })
          }
        />
        <div className="space-y-1.5">
          <Label htmlFor={f(`kd-c-${index}`)}>Certainty</Label>
          <select
            id={f(`kd-c-${index}`)}
            className={selectClass}
            value={value.certainty}
            onChange={(e) => onChange({ certainty: e.target.value as KeyDate["certainty"] })}
          >
            {["DOCUMENTED", "TRADITIONAL", "PROBABLE", "UNCERTAIN", "DISPUTED"].map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 aria-hidden /> Remove date
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
