-- AlterTable
ALTER TABLE "documentaries" ADD COLUMN     "lexicon" JSONB;

-- AlterTable
ALTER TABLE "voiceovers" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "text" TEXT,
ADD COLUMN     "voiceLicense" TEXT;


-- Hand-written integrity rules ------------------------------------------------
-- At most one current narration take per scene; earlier takes stay as history.
CREATE UNIQUE INDEX "voiceovers_one_current_take_per_scene"
  ON "voiceovers" ("sceneId") WHERE "isCurrent" AND "sceneId" IS NOT NULL;
