import { CalendarClock, Clock, Film, MapPin, ScrollText, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ReaderTools } from "@/components/content/reader-tools";
import { RichText } from "@/components/content/rich-text";
import { EmptyState } from "@/components/home/empty-state";
import { MediaFrame, type MediaKind } from "@/components/media/media-frame";
import { cn } from "@/lib/utils";
import type { ArticleView, MediaView, ReferenceView } from "@/server/content/article-view";

const templateLabel: Record<string, string> = {
  KINGDOM: "Kingdom",
  COUNTRY: "Country",
  BIOGRAPHY: "Biography",
  MONARCH: "Monarch",
  PRESIDENT: "President",
};

const certaintyLabel: Record<string, string | null> = {
  DOCUMENTED: null,
  TRADITIONAL: "tradition",
  PROBABLE: "probable",
  UNCERTAIN: "uncertain",
  DISPUTED: "disputed",
};

function formatUtcDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function Media({
  media,
  preview,
  priority,
}: {
  media: MediaView;
  preview: boolean;
  priority?: boolean;
}) {
  if (!media.stored) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        <strong className="text-foreground">{media.title}</strong>
        <span>File not downloaded yet. Run pnpm media:fetch for this article.</span>
        {media.caption && <span className="text-xs">{media.caption}</span>}
      </div>
    );
  }
  return (
    <div>
      <MediaFrame
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        kind={media.kind.toLowerCase() as MediaKind}
        caption={media.caption ?? undefined}
        credit={{
          source: media.credit.source,
          sourceUrl: media.credit.sourceUrl ?? undefined,
          creator: media.credit.creator ?? undefined,
          license: media.credit.license,
          licenseUrl: media.credit.licenseUrl ?? undefined,
        }}
        priority={priority}
        unoptimized
      />
      {preview && media.blocker && (
        <p className="mt-2 rounded-xl border border-dashed border-destructive/50 px-3 py-2 text-xs text-destructive">
          Not shown publicly: {media.blocker}.
        </p>
      )}
    </div>
  );
}

function Reference({ r, showNote }: { r: ReferenceView; showNote: boolean }) {
  const by = r.authors.length > 0 ? `${r.authors.join(", ")}. ` : "";
  const pub = [r.publisher, r.year].filter(Boolean).join(", ");
  return (
    <li id={`ref-${r.n}`} className="scroll-mt-28 target:rounded-lg target:bg-accent">
      <span className="mr-2 font-mono text-xs text-muted-foreground">[{r.n}]</span>
      {by}
      {r.url ? (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          <cite className="not-italic">{r.title}</cite>
        </a>
      ) : (
        <cite className="font-medium not-italic">{r.title}</cite>
      )}
      {pub && <span>. {pub}</span>}
      {r.locator && (
        <span>. {r.locator.startsWith("Article") ? r.locator : `Section “${r.locator}”`}</span>
      )}
      {r.accessedAt && (
        <span className="text-muted-foreground">. Accessed {formatUtcDate(r.accessedAt)}</span>
      )}
      .
      {showNote && r.reliabilityNote && (
        <span className="mt-0.5 block text-xs text-muted-foreground">
          Note: {r.reliabilityNote}
        </span>
      )}
    </li>
  );
}

/** Shared article layout for every template. `preview` adds review annotations for editors. */
export function ArticlePage({
  article,
  preview = false,
}: {
  article: ArticleView;
  preview?: boolean;
}) {
  const [intro, ...rest] = article.sections;
  const body = rest.filter((s) => s.kind !== "FURTHER_READING");
  const further = rest.find((s) => s.kind === "FURTHER_READING");

  return (
    <article id="article" className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6">
      {preview && (
        <div
          role="note"
          className="mb-6 rounded-2xl border border-dashed border-primary/60 bg-primary/10 p-4 text-sm"
        >
          <strong>
            Preview, version {article.version}, status{" "}
            {article.status.toLowerCase().replace(/_/g, " ")}.
          </strong>{" "}
          {article.containsUnreviewedAi
            ? "This text is an AI-assisted draft. Check every statement against its cited source before publishing."
            : "Readers see exactly this page, without these review notes."}
        </div>
      )}

      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground lowercase">
          {templateLabel[article.template] ?? "Article"}
        </p>
        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold text-balance sm:text-6xl">
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="mt-3 text-xl text-pretty text-muted-foreground">{article.subtitle}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {article.readingMinutes && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden /> {article.readingMinutes} min read
            </span>
          )}
          {article.publishedAt && <span>Published {formatUtcDate(article.publishedAt)}</span>}
          <span className="inline-flex items-center gap-1.5">
            <ScrollText className="size-4" aria-hidden /> {article.references.length} references
          </span>
        </div>
        <div className="mt-5">
          <ReaderTools targetId="article" title={article.title} />
        </div>
      </header>

      {article.hero && (
        <div className="mt-8">
          <Media media={article.hero} preview={preview} priority />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="article-prose min-w-0">
          {intro && (
            <RichText
              body={intro.body}
              refs={intro.refs}
              className="space-y-4 text-[1.15em] leading-relaxed text-foreground"
            />
          )}
          {body.map((section) => (
            <section key={section.id} aria-labelledby={`s-${section.id}`} className="mt-10">
              {section.heading && (
                <h2 id={`s-${section.id}`} className="mb-4 text-3xl font-extrabold">
                  {section.heading}
                </h2>
              )}
              <RichText
                body={section.body}
                refs={section.refs}
                className="space-y-4 text-foreground/90"
              />
            </section>
          ))}

          {article.gallery.length > 0 && (
            <section aria-labelledby="gallery-title" className="mt-12">
              <h2 id="gallery-title" className="mb-4 text-3xl font-extrabold">
                Images
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {article.gallery.map((m) => (
                  <Media key={m.id} media={m} preview={preview} />
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="documentary-title" className="mt-12">
            <h2 id="documentary-title" className="mb-4 text-3xl font-extrabold">
              Watch the HISTORYVERSE Documentary
            </h2>
            {article.documentaries.length > 0 ? (
              article.documentaries.map((d) => (
                <div
                  key={d.youtubeVideoId}
                  className="aspect-video overflow-hidden rounded-3xl border"
                >
                  <iframe
                    className="size-full"
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.youtubeVideoId)}`}
                    title={d.title}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ))
            ) : (
              <EmptyState icon={Film} title="No documentary yet">
                A documentary for this article will appear here once it has been produced, reviewed
                and published.
              </EmptyState>
            )}
          </section>

          <section aria-labelledby="references-title" className="mt-12 border-t pt-8">
            <h2 id="references-title" className="mb-4 text-3xl font-extrabold">
              Sources and references
            </h2>
            <ol className="space-y-3 text-sm leading-relaxed">
              {article.references.map((r, i) => (
                <Reference
                  key={r.n}
                  r={r}
                  showNote={article.references.findIndex((x) => x.url === r.url) === i}
                />
              ))}
            </ol>
            {further && (
              <div className="mt-8">
                <h3 className="mb-2 text-xl font-bold">{further.heading ?? "Further reading"}</h3>
                <RichText
                  body={further.body}
                  refs={further.refs}
                  className="space-y-3 text-sm text-muted-foreground"
                />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="At a glance">
          {article.keyDates.length > 0 && (
            <section aria-labelledby="dates-title" className="rounded-3xl border bg-card p-5">
              <h2 id="dates-title" className="flex items-center gap-2 text-lg font-bold">
                <CalendarClock className="size-5 text-primary" aria-hidden /> Key dates
              </h2>
              <ol className="mt-4 space-y-4 border-l pl-4">
                {article.keyDates.map((d) => (
                  <li key={d.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary"
                    />
                    <p className="font-mono text-xs font-medium text-primary">
                      {d.label}
                      {certaintyLabel[d.certainty] && (
                        <span className="ml-2 rounded-full border px-1.5 text-muted-foreground">
                          {certaintyLabel[d.certainty]}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm">
                      {d.statement}
                      {d.refs.map((n) => (
                        <sup key={n} className="ml-0.5 font-mono text-[0.7em]">
                          <a href={`#ref-${n}`} aria-label={`Source ${n}`} className="text-primary">
                            [{n}]
                          </a>
                        </sup>
                      ))}
                    </p>
                    {preview && !d.verified && (
                      <p className="text-xs text-destructive">Unverified</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <EntityList icon={Users} title="People in this story" items={article.people} />
          <EntityList icon={MapPin} title="Places" items={article.places} />
          {article.related.length > 0 && (
            <section aria-labelledby="related-title" className="rounded-3xl border bg-card p-5">
              <h2 id="related-title" className="text-lg font-bold">
                Related articles
              </h2>
              <ul className="mt-3 space-y-2">
                {article.related.map((r) => (
                  <li key={r.href}>
                    <Link
                      href={r.href as Route}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}

function EntityList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Users;
  title: string;
  items: { name: string; href: string | null }[];
}) {
  if (items.length === 0) return null;
  const id = `list-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="rounded-3xl border bg-card p-5">
      <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5 text-primary" aria-hidden /> {title}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.name}>
            {item.href ? (
              <Link
                href={item.href as Route}
                className={cn(
                  "inline-block rounded-full border px-3 py-1 text-sm font-medium hover:border-primary",
                )}
              >
                {item.name}
              </Link>
            ) : (
              <span className="inline-block rounded-full border border-dashed px-3 py-1 text-sm">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
