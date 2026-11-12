import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { recordAudit } from "@/server/audit";
import { estimateSpeechSeconds, narrationText } from "@/server/audio/audio";
import { mediaPublishBlocker } from "@/server/content/publish";
import { formatDateRow } from "@/server/history/date-row";
import { userIdOf } from "@/server/jobs/service";
import { slugify } from "@/server/sources/wikidata/mapper";
import { BEATS, planScenes, type SourceAsset } from "./structure";

type Actor = { id: string; email?: string | null; role: Role };
type Tx = Prisma.TransactionClient;

export class DocumentaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentaryError";
  }
}

const PUBLIC = ["PUBLISHED", "UPDATED"];

function requireEdit(actor: Actor) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new DocumentaryError("Only editors work on documentaries.");
}

/** Everything the planner needs from an article: sections with citations, key dates, usable images. */
async function articleMaterial(db: PrismaClient | Tx, articleId: string) {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: { citations: { select: { id: true, position: true } } },
      },
      claims: {
        where: { property: "key-date" },
        include: { date: true, citations: { select: { id: true } } },
      },
      media: { orderBy: { position: "asc" }, include: { media: { include: { license: true } } } },
      primaryEntity: {
        include: {
          media: {
            orderBy: { position: "asc" },
            include: { media: { include: { license: true } } },
          },
        },
      },
    },
  });
  if (!article || article.deletedAt) throw new DocumentaryError("Article not found.");
  const candidates = [
    ...article.media.filter((m) => m.media.id === article.heroMediaId),
    ...article.media.filter((m) => m.media.id !== article.heroMediaId),
    ...(article.primaryEntity?.media ?? []),
  ].map((m) => m.media);
  // Only images an editor has approved and that may be published can appear in a video.
  const seen = new Set<string>();
  const assets: SourceAsset[] = [];
  for (const m of candidates) {
    if (seen.has(m.id) || m.deletedAt || m.reviewStatus !== "APPROVED" || mediaPublishBlocker(m))
      continue;
    seen.add(m.id);
    assets.push({ id: m.id, title: m.title, kind: m.kind });
  }
  const keyDates = article.claims
    .filter((c) => c.date)
    .sort((a, b) => Number(a.date!.sortKey - b.date!.sortKey))
    .map((c) => ({
      label: formatDateRow(c.date)!,
      statement: c.statement,
      citationIds: c.citations.map((x) => x.id),
    }));
  return { article, assets, keyDates };
}

async function writeScript(tx: Tx, documentaryId: string, articleId: string, version: number) {
  const { article, assets, keyDates } = await articleMaterial(tx, articleId);
  const scenes = planScenes({
    title: article.title,
    sections: article.sections.map((s) => ({
      kind: s.kind,
      heading: s.heading,
      body: s.body,
      citations: s.citations,
    })),
    keyDates,
    assets,
  });
  if (scenes.length === 0)
    throw new DocumentaryError("The article has no text to build a script from.");
  const script = await tx.documentaryScript.create({
    data: {
      documentaryId,
      version,
      targetDurationSeconds: Math.round(scenes.reduce((n, s) => n + s.durationSeconds, 0)),
      language: article.locale,
      narrationStyle: "documentary",
    },
  });
  for (const [position, scene] of scenes.entries()) {
    await tx.documentaryScene.create({
      data: {
        scriptId: script.id,
        position,
        beat: scene.beat,
        narration: scene.narration,
        visualDescription: scene.visualDescription,
        onScreenText: scene.onScreenText,
        durationSeconds: new Prisma.Decimal(scene.durationSeconds),
        transition: "crossfade",
        status: scene.assets.length > 0 ? "READY" : "ASSETS_NEEDED",
        assets: {
          create: scene.assets.map((a, i) => ({
            mediaId: a.mediaId,
            motion: a.motion,
            position: i,
          })),
        },
        citations: { create: scene.citationIds.map((citationId) => ({ citationId })) },
      },
    });
  }
  return script;
}

/** Create a documentary from an article, with a first script built from the article's text. */
export async function createDocumentary(
  db: PrismaClient,
  actor: Actor,
  input: { articleId: string; projectId?: string | null },
) {
  requireEdit(actor);
  const article = await db.article.findUnique({ where: { id: input.articleId } });
  if (!article || article.deletedAt) throw new DocumentaryError("Article not found.");
  const base = slugify(`${article.slug}-documentary`, "documentary");
  let slug = base;
  for (let n = 2; await db.documentary.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
  const project =
    input.projectId ??
    (await db.contentProject.findFirst({ where: { articleId: article.id }, select: { id: true } }))
      ?.id ??
    null;

  const id = await db.$transaction(
    async (tx) => {
      const documentary = await tx.documentary.create({
        data: {
          slug,
          title: article.title,
          description: article.summary,
          language: article.locale,
          primaryEntityId: article.primaryEntityId,
          articleId: article.id,
          projectId: project,
        },
      });
      await writeScript(tx, documentary.id, article.id, 1);
      return documentary.id;
    },
    { timeout: 30_000 },
  );
  await recordAudit({
    action: "documentary.created",
    actor,
    target: { type: "documentary", id },
    metadata: { articleId: article.id },
  });
  return id;
}

/** Build a new script version from the article (e.g. after the article changed). */
export async function rebuildScript(db: PrismaClient, actor: Actor, documentaryId: string) {
  requireEdit(actor);
  const doc = await db.documentary.findUnique({
    where: { id: documentaryId },
    include: { scripts: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!doc?.articleId) throw new DocumentaryError("This documentary has no article to build from.");
  const version = (doc.scripts[0]?.version ?? 0) + 1;
  const script = await db.$transaction(
    async (tx) => {
      // Unfinished drafts are replaced; an approved script stays until the new one is approved.
      await tx.documentaryScript.updateMany({
        where: { documentaryId, status: { in: ["DRAFT", "REVIEW"] } },
        data: { status: "SUPERSEDED" },
      });
      return writeScript(tx, documentaryId, doc.articleId!, version);
    },
    { timeout: 30_000 },
  );
  await recordAudit({
    action: "documentary.script_rebuilt",
    actor,
    target: { type: "documentary", id: documentaryId },
    metadata: { version },
  });
  return script.id;
}

async function editableScene(db: PrismaClient, sceneId: string) {
  const scene = await db.documentaryScene.findUnique({
    where: { id: sceneId },
    include: { script: true },
  });
  if (!scene) throw new DocumentaryError("Scene not found.");
  if (scene.script.status !== "DRAFT")
    throw new DocumentaryError("Only draft scripts can be edited. Revise the script first.");
  return scene;
}

export interface SceneEdit {
  narration: string;
  visualDescription: string;
  onScreenText: string;
  durationSeconds: number;
  mediaIds: string[];
  citationIds: string[];
}

/**
 * Edit one scene. Narration is the editor's responsibility: it keeps the citations chosen here,
 * which must come from the article, and approval later requires at least one per scene.
 */
export async function updateScene(
  db: PrismaClient,
  actor: Actor,
  sceneId: string,
  edit: SceneEdit,
) {
  requireEdit(actor);
  const scene = await editableScene(db, sceneId);
  const narration = edit.narration.trim();
  if (narration.length > 2000)
    throw new DocumentaryError("Keep a scene's narration under 2,000 characters.");
  if (
    !Number.isFinite(edit.durationSeconds) ||
    edit.durationSeconds < 1 ||
    edit.durationSeconds > 600
  ) {
    throw new DocumentaryError("A scene lasts 1 to 600 seconds.");
  }
  const doc = await db.documentary.findUniqueOrThrow({ where: { id: scene.script.documentaryId } });
  if (edit.citationIds.length > 0) {
    // The article's citations: in its sections, or on its key-date claims.
    const articleId = doc.articleId ?? "-";
    const valid = await db.citation.count({
      where: { id: { in: edit.citationIds }, OR: [{ articleId }, { claim: { articleId } }] },
    });
    if (valid !== new Set(edit.citationIds).size)
      throw new DocumentaryError("Scenes can only cite the article's own citations.");
  }
  await db.$transaction([
    db.sceneAsset.deleteMany({ where: { sceneId } }),
    db.sceneCitation.deleteMany({ where: { sceneId } }),
    db.documentaryScene.update({
      where: { id: sceneId },
      data: {
        narration,
        visualDescription: edit.visualDescription.trim() || null,
        onScreenText: edit.onScreenText.trim() || null,
        durationSeconds: new Prisma.Decimal(edit.durationSeconds.toFixed(2)),
        status: edit.mediaIds.length > 0 ? "READY" : "ASSETS_NEEDED",
        assets: {
          create: edit.mediaIds.map((mediaId, position) => ({
            mediaId,
            position,
            motion: "push-in",
          })),
        },
        citations: { create: [...new Set(edit.citationIds)].map((citationId) => ({ citationId })) },
      },
    }),
  ]);
}

export async function moveScene(db: PrismaClient, actor: Actor, sceneId: string, delta: -1 | 1) {
  requireEdit(actor);
  const scene = await editableScene(db, sceneId);
  const other = await db.documentaryScene.findUnique({
    where: { scriptId_position: { scriptId: scene.scriptId, position: scene.position + delta } },
  });
  if (!other) return;
  await db.$transaction([
    db.documentaryScene.update({ where: { id: scene.id }, data: { position: -1 } }),
    db.documentaryScene.update({ where: { id: other.id }, data: { position: scene.position } }),
    db.documentaryScene.update({ where: { id: scene.id }, data: { position: other.position } }),
  ]);
}

export async function addScene(db: PrismaClient, actor: Actor, scriptId: string) {
  requireEdit(actor);
  const script = await db.documentaryScript.findUnique({
    where: { id: scriptId },
    include: { _count: { select: { scenes: true } } },
  });
  if (!script || script.status !== "DRAFT")
    throw new DocumentaryError("Only draft scripts can be edited.");
  return db.documentaryScene.create({
    data: {
      scriptId,
      position: script._count.scenes,
      narration: "",
      durationSeconds: new Prisma.Decimal(5),
      status: "DRAFT",
      visualDescription: "Needs narration, an image and a citation.",
    },
  });
}

export async function deleteScene(db: PrismaClient, actor: Actor, sceneId: string) {
  requireEdit(actor);
  const scene = await editableScene(db, sceneId);
  await db.$transaction(async (tx) => {
    await tx.documentaryScene.delete({ where: { id: sceneId } });
    const later = await tx.documentaryScene.findMany({
      where: { scriptId: scene.scriptId, position: { gt: scene.position } },
      orderBy: { position: "asc" },
    });
    for (const s of later)
      await tx.documentaryScene.update({ where: { id: s.id }, data: { position: s.position - 1 } });
  });
}

/** "1, 2, 3, 5, 7, 8" → "1–3, 5, 7–8". */
export function sceneRanges(numbers: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < numbers.length;) {
    let j = i;
    while (j + 1 < numbers.length && numbers[j + 1] === numbers[j]! + 1) j += 1;
    parts.push(j > i ? `${numbers[i]}–${numbers[j]}` : String(numbers[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

/** Problems that block approval, in plain words (empty when the script can be approved). */
export async function approvalProblems(db: PrismaClient, scriptId: string): Promise<string[]> {
  const script = await db.documentaryScript.findUniqueOrThrow({
    where: { id: scriptId },
    include: {
      documentary: { include: { article: true } },
      scenes: {
        orderBy: { position: "asc" },
        include: { _count: { select: { citations: true, assets: true } } },
      },
    },
  });
  const problems: string[] = [];
  const article = script.documentary.article;
  if (!article || !PUBLIC.includes(article.status)) {
    problems.push(
      "The article must be published first: a documentary narrates editorially approved text.",
    );
  }
  if (script.scenes.length === 0) problems.push("The script has no scenes.");
  const numbers = (keep: (scene: (typeof script.scenes)[number]) => boolean) =>
    script.scenes.filter(keep).map((scene) => scene.position + 1);
  const report = (list: number[], one: string, many: string) => {
    if (list.length === 1) problems.push(`Scene ${list[0]} ${one}.`);
    else if (list.length > 1) problems.push(`Scenes ${sceneRanges(list)} ${many}.`);
  };
  report(
    numbers((sc) => !sc.narration.trim()),
    "has no narration",
    "have no narration",
  );
  report(
    numbers((sc) => sc._count.citations === 0),
    "cites no source",
    "cite no source",
  );
  report(
    numbers((sc) => sc._count.assets === 0),
    "has no image",
    "have no image",
  );
  return problems;
}

export async function submitScript(db: PrismaClient, actor: Actor, scriptId: string) {
  requireEdit(actor);
  const script = await db.documentaryScript.findUnique({ where: { id: scriptId } });
  if (script?.status !== "DRAFT")
    throw new DocumentaryError("Only a draft can be submitted for review.");
  await db.$transaction([
    db.documentaryScript.update({ where: { id: scriptId }, data: { status: "REVIEW" } }),
    db.documentary.update({ where: { id: script.documentaryId }, data: { status: "REVIEW" } }),
  ]);
  await recordAudit({
    action: "documentary.script_submitted",
    actor,
    target: { type: "script", id: scriptId },
  });
}

/** Editor approval of the script: the narration text is final for this version. */
export async function approveScript(db: PrismaClient, actor: Actor, scriptId: string) {
  if (!hasPermission(actor.role, "article:review"))
    throw new DocumentaryError("Only editors approve scripts.");
  const script = await db.documentaryScript.findUnique({ where: { id: scriptId } });
  if (script?.status !== "REVIEW")
    throw new DocumentaryError("Only a script in review can be approved.");
  const problems = await approvalProblems(db, scriptId);
  if (problems.length > 0) throw new DocumentaryError(`Cannot approve yet: ${problems.join(" ")}`);
  await db.$transaction([
    db.documentaryScript.updateMany({
      where: { documentaryId: script.documentaryId, status: "APPROVED" },
      data: { status: "SUPERSEDED" },
    }),
    db.documentaryScript.update({
      where: { id: scriptId },
      data: { status: "APPROVED", approvedById: userIdOf(actor), approvedAt: new Date() },
    }),
    db.documentary.update({ where: { id: script.documentaryId }, data: { status: "APPROVED" } }),
  ]);
  await recordAudit({
    action: "documentary.script_approved",
    actor,
    target: { type: "script", id: scriptId },
  });
}

export async function returnScriptToDraft(
  db: PrismaClient,
  actor: Actor,
  scriptId: string,
  note: string,
) {
  if (!hasPermission(actor.role, "article:review"))
    throw new DocumentaryError("Only editors review scripts.");
  if (note.trim().length < 5) throw new DocumentaryError("Say what needs to change.");
  const script = await db.documentaryScript.findUnique({ where: { id: scriptId } });
  if (script?.status !== "REVIEW")
    throw new DocumentaryError("Only a script in review can be sent back.");
  await db.$transaction([
    db.documentaryScript.update({ where: { id: scriptId }, data: { status: "DRAFT" } }),
    db.documentary.update({ where: { id: script.documentaryId }, data: { status: "DRAFT" } }),
  ]);
  await recordAudit({
    action: "documentary.script_changes_requested",
    actor,
    target: { type: "script", id: scriptId },
    metadata: { note: note.trim() },
  });
}

/** Start a new draft version from an approved script, keeping its scenes, images and citations. */
export async function reviseScript(db: PrismaClient, actor: Actor, scriptId: string) {
  requireEdit(actor);
  const source = await db.documentaryScript.findUnique({
    where: { id: scriptId },
    include: {
      scenes: { orderBy: { position: "asc" }, include: { assets: true, citations: true } },
    },
  });
  if (source?.status !== "APPROVED")
    throw new DocumentaryError("Only an approved script is revised; edit drafts directly.");
  const open = await db.documentaryScript.findFirst({
    where: { documentaryId: source.documentaryId, status: { in: ["DRAFT", "REVIEW"] } },
  });
  if (open) throw new DocumentaryError("A newer draft already exists.");
  const latest = await db.documentaryScript.findFirstOrThrow({
    where: { documentaryId: source.documentaryId },
    orderBy: { version: "desc" },
  });
  const created = await db.$transaction(async (tx) => {
    const script = await tx.documentaryScript.create({
      data: {
        documentaryId: source.documentaryId,
        version: latest.version + 1,
        targetDurationSeconds: source.targetDurationSeconds,
        language: source.language,
        narrationStyle: source.narrationStyle,
      },
    });
    for (const s of source.scenes) {
      await tx.documentaryScene.create({
        data: {
          scriptId: script.id,
          position: s.position,
          beat: s.beat,
          narration: s.narration,
          visualDescription: s.visualDescription,
          onScreenText: s.onScreenText,
          durationSeconds: s.durationSeconds,
          transition: s.transition,
          status: s.assets.length > 0 ? "READY" : "ASSETS_NEEDED",
          assets: {
            create: s.assets.map((a) => ({
              mediaId: a.mediaId,
              position: a.position,
              motion: a.motion,
            })),
          },
          citations: { create: s.citations.map((c) => ({ citationId: c.citationId })) },
        },
      });
    }
    return script;
  });
  return created.id;
}

/** Pronunciation guide used for narration: "word = how to say it", one per line. */
export async function setLexicon(
  db: PrismaClient,
  actor: Actor,
  documentaryId: string,
  text: string,
) {
  requireEdit(actor);
  const entries: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [word, say] = line.split("=").map((x) => x?.trim() ?? "");
    if (!line.trim()) continue;
    if (!word || !say)
      throw new DocumentaryError(
        `Write each entry as "word = how to say it" (problem: “${line.trim()}”).`,
      );
    entries[word] = say;
  }
  if (Object.keys(entries).length > 200)
    throw new DocumentaryError("Keep the guide under 200 entries.");
  await db.documentary.update({ where: { id: documentaryId }, data: { lexicon: entries } });
}

export function spokenText(narration: string, lexicon: unknown) {
  return narrationText(narration, (lexicon ?? {}) as Record<string, string>);
}

export { BEATS, estimateSpeechSeconds };
