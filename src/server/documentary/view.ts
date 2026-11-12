import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { getSpeech } from "@/server/ai/speech";
import { mediaPublishBlocker } from "@/server/content/publish";
import { ProviderUnavailableError } from "@/server/providers/contracts";
import { approvalProblems } from "./documentaries";
import { BEAT_LABELS, type Beat } from "./structure";

export function getSpeechStatus():
  | { ok: true; id: string; voiceId: string; voiceLicense: string | null; free: boolean }
  | { ok: false; reason: string } {
  try {
    const { provider, voiceId, voiceLicense } = getSpeech();
    const free =
      provider.estimateCost({ text: "x".repeat(1000), voiceId, language: "en" }).amount === 0;
    return { ok: true, id: provider.id, voiceId, voiceLicense, free };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof ProviderUnavailableError
          ? error.message
          : "The narration engine is not usable.",
    };
  }
}

export async function listDocumentaries(db: PrismaClient) {
  const docs = await db.documentary.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      article: { select: { title: true, status: true } },
      scripts: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { version: "desc" },
        include: {
          scenes: {
            select: {
              durationSeconds: true,
              voiceovers: { where: { isCurrent: true }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  return docs.map((d) => {
    const script = d.scripts[0];
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      article: d.article,
      script: script
        ? {
            version: script.version,
            status: script.status,
            scenes: script.scenes.length,
            narrated: script.scenes.filter((s) => s.voiceovers.length > 0).length,
            seconds: Math.round(script.scenes.reduce((n, s) => n + Number(s.durationSeconds), 0)),
          }
        : null,
    };
  });
}

/** The documentary page: its current script (newest not superseded), scenes, choices and takes. */
export async function getDocumentaryView(db: PrismaClient, id: string) {
  const doc = await db.documentary.findUnique({
    where: { id },
    include: {
      article: {
        include: {
          citations: {
            include: {
              source: { select: { title: true } },
              section: { select: { heading: true, kind: true } },
            },
            orderBy: [{ sectionId: "asc" }, { position: "asc" }],
          },
          claims: {
            where: { property: "key-date" },
            include: { citations: { include: { source: { select: { title: true } } } } },
          },
          media: { include: { media: { include: { license: true } } } },
        },
      },
      primaryEntity: { include: { media: { include: { media: { include: { license: true } } } } } },
      project: { select: { id: true, topic: true } },
      scripts: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true } },
    },
  });
  if (!doc) return null;
  const current = doc.scripts.find((s) => s.status !== "SUPERSEDED") ?? doc.scripts[0];
  const script = current
    ? await db.documentaryScript.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          approvedBy: { select: { name: true } },
          scenes: {
            orderBy: { position: "asc" },
            include: {
              assets: { orderBy: { position: "asc" }, select: { mediaId: true } },
              citations: { select: { citationId: true } },
              voiceovers: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      })
    : null;

  // Citations a scene may use: the article's own, labelled for people.
  const citationOptions = [
    ...(doc.article?.citations ?? [])
      .filter((c) => c.sectionId)
      .map((c) => ({
        id: c.id,
        label: `${c.section?.heading ?? (c.section?.kind === "INTRODUCTION" ? "Introduction" : "Section")}: ${c.source.title}${c.locator ? ` (${c.locator})` : ""}`,
      })),
    ...(doc.article?.claims ?? []).flatMap((claim) =>
      claim.citations.map((c) => ({
        id: c.id,
        label: `Key date: ${claim.statement.slice(0, 60)} — ${c.source.title}`,
      })),
    ),
  ];
  // Images a scene may use: approved and publishable, from the article or its subject.
  const seen = new Set<string>();
  const mediaOptions = [...(doc.article?.media ?? []), ...(doc.primaryEntity?.media ?? [])]
    .map((m) => m.media)
    .filter((m) => {
      if (seen.has(m.id) || m.deletedAt || m.reviewStatus !== "APPROVED" || mediaPublishBlocker(m))
        return false;
      seen.add(m.id);
      return true;
    })
    .map((m) => ({ id: m.id, title: m.title, kind: m.kind }));

  return {
    id: doc.id,
    title: doc.title,
    status: doc.status,
    project: doc.project,
    article: doc.article
      ? { id: doc.article.id, title: doc.article.title, status: doc.article.status }
      : null,
    lexicon: Object.entries((doc.lexicon ?? {}) as Record<string, string>)
      .map(([w, s]) => `${w} = ${s}`)
      .join("\n"),
    versions: doc.scripts,
    citationOptions,
    mediaOptions,
    script: script && {
      id: script.id,
      version: script.version,
      status: script.status,
      approvedBy: script.approvedBy?.name ?? null,
      approvedAt: script.approvedAt?.toISOString() ?? null,
      problems: script.status === "APPROVED" ? [] : await approvalProblems(db, script.id),
      seconds: Math.round(script.scenes.reduce((n, s) => n + Number(s.durationSeconds), 0)),
      scenes: script.scenes.map((s) => {
        const take = s.voiceovers.find((v) => v.isCurrent) ?? null;
        return {
          id: s.id,
          position: s.position,
          beat: s.beat,
          beatLabel: s.beat ? (BEAT_LABELS[s.beat as Beat] ?? s.beat) : "Scene",
          narration: s.narration,
          visualDescription: s.visualDescription ?? "",
          onScreenText: s.onScreenText ?? "",
          durationSeconds: Number(s.durationSeconds),
          status: s.status,
          mediaIds: s.assets.map((a) => a.mediaId),
          citationIds: s.citations.map((c) => c.citationId),
          take: take && {
            id: take.id,
            source: take.source,
            provider: take.provider,
            voiceId: take.voiceId,
            durationMs: take.durationMs,
            voiceLicense: take.voiceLicense,
            costUsd: take.costUsd ? Number(take.costUsd) : null,
          },
          earlierTakes: s.voiceovers.filter((v) => !v.isCurrent).length,
        };
      }),
    },
  };
}

export type DocumentaryView = NonNullable<Awaited<ReturnType<typeof getDocumentaryView>>>;
