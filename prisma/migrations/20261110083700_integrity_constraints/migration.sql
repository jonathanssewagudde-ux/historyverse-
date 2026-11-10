-- Integrity rules that the Prisma schema language cannot express.
-- Prisma Migrate ignores CHECK constraints and triggers when diffing, so these are stable.

-- ---------------------------------------------------------------- historical dates
ALTER TABLE "historical_dates"
  ADD CONSTRAINT "historical_dates_no_year_zero" CHECK ("year" <> 0),
  ADD CONSTRAINT "historical_dates_month_range" CHECK ("month" IS NULL OR "month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "historical_dates_day_range" CHECK ("day" IS NULL OR "day" BETWEEN 1 AND 31),
  -- A month is stored exactly when the precision is MONTH or DAY; a day exactly when it is DAY.
  -- This stops "sometime in 1884" from ever being rendered as a specific day.
  ADD CONSTRAINT "historical_dates_month_matches_precision"
    CHECK (("month" IS NOT NULL) = ("precision" IN ('MONTH', 'DAY'))),
  ADD CONSTRAINT "historical_dates_day_matches_precision"
    CHECK (("day" IS NOT NULL) = ("precision" = 'DAY'));

-- ---------------------------------------------------------------- geography
ALTER TABLE "locations"
  ADD CONSTRAINT "locations_latitude_range" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "locations_longitude_range" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  ADD CONSTRAINT "locations_coordinates_paired" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "locations_geometry_has_source" CHECK ("geometry" IS NULL OR "geometrySource" IS NOT NULL);

ALTER TABLE "countries"
  ADD CONSTRAINT "countries_iso2_uppercase" CHECK ("iso2" IS NULL OR "iso2" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "countries_iso3_uppercase" CHECK ("iso3" IS NULL OR "iso3" ~ '^[A-Z]{3}$');

-- ---------------------------------------------------------------- graph sanity
ALTER TABLE "entity_relations"
  ADD CONSTRAINT "entity_relations_no_self_reference" CHECK ("fromId" <> "toId");
ALTER TABLE "royal_relationships"
  ADD CONSTRAINT "royal_relationships_no_self_reference" CHECK ("fromId" <> "toId");
ALTER TABLE "entities"
  ADD CONSTRAINT "entities_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "articles"
  ADD CONSTRAINT "articles_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------------------------------------------------------------- "exactly one target"
ALTER TABLE "translations"
  ADD CONSTRAINT "translations_exactly_one_target"
    CHECK (num_nonnulls("articleId", "sectionId", "entityId", "categoryId") = 1);
ALTER TABLE "publication_schedules"
  ADD CONSTRAINT "publication_schedules_exactly_one_target"
    CHECK (num_nonnulls("articleId", "documentaryId", "youtubeVideoId") = 1);
ALTER TABLE "editorial_reviews"
  ADD CONSTRAINT "editorial_reviews_exactly_one_target"
    CHECK (num_nonnulls("articleId", "documentaryId", "claimId") = 1);
ALTER TABLE "collection_items"
  ADD CONSTRAINT "collection_items_exactly_one_target"
    CHECK (num_nonnulls("articleId", "entityId") = 1);
ALTER TABLE "citations"
  ADD CONSTRAINT "citations_has_target"
    CHECK (num_nonnulls("claimId", "articleId", "sectionId") >= 1);

-- ---------------------------------------------------------------- publication safeguards
-- An article cannot be public while it still contains unreviewed AI text, and a public article
-- always records when it was published.
ALTER TABLE "articles"
  ADD CONSTRAINT "articles_no_unreviewed_ai_when_public"
    CHECK (NOT ("status" IN ('PUBLISHED', 'UPDATED') AND "containsUnreviewedAi")),
  ADD CONSTRAINT "articles_public_has_published_at"
    CHECK ("status" NOT IN ('PUBLISHED', 'UPDATED') OR "publishedAt" IS NOT NULL);

-- A schedule can only be approved or published with an approver on record.
ALTER TABLE "publication_schedules"
  ADD CONSTRAINT "publication_schedules_approval_recorded"
    CHECK ("status" NOT IN ('APPROVED', 'PUBLISHED') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));

-- A YouTube video can only leave PRIVATE once YouTube has confirmed a real video id.
ALTER TABLE "youtube_videos"
  ADD CONSTRAINT "youtube_videos_public_needs_video_id" CHECK ("privacy" = 'PRIVATE' OR "videoId" IS NOT NULL),
  ADD CONSTRAINT "youtube_videos_upload_progress_range" CHECK ("uploadProgress" BETWEEN 0 AND 100);

-- A verified claim records who verified it.
ALTER TABLE "historical_claims"
  ADD CONSTRAINT "historical_claims_verification_recorded"
    CHECK ("verification" <> 'VERIFIED' OR ("verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL));

-- ---------------------------------------------------------------- ranges & money
ALTER TABLE "production_jobs"
  ADD CONSTRAINT "production_jobs_progress_range" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "production_jobs_attempts_nonnegative" CHECK ("attempts" >= 0 AND "maxAttempts" >= 1),
  ADD CONSTRAINT "production_jobs_costs_nonnegative"
    CHECK (("costEstimateUsd" IS NULL OR "costEstimateUsd" >= 0) AND ("actualCostUsd" IS NULL OR "actualCostUsd" >= 0));
ALTER TABLE "video_renders"
  ADD CONSTRAINT "video_renders_progress_range" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "video_renders_dimensions_positive" CHECK ("width" > 0 AND "height" > 0 AND "fps" > 0);
ALTER TABLE "reading_history"
  ADD CONSTRAINT "reading_history_progress_range" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "content_projects"
  ADD CONSTRAINT "content_projects_money_nonnegative" CHECK ("budgetUsd" >= 0 AND "spentUsd" >= 0);
ALTER TABLE "documentary_scenes"
  ADD CONSTRAINT "documentary_scenes_duration_positive" CHECK ("durationSeconds" > 0);
ALTER TABLE "documentary_scripts"
  ADD CONSTRAINT "documentary_scripts_duration_positive" CHECK ("targetDurationSeconds" > 0);

-- ---------------------------------------------------------------- audit log is append-only
CREATE FUNCTION audit_logs_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

-- ---------------------------------------------------------------- AI reconstruction labelling
-- An AIReconstruction may only point at a media asset whose kind is AI_RECONSTRUCTION, and such
-- an asset can never be relabelled as authentic while a reconstruction record points at it.
CREATE FUNCTION ai_reconstruction_media_must_be_labelled() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."mediaId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "media_assets" m WHERE m."id" = NEW."mediaId" AND m."kind" = 'AI_RECONSTRUCTION'
  ) THEN
    RAISE EXCEPTION 'media asset % must have kind AI_RECONSTRUCTION', NEW."mediaId"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_reconstructions_media_kind
  BEFORE INSERT OR UPDATE OF "mediaId" ON "ai_reconstructions"
  FOR EACH ROW EXECUTE FUNCTION ai_reconstruction_media_must_be_labelled();

CREATE FUNCTION media_assets_keep_reconstruction_label() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."kind" = 'AI_RECONSTRUCTION' AND NEW."kind" <> 'AI_RECONSTRUCTION' AND EXISTS (
    SELECT 1 FROM "ai_reconstructions" r WHERE r."mediaId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'media asset % is an AI reconstruction and cannot be relabelled', NEW."id"
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER media_assets_reconstruction_label
  BEFORE UPDATE OF "kind" ON "media_assets"
  FOR EACH ROW EXECUTE FUNCTION media_assets_keep_reconstruction_label();
