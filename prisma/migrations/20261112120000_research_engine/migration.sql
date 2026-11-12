
-- CreateEnum
CREATE TYPE "ResearchSourceKind" AS ENUM ('STRUCTURED_DATA', 'ENCYCLOPEDIA', 'BOOK', 'ARCHIVE_ITEM');

-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('PRIMARY', 'SECONDARY', 'TERTIARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ResearchSourceStatus" AS ENUM ('CANDIDATE', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "content_projects" ADD COLUMN     "sourceSetApprovedAt" TIMESTAMP(3),
ADD COLUMN     "sourceSetApprovedById" TEXT,
ADD COLUMN     "subjectQid" TEXT;

-- CreateTable
CREATE TABLE "research_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ResearchSourceKind" NOT NULL,
    "tier" "SourceTier" NOT NULL DEFAULT 'UNKNOWN',
    "provider" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "publishedYear" INTEGER,
    "url" TEXT NOT NULL,
    "licenseNote" TEXT,
    "excerpts" JSONB,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "status" "ResearchSourceStatus" NOT NULL DEFAULT 'CANDIDATE',
    "sourceId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "research_sources_projectId_status_idx" ON "research_sources"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_sources_projectId_url_key" ON "research_sources"("projectId", "url");

-- AddForeignKey
ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_sourceSetApprovedById_fkey" FOREIGN KEY ("sourceSetApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "content_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written integrity rules ------------------------------------------------
-- A source is only accepted or rejected by a person, at a recorded time.
ALTER TABLE "research_sources"
  ADD CONSTRAINT "research_sources_decision_reviewed"
  CHECK ("status" = 'CANDIDATE' OR ("reviewedAt" IS NOT NULL));

-- Costs are never negative, and actual spend is only recorded on jobs that ran.
ALTER TABLE "production_jobs"
  ADD CONSTRAINT "production_jobs_costs_non_negative"
  CHECK (coalesce("costEstimateUsd", 0) >= 0 AND coalesce("actualCostUsd", 0) >= 0);
ALTER TABLE "content_projects"
  ADD CONSTRAINT "content_projects_money_non_negative"
  CHECK ("budgetUsd" >= 0 AND "spentUsd" >= 0);
