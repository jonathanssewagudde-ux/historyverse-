-- CreateEnum
CREATE TYPE "MediaCandidateStatus" AS ENUM ('CANDIDATE', 'SELECTED', 'REJECTED');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "licenseVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "licenseVerifiedById" TEXT;

-- CreateTable
CREATE TABLE "media_candidates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "creator" TEXT,
    "dateText" TEXT,
    "description" TEXT,
    "licenseCode" TEXT NOT NULL,
    "licenseName" TEXT NOT NULL,
    "rightsStatement" TEXT,
    "attribution" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "status" "MediaCandidateStatus" NOT NULL DEFAULT 'CANDIDATE',
    "mediaId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconstruction_sources" (
    "reconstructionId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "reconstruction_sources_pkey" PRIMARY KEY ("reconstructionId","sourceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_candidates_mediaId_key" ON "media_candidates"("mediaId");

-- CreateIndex
CREATE INDEX "media_candidates_projectId_status_idx" ON "media_candidates"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_candidates_projectId_provider_sourceRef_key" ON "media_candidates"("projectId", "provider", "sourceRef");

-- CreateIndex
CREATE INDEX "reconstruction_sources_sourceId_idx" ON "reconstruction_sources"("sourceId");

-- AddForeignKey
ALTER TABLE "media_candidates" ADD CONSTRAINT "media_candidates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "content_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_candidates" ADD CONSTRAINT "media_candidates_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_candidates" ADD CONSTRAINT "media_candidates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconstruction_sources" ADD CONSTRAINT "reconstruction_sources_reconstructionId_fkey" FOREIGN KEY ("reconstructionId") REFERENCES "ai_reconstructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconstruction_sources" ADD CONSTRAINT "reconstruction_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_licenseVerifiedById_fkey" FOREIGN KEY ("licenseVerifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written integrity rules ------------------------------------------------
-- Selecting or rejecting a discovered image is a person's decision, made at a recorded time.
ALTER TABLE "media_candidates"
  ADD CONSTRAINT "media_candidates_decision_reviewed"
  CHECK ("status" = 'CANDIDATE' OR "reviewedAt" IS NOT NULL);
