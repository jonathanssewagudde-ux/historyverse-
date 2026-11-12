import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { licenses } from "../../prisma/seed";
import { getSpeech, type ConfiguredSpeech } from "@/server/ai/speech";
import { parseWav, pcmToWav } from "@/server/audio/audio";
import { loadArticle } from "@/server/content/load-article";
import { publishArticle } from "@/server/content/publish";
import { approveResearch, submitForReview } from "@/server/content/workflow";
import { getDb } from "@/server/db/client";
import {
  approvalProblems,
  deleteScene,
  approveScript,
  createDocumentary,
  rebuildScript,
  returnScriptToDraft,
  reviseScript,
  setLexicon,
  submitScript,
  updateScene,
} from "@/server/documentary/documentaries";
import {
  createNarrationHandler,
  requestNarration,
  uploadNarration,
} from "@/server/documentary/narration";
import { BEATS } from "@/server/documentary/structure";
import { parseServerEnv } from "@/server/env";
import { getQueue } from "@/server/jobs/queue";
import { runJob } from "@/server/jobs/runner";
import { createLocalStorage } from "@/server/storage/local";

/**
 * Documentary scripts and narration, from the real Buganda article file. Narration uses the real
 * eSpeak NG engine (free, local; installed in CI) and a paid-voice test double for the budget path.
 */

const bugandaFile = JSON.parse(readFileSync("data/articles/buganda-kingdom.json", "utf8"));
const storage = createLocalStorage(mkdtempSync(path.join(tmpdir(), "hv-narration-")));
const espeak = () => getSpeech(parseServerEnv({ TTS_PROVIDER: "espeak" }).env);

let db: PrismaClient;
const editor = { id: "doc-editor", email: "e@doc.invalid", role: "EDITOR" as const };
const researcher = { id: "doc-researcher", email: "r@doc.invalid", role: "RESEARCHER" as const };
let articleId: string;
let documentaryId: string;
let scriptId: string;

beforeAll(async () => {
  db = getDb();
  for (const license of licenses) await db.mediaLicense.create({ data: license });
  await db.user.createMany({
    data: [
      { id: editor.id, name: "Doc Editor", email: editor.email, role: "EDITOR" },
      { id: researcher.id, name: "Doc Researcher", email: researcher.email, role: "RESEARCHER" },
    ],
  });
  for (const e of [
    { qid: "Q473748", kind: "KINGDOM" as const, slug: "buganda", name: "Buganda" },
    { qid: "Q1036", kind: "COUNTRY" as const, slug: "uganda", name: "Uganda" },
    { qid: "Q889311", kind: "PERSON" as const, slug: "muteesa-i", name: "Muteesa I" },
  ]) {
    await db.entity.create({
      data: { wikidataId: e.qid, kind: e.kind, slug: e.slug, name: e.name },
    });
  }
  const pd = await db.mediaLicense.findUniqueOrThrow({ where: { code: "PD" } });
  const nc = await db.mediaLicense.findUniqueOrThrow({ where: { code: "CC-BY-NC-4.0" } });
  for (const m of [
    { ref: "File:King Mwanga II Buganda.jpg", licenseId: pd.id, storageKey: "media/aa/mwanga.jpg" },
    { ref: "File:Mutesa I.jpg", licenseId: nc.id, storageKey: "media/aa/mutesa.jpg" },
  ]) {
    await db.mediaAsset.create({
      data: {
        kind: "UNCLASSIFIED",
        title: m.ref.replace("File:", "").replace(/\.[a-z]+$/i, ""),
        sourceName: "Wikimedia Commons",
        sourceRef: m.ref,
        attribution: "test",
        licenseId: m.licenseId,
        storageKey: m.storageKey,
        mimeType: "image/jpeg",
      },
    });
  }
  articleId = (await loadArticle(db, bugandaFile)).articleId;
});

afterAll(async () => {
  await getQueue()?.close();
});

describe("script from the article", () => {
  it("only editors create documentaries", async () => {
    await expect(createDocumentary(db, researcher, { articleId })).rejects.toThrow(/Only editors/);
  });

  it("follows the documentary structure, keeping the article's text and citations", async () => {
    documentaryId = await createDocumentary(db, editor, { articleId });
    const script = await db.documentaryScript.findFirstOrThrow({
      where: { documentaryId },
      include: {
        scenes: {
          orderBy: { position: "asc" },
          include: {
            citations: { include: { citation: { include: { claim: true } } } },
            assets: true,
          },
        },
      },
    });
    scriptId = script.id;
    const beats = script.scenes.map((s) => s.beat!);
    expect(beats[0]).toBe("hook");
    // Beats appear in the documentary order and never go backwards.
    const order = beats.map((b) => BEATS.indexOf(b as (typeof BEATS)[number]));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(beats).toContain("turning-points");
    expect(beats).toContain("conclusion");
    expect(beats.at(-1)).toBe("conclusion");

    expect(script.scenes[0]!.onScreenText).toBe("The Complete History of the Buganda Kingdom");
    // Narration is the article's text with citation markers removed.
    expect(script.scenes.every((s) => !/\[\^\d+\]|\[@/.test(s.narration))).toBe(true);
    // Every scene keeps the citations of its own paragraph. The article's one uncited paragraph
    // (an editorial note) stays uncited: it is flagged, never given a neighbour's citations.
    const uncited = script.scenes.filter((s) => s.citations.length === 0);
    expect(uncited.map((s) => s.narration)).toEqual([
      expect.stringMatching(
        /^HISTORYVERSE presents both accounts rather than choosing between them/,
      ),
    ]);
    expect(
      // Citations come from the article's sections or from its key-date claims.
      script.scenes.every((s) =>
        s.citations.every(
          (c) => (c.citation.articleId ?? c.citation.claim?.articleId) === articleId,
        ),
      ),
    ).toBe(true);
    // The unpublished article's images are not approved yet, so scenes still need images.
    expect(script.scenes.every((s) => s.status === "ASSETS_NEEDED")).toBe(true);
    expect(script.targetDurationSeconds).toBeGreaterThan(120);
  });

  it("cannot be approved until the article is published and every scene has an image", async () => {
    await submitScript(db, editor, scriptId);
    await expect(approveScript(db, editor, scriptId)).rejects.toThrow(
      /article must be published first/,
    );
    await returnScriptToDraft(db, editor, scriptId, "Waiting for the article to be published.");

    // Publish the article through the normal workflow; this approves its publishable images.
    await db.mediaAsset.update({
      where: {
        sourceName_sourceRef: {
          sourceName: "Wikimedia Commons",
          sourceRef: "File:King Mwanga II Buganda.jpg",
        },
      },
      data: { altText: "Engraving of Kabaka Mwanga II" },
    });
    await submitForReview(db, researcher, articleId);
    await approveResearch(db, editor, articleId);
    await publishArticle(db, editor, articleId);

    // A rebuilt script now gets the approved engraving; the non-commercial photo is never used.
    scriptId = await rebuildScript(db, editor, documentaryId);
    const scenes = await db.documentaryScene.findMany({
      where: { scriptId },
      include: { assets: { include: { media: true } } },
    });
    expect(scenes.every((s) => s.status === "READY")).toBe(true);
    expect(new Set(scenes.flatMap((s) => s.assets.map((a) => a.media.title)))).toEqual(
      new Set(["King Mwanga II Buganda"]),
    );
    const problems = await approvalProblems(db, scriptId);
    expect(problems).toEqual([expect.stringMatching(/^Scene \d+ cites no source\.$/)]);
    // The editor removes the uncited editorial note from the narration.
    const note = await db.documentaryScene.findFirstOrThrow({
      where: { scriptId, citations: { none: {} } },
    });
    await deleteScene(db, editor, note.id);
    expect(await approvalProblems(db, scriptId)).toEqual([]);
  });

  it("edits scenes only in drafts, with citations from the article only", async () => {
    const scene = await db.documentaryScene.findFirstOrThrow({
      where: { scriptId, position: 0 },
      include: { assets: true, citations: true },
    });
    const other = await db.historicalClaim.create({
      data: {
        statement: "An unrelated claim.",
        citations: {
          create: { source: { create: { type: "BOOK", title: "Unrelated", authors: [] } } },
        },
      },
      include: { citations: true },
    });
    const foreign = other.citations[0]!;
    const edit = {
      narration: scene.narration,
      visualDescription: "Engraving of the kabaka",
      onScreenText: "Buganda",
      durationSeconds: 12,
      mediaIds: scene.assets.map((a) => a.mediaId),
      citationIds: [...scene.citations.map((c) => c.citationId), foreign.id],
    };
    await expect(updateScene(db, editor, scene.id, edit)).rejects.toThrow(
      /article's own citations/,
    );
    await updateScene(db, editor, scene.id, {
      ...edit,
      citationIds: scene.citations.map((c) => c.citationId),
    });
    expect(
      (await db.documentaryScene.findUniqueOrThrow({ where: { id: scene.id } })).onScreenText,
    ).toBe("Buganda");

    await submitScript(db, editor, scriptId);
    await expect(updateScene(db, editor, scene.id, edit)).rejects.toThrow(/Only draft scripts/);
    await approveScript(db, editor, scriptId);
    expect(await db.documentary.findUniqueOrThrow({ where: { id: documentaryId } })).toMatchObject({
      status: "APPROVED",
    });
  });
});

describe("narration", () => {
  it("speaks every scene with the free local engine, with the pronunciation guide applied", async () => {
    await setLexicon(db, editor, documentaryId, "Kabaka = kah-BAH-kah\nBuganda = boo-GAHN-dah");
    await expect(setLexicon(db, editor, documentaryId, "broken line")).rejects.toThrow(
      /word = how to say it/,
    );

    const { job, estimate, voiceLicense } = await requestNarration(db, editor, scriptId, 1, espeak);
    expect(estimate.amount).toBe(0);
    expect(job.status).toBe("QUEUED");
    expect(voiceLicense).toMatch(/eSpeak NG/);
    await expect(requestNarration(db, editor, scriptId, 1, espeak)).rejects.toThrow(
      /already queued/,
    );

    expect(
      await runJob(db, job.id, { NARRATION: createNarrationHandler(espeak, () => storage) }),
    ).toBe("succeeded");
    const scenes = await db.documentaryScene.findMany({
      where: { scriptId },
      orderBy: { position: "asc" },
      include: { voiceovers: { where: { isCurrent: true } } },
    });
    expect(scenes.every((s) => s.status === "NARRATED" && s.voiceovers.length === 1)).toBe(true);
    for (const s of scenes) {
      const take = s.voiceovers[0]!;
      expect(take).toMatchObject({
        provider: "espeak",
        mimeType: "audio/wav",
        status: "READY",
        source: "SYNTHESIZED",
      });
      const audio = await storage.get(take.storageKey!);
      expect(parseWav(audio!)!.durationMs).toBe(take.durationMs);
      // A scene lasts at least as long as its narration.
      expect(Number(s.durationSeconds)).toBeGreaterThanOrEqual(take.durationMs! / 1000);
    }
    const spoken = scenes.map((s) => s.voiceovers[0]!.text).join(" ");
    expect(spoken).toContain("boo-GAHN-dah");
    expect(spoken).not.toMatch(/\bBuganda\b/);
  }, 120_000);

  it("charges paid voices only after approval, within the project budget", async () => {
    const paid = (): ConfiguredSpeech => ({
      voiceId: "stock",
      voiceLicense: "Stock synthetic voice",
      provider: {
        id: "test:paid",
        listVoices: async () => [],
        estimateCost: (r) => ({
          currency: "USD",
          amount: Number((r.text.length * 0.00003).toFixed(4)),
          basis: "test",
        }),
        synthesize: async () => ({
          audio: pcmToWav(new Uint8Array(22_050 * 2), 22_050),
          mimeType: "audio/wav",
          durationMs: 1000,
        }),
      },
    });
    await expect(requestNarration(db, editor, scriptId, 1, paid)).rejects.toThrow(
      /Paid steps need a project/,
    );
    const project = await db.contentProject.create({
      data: { slug: "doc-project", topic: "Buganda", articleId, budgetUsd: new Prisma.Decimal(0) },
    });
    await db.documentary.update({ where: { id: documentaryId }, data: { projectId: project.id } });
    const { job, estimate } = await requestNarration(db, editor, scriptId, 1, paid);
    expect(estimate.amount).toBeGreaterThan(0);
    expect(job.status).toBe("AWAITING_APPROVAL");
  });

  it("accepts a recorded narration only with the speaker's consent, keeping earlier takes", async () => {
    const scene = await db.documentaryScene.findFirstOrThrow({ where: { scriptId, position: 0 } });
    const wav = pcmToWav(new Uint8Array(22_050 * 2 * 3), 22_050); // three seconds
    await expect(
      uploadNarration(db, storage, editor, scene.id, {
        body: wav,
        speaker: "Nalwoga",
        consentConfirmed: false,
      }),
    ).rejects.toThrow(/agreed to their voice being published/);
    await expect(
      uploadNarration(db, storage, editor, scene.id, {
        body: new TextEncoder().encode("not audio"),
        speaker: "Nalwoga",
        consentConfirmed: true,
      }),
    ).rejects.toThrow(/Only WAV and MP3/);
    await uploadNarration(db, storage, editor, scene.id, {
      body: wav,
      speaker: "Nalwoga",
      consentConfirmed: true,
    });
    const takes = await db.voiceover.findMany({
      where: { sceneId: scene.id },
      orderBy: { createdAt: "asc" },
    });
    expect(takes.map((t) => [t.source, t.isCurrent])).toEqual([
      ["SYNTHESIZED", false],
      ["UPLOADED_RECORDING", true],
    ]);
    expect(takes[1]).toMatchObject({
      durationMs: 3000,
      voiceLicense: expect.stringContaining("Recorded by Nalwoga; consent"),
    });
    // The database allows only one current take per scene.
    await expect(
      db.voiceover.updateMany({ where: { sceneId: scene.id }, data: { isCurrent: true } }),
    ).rejects.toThrow();
  });

  it("revises an approved script as a new draft version with the same scenes", async () => {
    const revised = await reviseScript(db, editor, scriptId);
    const [before, after] = await Promise.all([
      db.documentaryScene.count({ where: { scriptId } }),
      db.documentaryScene.count({ where: { scriptId: revised } }),
    ]);
    expect(after).toBe(before);
    expect(await db.documentaryScript.findUniqueOrThrow({ where: { id: revised } })).toMatchObject({
      status: "DRAFT",
      version: 3,
    });
    await expect(reviseScript(db, editor, scriptId)).rejects.toThrow(/newer draft already exists/);
  });
});
