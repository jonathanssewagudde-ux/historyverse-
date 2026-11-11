import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { articlePath } from "@/lib/content/paths";
import { plainText } from "@/lib/search/text";
import { formatDateRow } from "@/server/history/date-row";

type Db = PrismaClient | Prisma.TransactionClient;

const PUBLIC = ["PUBLISHED", "UPDATED"] as const;

/** Astronomical year from a stored sort key (year * 10000 + month * 100 + day). */
const yearOf = (sortKey: bigint) => Math.floor(Number(sortKey) / 10_000);

/**
 * Write (or refresh) the search document for one article. Articles that are not published are
 * removed from the index instead, so this is safe to call after any status change.
 */
export async function indexArticle(db: Db, articleId: string): Promise<"indexed" | "removed"> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      sections: { orderBy: { position: "asc" } },
      primaryEntity: {
        include: {
          aliases: true,
          startDate: true,
          endDate: true,
          country: true,
          historicalState: true,
          civilization: true,
          relationsFrom: {
            where: { type: "LOCATED_IN" },
            include: { to: { include: { country: true } } },
          },
        },
      },
      entities: {
        include: {
          entity: { include: { country: true, aliases: { where: { type: "ALTERNATIVE" } } } },
        },
      },
      claims: { where: { property: "key-date" }, include: { date: true } },
    },
  });

  const path = article ? articlePath(article.template, article.slug) : null;
  if (
    !article ||
    article.deletedAt ||
    !article.publishedAt ||
    !path ||
    !PUBLIC.includes(article.status as never)
  ) {
    await db.searchDocument.deleteMany({ where: { articleId } });
    return "removed";
  }

  const subject = article.primaryEntity;
  const names = new Set<string>();
  if (subject) {
    names.add(subject.name);
    subject.aliases.forEach((a) => names.add(a.name));
  }
  for (const { entity } of article.entities) {
    if (entity.kind === "PERSON" || entity.kind === "LOCATION") names.add(entity.name);
  }

  const countries = new Set<string>();
  const continents = new Set<string>();
  if (subject?.country) {
    countries.add(subject.name);
    if (subject.country.continent) continents.add(subject.country.continent);
  }
  if (subject?.historicalState?.continent) continents.add(subject.historicalState.continent);
  if (subject?.civilization?.continent) continents.add(subject.civilization.continent);
  for (const rel of subject?.relationsFrom ?? []) {
    if (rel.to.kind === "COUNTRY") {
      countries.add(rel.to.name);
      if (rel.to.country?.continent) continents.add(rel.to.country.continent);
    }
  }
  for (const { entity } of article.entities) {
    if (entity.kind === "COUNTRY") {
      countries.add(entity.name);
      if (entity.country?.continent) continents.add(entity.country.continent);
    }
  }

  // Only dates known at least to the year can answer "what happened in <year>?".
  const datedClaims = article.claims
    .filter((c) => c.date && ["YEAR", "MONTH", "DAY"].includes(c.date.precision))
    .sort((a, b) => Number(a.date!.sortKey - b.date!.sortKey));
  const keyDates = datedClaims.map((c) => ({
    year: yearOf(c.date!.sortKey),
    label: formatDateRow(c.date)!,
    statement: c.statement,
  }));

  const body = plainText(
    article.sections.map((s) => [s.heading, s.body].filter(Boolean).join("\n\n")).join("\n\n"),
  );
  const data = {
    path,
    title: article.title,
    subtitle: article.subtitle,
    summary: article.summary,
    body,
    template: article.template,
    locale: article.locale,
    names: [...names],
    countries: [...countries],
    continents: [...continents],
    startYear: subject?.startDate ? yearOf(subject.startDate.sortKey) : null,
    endYear: subject?.endDate ? yearOf(subject.endDate.sortKey) : null,
    dateYears: [...new Set(keyDates.map((k) => k.year))],
    keyDates: keyDates as Prisma.InputJsonValue,
    heroMediaId: article.heroMediaId,
    publishedAt: article.publishedAt,
  };

  const doc = await db.searchDocument.upsert({
    where: { articleId },
    create: { articleId, ...data },
    update: data,
  });
  await db.$executeRaw`
    UPDATE "search_documents"
       SET "searchVector" = hv_search_vector("title", "names", "subtitle", "summary", "body"),
           "matchText" = lower(hv_unaccent("title" || ' ' || array_to_string("names", ' ')))
     WHERE "id" = ${doc.id}`;
  return "indexed";
}

/** Rebuild the whole index from the articles table (e.g. after changing the weighting). */
export async function reindexAll(db: PrismaClient): Promise<{ indexed: number; removed: number }> {
  const articles = await db.article.findMany({ select: { id: true } });
  let indexed = 0;
  let removed = 0;
  for (const { id } of articles) {
    if ((await indexArticle(db, id)) === "indexed") indexed += 1;
    else removed += 1;
  }
  // Documents whose article no longer exists are removed by the foreign key cascade.
  return { indexed, removed };
}
