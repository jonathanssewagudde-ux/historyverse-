import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { hasPermission, type Role } from "@/lib/auth/roles";
import { getSpeech, type ConfiguredSpeech } from "@/server/ai/speech";
import { recordAudit } from "@/server/audit";
import { estimateMp3DurationMs, parseWav, sniffAudio } from "@/server/audio/audio";
import { createJob, JobServiceError, userIdOf } from "@/server/jobs/service";
import { JobCancelledError, PermanentJobError, type JobHandler } from "@/server/jobs/types";
import { ProviderUnavailableError, type StorageProvider } from "@/server/providers/contracts";
import { contentKey } from "@/server/storage/local";
import { DocumentaryError, spokenText } from "./documentaries";

type Actor = { id: string; email?: string | null; role: Role };

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
/** Silence left after the last word before the next scene starts. */
const TAIL_SECONDS = 0.6;

async function approvedScript(db: PrismaClient, scriptId: string) {
  const script = await db.documentaryScript.findUnique({
    where: { id: scriptId },
    include: { documentary: true, scenes: { orderBy: { position: "asc" } } },
  });
  if (!script) throw new DocumentaryError("Script not found.");
  if (script.status !== "APPROVED") {
    throw new DocumentaryError(
      "Narrate an approved script: its text is final, so narration is not wasted.",
    );
  }
  return script;
}

/**
 * Ask for narration of every scene of an approved script. Local engines are free and run at once;
 * paid voices wait for an administrator's approval within the project budget.
 */
export async function requestNarration(
  db: PrismaClient,
  actor: Actor,
  scriptId: string,
  speed = 1,
  speech: () => ConfiguredSpeech = () => getSpeech(),
) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new DocumentaryError("Only editors narrate documentaries.");
  if (!(speed >= 0.7 && speed <= 1.3))
    throw new DocumentaryError("Speed must be between 0.7 and 1.3.");
  const script = await approvedScript(db, scriptId);
  let configured: ConfiguredSpeech;
  try {
    configured = speech();
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw new DocumentaryError(error.message);
    throw error;
  }
  const text = script.scenes
    .map((s) => spokenText(s.narration, script.documentary.lexicon))
    .join("\n");
  const estimate = configured.provider.estimateCost({
    text,
    voiceId: configured.voiceId,
    language: script.language,
    speed,
  });
  try {
    const { job, queued } = await createJob(db, actor, {
      projectId: script.documentary.projectId,
      type: "NARRATION",
      input: {
        scriptId,
        speed,
        provider: configured.provider.id,
        voiceId: configured.voiceId,
        estimateBasis: estimate.basis,
      },
      costEstimateUsd: estimate.amount,
      maxAttempts: estimate.amount > 0 ? 1 : 2,
      subject: { key: "scriptId", value: scriptId },
    });
    return { job, queued, estimate, voiceLicense: configured.voiceLicense };
  } catch (error) {
    if (error instanceof JobServiceError) throw new DocumentaryError(error.message);
    throw error;
  }
}

async function storeTake(
  db: PrismaClient | Prisma.TransactionClient,
  input: {
    scriptId: string;
    sceneId: string;
    source: "SYNTHESIZED" | "UPLOADED_RECORDING";
    provider: string;
    voiceId: string | null;
    language: string;
    speed: number;
    storageKey: string;
    mimeType: string;
    durationMs: number | null;
    text: string;
    voiceLicense: string | null;
    costUsd: number | null;
  },
) {
  // Earlier takes stay as history; only the newest is current.
  await db.voiceover.updateMany({
    where: { sceneId: input.sceneId, isCurrent: true },
    data: { isCurrent: false },
  });
  const take = await db.voiceover.create({
    data: {
      ...input,
      speed: new Prisma.Decimal(input.speed.toFixed(2)),
      costUsd: input.costUsd !== null ? new Prisma.Decimal(input.costUsd.toFixed(4)) : null,
      status: "READY",
      isCurrent: true,
    },
  });
  const scene = await db.documentaryScene.findUniqueOrThrow({ where: { id: input.sceneId } });
  const needed = input.durationMs !== null ? input.durationMs / 1000 + TAIL_SECONDS : 0;
  await db.documentaryScene.update({
    where: { id: input.sceneId },
    data: {
      status: "NARRATED",
      // A scene lasts at least as long as its narration.
      ...(needed > Number(scene.durationSeconds)
        ? { durationSeconds: new Prisma.Decimal(needed.toFixed(2)) }
        : {}),
    },
  });
  return take;
}

/** The NARRATION job: synthesize each scene, store the audio, update scene timing, record cost. */
export function createNarrationHandler(
  getSpeechEngine: () => ConfiguredSpeech,
  getStorage: () => StorageProvider,
): JobHandler {
  return async (ctx) => {
    const { db } = ctx;
    const scriptId = String(ctx.input.scriptId ?? "");
    const speed = Number(ctx.input.speed ?? 1);
    const job = await db.productionJob.findUniqueOrThrow({ where: { id: ctx.jobId } });
    if (Number(job.costEstimateUsd ?? 0) > 0 && !job.approvedAt) {
      throw new PermanentJobError("The cost of this narration was not approved.");
    }
    const script = await db.documentaryScript.findUnique({
      where: { id: scriptId },
      include: { documentary: true, scenes: { orderBy: { position: "asc" } } },
    });
    if (!script || script.status !== "APPROVED")
      throw new PermanentJobError("The script is no longer approved.");
    const { provider, voiceId, voiceLicense } = getSpeechEngine();
    const storage = getStorage();
    let total = 0;
    let narrated = 0;
    for (const [i, scene] of script.scenes.entries()) {
      if (await ctx.isCancelled()) throw new JobCancelledError();
      await ctx.progress(
        (i / script.scenes.length) * 95,
        `Narrating scene ${i + 1} of ${script.scenes.length}`,
      );
      const text = spokenText(scene.narration, script.documentary.lexicon);
      if (!text) continue;
      const request = { text, voiceId, language: script.language, speed };
      const cost = provider.estimateCost(request).amount;
      const audio = await provider.synthesize(request);
      // Charged per scene as it is spoken, so a failure part-way records what was spent.
      await ctx.recordCost(cost);
      total += cost;
      const { key } = contentKey(
        audio.audio,
        audio.mimeType === "audio/wav" ? "wav" : "mp3",
        "narration",
      );
      await storage.put(key, audio.audio, audio.mimeType);
      await storeTake(db, {
        scriptId,
        sceneId: scene.id,
        source: "SYNTHESIZED",
        provider: provider.id,
        voiceId,
        language: script.language,
        speed,
        storageKey: key,
        mimeType: audio.mimeType,
        durationMs: audio.durationMs,
        text,
        voiceLicense,
        costUsd: cost,
      });
      narrated += 1;
    }
    return {
      output: {
        scriptId,
        scenes: narrated,
        provider: provider.id,
        voiceId,
        costUsd: Number(total.toFixed(4)),
      },
    };
  };
}

/**
 * Upload a recorded narration for one scene. A person's voice is theirs: the uploader confirms
 * the speaker agreed to publication, and that is recorded with the take.
 */
export async function uploadNarration(
  db: PrismaClient,
  storage: StorageProvider,
  actor: Actor,
  sceneId: string,
  input: { body: Uint8Array; speaker: string; consentConfirmed: boolean },
) {
  if (!hasPermission(actor.role, "documentary:edit"))
    throw new DocumentaryError("Only editors narrate documentaries.");
  const speaker = input.speaker.trim();
  if (speaker.length < 2) throw new DocumentaryError("Name the person speaking.");
  if (!input.consentConfirmed) {
    throw new DocumentaryError("Confirm that the speaker agreed to their voice being published.");
  }
  if (input.body.byteLength === 0 || input.body.byteLength > MAX_AUDIO_BYTES) {
    throw new DocumentaryError("Choose a WAV or MP3 file of 50 MB or less.");
  }
  const type = sniffAudio(input.body);
  if (!type) throw new DocumentaryError("Only WAV and MP3 recordings can be uploaded.");
  const scene = await db.documentaryScene.findUnique({
    where: { id: sceneId },
    include: { script: { include: { documentary: true } } },
  });
  if (!scene) throw new DocumentaryError("Scene not found.");
  if (scene.script.status !== "APPROVED") {
    throw new DocumentaryError("Record narration for an approved script: its text is final.");
  }
  const durationMs =
    type.mime === "audio/wav"
      ? (parseWav(input.body)?.durationMs ?? null)
      : estimateMp3DurationMs(input.body);
  const { key } = contentKey(input.body, type.ext, "narration");
  await storage.put(key, input.body, type.mime);
  const take = await storeTake(db, {
    scriptId: scene.scriptId,
    sceneId,
    source: "UPLOADED_RECORDING",
    provider: "recording",
    voiceId: speaker,
    language: scene.script.language,
    speed: 1,
    storageKey: key,
    mimeType: type.mime,
    durationMs,
    text: spokenText(scene.narration, scene.script.documentary.lexicon),
    voiceLicense: `Recorded by ${speaker}; consent to publish confirmed by ${actor.email ?? "a Studio editor"} on ${new Date().toISOString().slice(0, 10)}`,
    costUsd: null,
  });
  await recordAudit({
    action: "narration.uploaded",
    actor,
    target: { type: "voiceover", id: take.id },
    metadata: { sceneId, speaker, uploadedBy: userIdOf(actor) },
  });
  return take.id;
}
