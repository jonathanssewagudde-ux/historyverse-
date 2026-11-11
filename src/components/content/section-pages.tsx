import { ArrowUpRight, BookOpen } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ArticlePage } from "@/components/content/article-page";
import { EmptyState } from "@/components/home/empty-state";
import { sectionTemplates, type PublicSection } from "@/lib/content/paths";
import { getPublishedArticle, getPublishedArticles } from "@/server/content/public";

export const sectionCopy: Record<
  PublicSection,
  { title: string; kicker: string; emoji: string; description: string }
> = {
  kingdoms: {
    title: "Kingdoms and Empires",
    kicker: "crown check",
    emoji: "👑",
    description: "Kingdoms, empires and their rulers, told from sourced and reviewed research.",
  },
  countries: {
    title: "Countries",
    kicker: "atlas mode",
    emoji: "🌍",
    description: "National histories, from early societies to the present day.",
  },
  people: {
    title: "People",
    kicker: "main characters",
    emoji: "⭐",
    description: "Biographies of rulers, leaders and the people who shaped history.",
  },
};

/** Listing page for a public section. Data is request-time (from the database) but cached. */
export function SectionListing({ section }: { section: PublicSection }) {
  const copy = sectionCopy[section];
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
        <span aria-hidden>{copy.emoji}</span>
        {copy.kicker}
      </p>
      <h1 className="text-4xl font-extrabold sm:text-6xl">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{copy.description}</p>
      <div className="mt-10">
        <Suspense
          fallback={<div className="h-64 animate-pulse rounded-3xl bg-muted" aria-busy="true" />}
        >
          <SectionList section={section} />
        </Suspense>
      </div>
    </div>
  );
}

async function SectionList({ section }: { section: PublicSection }) {
  await connection();
  const articles = await getPublishedArticles(sectionTemplates[section]);
  if (articles.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="Nothing published here yet">
        Articles appear in this section once they have been researched, sourced and approved by an
        editor.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((a) => (
        <li key={a.slug}>
          <Link
            href={a.path as Route}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border bg-card p-2 transition duration-300 hover:-translate-y-1 hover:border-primary/60"
          >
            {a.hero ? (
              // eslint-disable-next-line @next/next/no-img-element -- permission-checked media route
              <img
                src={a.hero.src}
                alt=""
                className="aspect-[16/10] w-full rounded-2xl object-cover"
                loading="lazy"
              />
            ) : (
              <div
                aria-hidden
                className="aspect-[16/10] rounded-2xl bg-gradient-to-br from-primary to-pink"
              />
            )}
            <div className="flex flex-1 flex-col gap-2 px-2 pt-3 pb-2">
              <h2 className="text-xl leading-snug font-bold">{a.title}</h2>
              {a.summary && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{a.summary}</p>
              )}
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary">
                Read {a.readingMinutes ? `· ${a.readingMinutes} min` : ""}
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Article page for a public section. Unknown and unpublished slugs normally never get here: the
 * proxy answers them with a real 404. If it could not check, this still renders the not-found UI.
 */
export function SectionArticle({
  section,
  params,
}: {
  section: PublicSection;
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div
          className="mx-auto h-[60vh] w-full max-w-6xl animate-pulse rounded-3xl bg-muted"
          aria-busy="true"
        />
      }
    >
      <SectionArticleContent section={section} params={params} />
    </Suspense>
  );
}

async function SectionArticleContent({
  section,
  params,
}: {
  section: PublicSection;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await loadArticle(section, slug);
  if (!article) notFound();
  return <ArticlePage article={article} />;
}

async function loadArticle(section: PublicSection, slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const article = await getPublishedArticle(slug);
  return article && (sectionTemplates[section] as readonly string[]).includes(article.template)
    ? article
    : null;
}

export async function sectionArticleMetadata(
  section: PublicSection,
  params: Promise<{ slug: string }>,
): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(section, slug);
  if (!article) return { title: "Not found" };
  return {
    title: article.title,
    description: article.summary ?? undefined,
    alternates: { canonical: article.path ?? undefined },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary ?? undefined,
      publishedTime: article.publishedAt ?? undefined,
      images: article.hero ? [{ url: article.hero.src, alt: article.hero.alt }] : undefined,
    },
  };
}
