import "server-only";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/server/db/client";
import {
  buildArticleView,
  listPublishedArticles,
  type ArticleSummary,
  type ArticleView,
} from "./article-view";

/** Cache tags. Publishing calls updateTag() on these so readers see changes immediately. */
export const tags = {
  articles: "articles",
  article: (slug: string) => `article:${slug}`,
};

/** A published article, cached until it is republished or unpublished. */
export async function getPublishedArticle(slug: string): Promise<ArticleView | null> {
  "use cache";
  cacheTag(tags.articles, tags.article(slug));
  cacheLife("hours");
  return buildArticleView(getDb(), { slug }, { publicOnly: true });
}

export async function getPublishedArticles(
  templates: readonly string[],
): Promise<ArticleSummary[]> {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("hours");
  return listPublishedArticles(getDb(), templates);
}
