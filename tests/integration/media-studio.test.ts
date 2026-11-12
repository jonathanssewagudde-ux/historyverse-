import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { licenses } from "../../prisma/seed";
import { reviewMedia } from "@/server/admin/media";
import type { ConfiguredImageModel } from "@/server/ai/images";
import { mediaPublishBlocker } from "@/server/content/publish";
import { getDb } from "@/server/db/client";
import { getQueue } from "@/server/jobs/queue";
import { runJob } from "@/server/jobs/runner";
import { approveJobCost } from "@/server/jobs/service";
import {
  createMediaSearchHandler,
  rejectCandidate,
  requestMediaSearch,
  selectCandidate,
} from "@/server/media/discovery";
import {
  createImageGenerationHandler,
  requestGeneration,
  reviewReconstruction,
  saveReconstruction,
  suggestPrompt,
  uploadReconstruction,
  type ReconstructionInput,
} from "@/server/media/reconstructions";
import { createCommonsClient } from "@/server/sources/commons/client";
import type { SourceHttpClient } from "@/server/sources/http";
import { createLocalStorage } from "@/server/storage/local";

/**
 * Milestone 9 against the real test database: archive discovery with a recorded Commons
 * response, evidence-based reconstruction prompts, paid generation with a test-double image
 * model, and the labelling rules.
 */

const http: SourceHttpClient = {
  async getJson<T>(url: string): Promise<T> {
    if (url.includes("commons.wikimedia.org") && url.includes("generator=search")) {
      return JSON.parse(
        readFileSync("tests/fixtures/research/commons-search-buganda.json", "utf8"),
      ) as T;
    }
    throw new Error(`Unexpected request in test: ${url}`);
  },
  async getBytes() {
    throw new Error("No downloads in tests");
  },
};
const searchHandler = createMediaSearchHandler({
  commons: createCommonsClient(http),
  http,
  locEnabled: false,
});

const png = readFileSync("tests/fixtures/media/king-mwanga-ii-buganda.jpg"); // a real JPEG
const storage = createLocalStorage(mkdtempSync(path.join(tmpdir(), "hv-recon-")));

let db: PrismaClient;
const admin = { id: "ms-admin", email: "a@ms.invalid", role: "ADMINISTRATOR" as const };
const researcher = { id: "ms-researcher", email: "r@ms.invalid", role: "RESEARCHER" as const };
const editor = { id: "ms-editor", email: "e@ms.invalid", role: "EDITOR" as const };
let projectId: string;
let entityId: string;
let sourceId: string;

beforeAll(async () => {
  db = getDb();
  for (const license of licenses) await db.mediaLicense.create({ data: license });
  await db.user.createMany({
    data: [
      { id: admin.id, name: "Ms Admin", email: admin.email, role: "ADMINISTRATOR" },
      { id: researcher.id, name: "Ms Researcher", email: researcher.email, role: "RESEARCHER" },
      { id: editor.id, name: "Ms Editor", email: editor.email, role: "EDITOR" },
    ],
  });
  entityId = (
    await db.entity.create({ data: { kind: "KINGDOM", slug: "ms-buganda", name: "Buganda" } })
  ).id;
  projectId = (
    await db.contentProject.create({
      data: {
        slug: "ms-project",
        topic: "Buganda",
        primaryEntityId: entityId,
        budgetUsd: new Prisma.Decimal(1),
      },
    })
  ).id;
  sourceId = (
    await db.source.create({
      data: {
        type: "BOOK",
        title: "The Kabaka's Court",
        authors: ["A. Historian"],
        url: "https://example.org/book",
      },
    })
  ).id;
  await getQueue()?.obliterate({ force: true });
});

afterAll(async () => {
  await getQueue()?.close();
});

describe("archival media discovery", () => {
  it("finds images with the licence each archive states, in relevance order", async () => {
    const { job } = await requestMediaSearch(db, researcher, projectId);
    expect(await runJob(db, job.id, { MEDIA_SEARCH: searchHandler })).toBe("succeeded");
    const candidates = await db.mediaCandidate.findMany({ where: { projectId } });
    expect(candidates.length).toBeGreaterThan(10);
    expect(candidates.every((c) => c.status === "CANDIDATE" && c.provider === "commons")).toBe(
      true,
    );
    expect(
      candidates.every((c) => c.licenseCode && c.attribution.includes("via Wikimedia Commons")),
    ).toBe(true);
    expect(
      candidates.some((c) =>
        /^https:\/\/(thumb|upload)\.wikimedia\.org\//.test(c.thumbnailUrl ?? ""),
      ),
    ).toBe(true);
  });

  it("adds an image to the library only after the licence is confirmed, linked to the subject", async () => {
    const candidate = await db.mediaCandidate.findFirstOrThrow({
      where: { projectId, licenseCode: "CC0-1.0" },
    });
    await expect(
      selectCandidate(db, researcher, candidate.id, { licenseConfirmed: false }),
    ).rejects.toThrow(/Confirm that you checked the licence/);
    const { mediaId, license, publishable } = await selectCandidate(db, researcher, candidate.id, {
      licenseConfirmed: true,
      note: "Checked the file page",
    });
    expect({ license, publishable }).toEqual({ license: "CC0-1.0", publishable: true });
    const asset = await db.mediaAsset.findUniqueOrThrow({
      where: { id: mediaId },
      include: { entities: true },
    });
    expect(asset).toMatchObject({
      kind: "UNCLASSIFIED",
      reviewStatus: "PENDING",
      sourceName: "Wikimedia Commons",
      sourceRef: candidate.sourceRef,
      licenseVerifiedById: researcher.id,
    });
    expect(asset.entities.map((e) => e.entityId)).toEqual([entityId]);
    await expect(
      selectCandidate(db, researcher, candidate.id, { licenseConfirmed: true }),
    ).rejects.toThrow(/already in the library/);
  });

  it("needs a reason to reject, and the database refuses an unreviewed decision", async () => {
    const candidate = await db.mediaCandidate.findFirstOrThrow({
      where: { projectId, status: "CANDIDATE" },
    });
    await expect(rejectCandidate(db, researcher, candidate.id, "")).rejects.toThrow(/why/);
    await rejectCandidate(db, researcher, candidate.id, "Modern sports photo, off topic");
    await expect(
      db.$executeRaw`UPDATE "media_candidates" SET "status" = 'SELECTED', "reviewedAt" = NULL WHERE "id" = ${candidate.id}`,
    ).rejects.toThrow(/media_candidates_decision_reviewed/);
  });

  it("records the licence check when an editor approves an upload in the library", async () => {
    const pd = await db.mediaLicense.findUniqueOrThrow({ where: { code: "PD" } });
    const asset = await db.mediaAsset.create({
      data: {
        kind: "ARTWORK",
        title: "Engraving",
        altText: "An engraving of a court",
        sourceName: "Test",
        attribution: "Test",
        licenseId: pd.id,
        storageKey: "media/xx/engraving.jpg",
      },
    });
    await reviewMedia(db, editor, asset.id, "APPROVED");
    expect(await db.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } })).toMatchObject({
      licenseVerifiedById: editor.id,
    });
  });
});

describe("reconstructions", () => {
  const input = (overrides: Partial<ReconstructionInput> = {}): ReconstructionInput => ({
    projectId,
    prompt:
      "Documentary illustration of the royal enclosure at Mengo with bark-cloth garments and thatched halls.",
    negativePrompt: "text, logos",
    evidenceNotes:
      "Bark-cloth garments and the thatched halls follow the cited description of the court.",
    interpretationNotes: "Faces, weather and colours are invented.",
    sources: [{ sourceId, note: "Describes the halls and garments" }],
    ...overrides,
  });
  let reconId: string;

  it("requires evidence, interpretation notes and a cited source", async () => {
    await expect(saveReconstruction(db, researcher, input({ sources: [] }))).rejects.toThrow(
      /at least one source/,
    );
    await expect(
      saveReconstruction(db, researcher, input({ interpretationNotes: "" })),
    ).rejects.toThrow(/interpretation/);
    await expect(
      saveReconstruction(
        db,
        researcher,
        input({ prompt: "Scene: [describe the setting from the sources] at the court." }),
      ),
    ).rejects.toThrow(/placeholders/);
    await expect(
      saveReconstruction(db, researcher, input({ sources: [{ sourceId, note: "" }] })),
    ).rejects.toThrow(/what it tells us/);
    reconId = await saveReconstruction(db, researcher, input());
    const saved = await db.aIReconstruction.findUniqueOrThrow({
      where: { id: reconId },
      include: { sources: true },
    });
    expect(saved).toMatchObject({ status: "PROMPT_DRAFT", entityId, createdById: researcher.id });
    expect(saved.sources).toHaveLength(1);
  });

  it("suggests a starting prompt from the subject, with placeholders to fill from sources", async () => {
    const { prompt, negativePrompt } = await suggestPrompt(db, projectId);
    expect(prompt).toContain("Buganda");
    expect(prompt).toContain("[describe the setting from the sources]");
    expect(negativePrompt).toContain("watermarks");
  });

  /** An image-model test double returning real image bytes. */
  const model =
    (perImageUsd: number, fail = false): (() => ConfiguredImageModel) =>
    () => ({
      perImageUsd,
      provider: {
        id: "test:images",
        estimateCost: (r) => ({
          currency: "USD",
          amount: perImageUsd * (r.variations ?? 1),
          basis: "test",
        }),
        async generate(r) {
          if (fail) throw new Error("Image generation failed (400).");
          return Array.from({ length: r.variations ?? 1 }, (_, i) => ({
            image: new Uint8Array([...png, i]), // distinct bytes per image
            mimeType: "image/jpeg",
          }));
        },
      },
    });

  it("says why generation is unavailable without a configured generator", async () => {
    await expect(requestGeneration(db, researcher, reconId, 2)).rejects.toThrow(
      /No image generator is configured/,
    );
  });

  it("generates paid images only after approval, stores them labelled, and records the cost", async () => {
    const { job, estimate } = await requestGeneration(db, researcher, reconId, 2, model(0.04));
    expect(estimate.amount).toBeCloseTo(0.08);
    expect(job.status).toBe("AWAITING_APPROVAL");
    await approveJobCost(db, admin, job.id, { monthlyCeilingUsd: 5 });

    const handler = createImageGenerationHandler(model(0.04), () => storage);
    expect(await runJob(db, job.id, { IMAGE_GENERATION: handler })).toBe("succeeded");
    const done = await db.productionJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(Number(done.actualCostUsd)).toBeCloseTo(0.08);
    expect(
      Number((await db.contentProject.findUniqueOrThrow({ where: { id: projectId } })).spentUsd),
    ).toBeCloseTo(0.08);

    const recon = await db.aIReconstruction.findUniqueOrThrow({
      where: { id: reconId },
      include: {
        media: { include: { license: true } },
        variations: { include: { sources: true } },
      },
    });
    expect(recon.status).toBe("GENERATED");
    expect(recon.media).toMatchObject({
      kind: "AI_RECONSTRUCTION",
      reviewStatus: "PENDING",
      altText: null,
    });
    expect(recon.media!.license.code).toBe("HV-ORIGINAL");
    expect(recon.media!.attribution).toMatch(
      /AI-generated historical reconstruction.*Not an authentic image/,
    );
    expect(recon.variations).toHaveLength(1);
    expect(recon.variations[0]!.sources).toHaveLength(1);
    expect(await storage.get(recon.media!.storageKey!)).toBeTruthy();

    // Not shown publicly, and not approved in bulk at publication, until an editor reviews it.
    expect(mediaPublishBlocker(recon.media!)).toMatch(/not yet approved in the AI Image Studio/);
    // The label is enforced by the database itself.
    await expect(
      db.mediaAsset.update({ where: { id: recon.mediaId! }, data: { kind: "AUTHENTIC_PHOTO" } }),
    ).rejects.toThrow(/cannot be relabelled/);
  });

  it("lets editors approve a reconstruction only with a description, keeping the label in the alt text", async () => {
    await expect(
      reviewReconstruction(db, researcher, reconId, "APPROVED", "A royal hall"),
    ).rejects.toThrow(/Only editors/);
    await expect(reviewReconstruction(db, editor, reconId, "APPROVED", "short")).rejects.toThrow(
      /Describe what the image shows/,
    );
    await reviewReconstruction(
      db,
      editor,
      reconId,
      "APPROVED",
      "A thatched royal hall with people in bark-cloth robes",
    );
    const media = await db.mediaAsset.findUniqueOrThrow({
      where: {
        id: (await db.aIReconstruction.findUniqueOrThrow({ where: { id: reconId } })).mediaId!,
      },
      include: { license: true },
    });
    expect(media).toMatchObject({
      reviewStatus: "APPROVED",
      altText: "AI reconstruction: A thatched royal hall with people in bark-cloth robes",
    });
    expect(mediaPublishBlocker(media)).toBeNull();
  });

  it("marks a failed generation and lets a person upload an image made elsewhere instead", async () => {
    const id = await saveReconstruction(db, researcher, input());
    const { job } = await requestGeneration(db, researcher, id, 1, model(0));
    expect(job.status).toBe("QUEUED");
    const failing = createImageGenerationHandler(model(0, true), () => storage);
    await db.productionJob.update({ where: { id: job.id }, data: { maxAttempts: 1 } });
    expect(await runJob(db, job.id, { IMAGE_GENERATION: failing })).toBe("failed");
    expect((await db.aIReconstruction.findUniqueOrThrow({ where: { id } })).status).toBe("FAILED");

    await expect(
      uploadReconstruction(db, storage, researcher, id, {
        body: new Uint8Array(png),
        toolName: "",
      }),
    ).rejects.toThrow(/Name the tool/);
    const mediaId = await uploadReconstruction(db, storage, researcher, id, {
      body: new Uint8Array([...png, 9, 9]),
      toolName: "a local Stable Diffusion",
    });
    expect(await db.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } })).toMatchObject({
      kind: "AI_RECONSTRUCTION",
      attribution: expect.stringContaining("made with a local Stable Diffusion"),
    });
    expect((await db.aIReconstruction.findUniqueOrThrow({ where: { id } })).status).toBe(
      "GENERATED",
    );
  });
});
