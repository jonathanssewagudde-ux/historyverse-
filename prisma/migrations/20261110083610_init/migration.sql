-- Extensions used by HISTORYVERSE. pg_trgm: typo-tolerant search (Milestone 6).
-- vector: semantic search embeddings (Milestone 6/14). Both are created up front so later
-- migrations do not need elevated privileges.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'RESEARCHER', 'EDITOR', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "ArticleTemplate" AS ENUM ('COUNTRY', 'PRESIDENT', 'MONARCH', 'BIOGRAPHY', 'KINGDOM', 'CIVILIZATION', 'EVENT', 'INVENTION', 'GENERAL');

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('INTRODUCTION', 'OVERVIEW', 'CHRONOLOGY', 'PEOPLE', 'EVENTS', 'CULTURE', 'LEGACY', 'FURTHER_READING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('FACT', 'INTERPRETATION', 'TRADITION', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ClaimOrigin" AS ENUM ('HUMAN', 'IMPORT', 'AI_DRAFT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BOOK', 'JOURNAL_ARTICLE', 'THESIS', 'ARCHIVE_DOCUMENT', 'PRIMARY_SOURCE', 'NEWSPAPER', 'WEBSITE', 'ENCYCLOPEDIA', 'DATASET', 'ORAL_TRADITION', 'MUSEUM_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('DRAFT', 'MACHINE', 'REVIEWED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('MILLENNIUM', 'CENTURY', 'DECADE', 'YEAR', 'MONTH', 'DAY');

-- CreateEnum
CREATE TYPE "CalendarModel" AS ENUM ('GREGORIAN', 'JULIAN');

-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('COUNTRY', 'TERRITORY', 'HISTORICAL_STATE', 'KINGDOM', 'EMPIRE', 'CIVILIZATION', 'DYNASTY', 'PERSON', 'EVENT', 'PERIOD', 'LOCATION', 'TOPIC');

-- CreateEnum
CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'RESEARCH_REVIEW', 'EDITORIAL_APPROVAL', 'PUBLISHED', 'UPDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AliasType" AS ENUM ('ALTERNATIVE', 'NATIVE', 'FORMER', 'REGNAL', 'BIRTH_NAME', 'ABBREVIATION', 'TRANSLITERATION');

-- CreateEnum
CREATE TYPE "Certainty" AS ENUM ('DOCUMENTED', 'TRADITIONAL', 'PROBABLE', 'UNCERTAIN', 'DISPUTED');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('PART_OF', 'LOCATED_IN', 'CAPITAL_OF', 'PRECEDED_BY', 'SUCCEEDED_BY', 'FOUNDED_BY', 'RULED_BY', 'MEMBER_OF', 'PARTICIPANT_IN', 'ALLY_OF', 'ENEMY_OF', 'VASSAL_OF', 'COLONY_OF', 'INFLUENCED_BY', 'CONTEMPORARY_OF', 'RELATED_TO');

-- CreateEnum
CREATE TYPE "Continent" AS ENUM ('AFRICA', 'ASIA', 'EUROPE', 'NORTH_AMERICA', 'SOUTH_AMERICA', 'OCEANIA', 'ANTARCTICA');

-- CreateEnum
CREATE TYPE "UnStatus" AS ENUM ('MEMBER', 'OBSERVER', 'NON_MEMBER');

-- CreateEnum
CREATE TYPE "TerritoryStatus" AS ENUM ('DEPENDENT', 'AUTONOMOUS', 'OVERSEAS', 'DISPUTED', 'OCCUPIED', 'OTHER');

-- CreateEnum
CREATE TYPE "PolityType" AS ENUM ('STATE', 'KINGDOM', 'EMPIRE', 'SULTANATE', 'CALIPHATE', 'CHIEFDOM', 'CITY_STATE', 'REPUBLIC', 'CONFEDERATION', 'COLONY', 'PROTECTORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "MonarchyStatus" AS ENUM ('REIGNING', 'CEREMONIAL', 'ABOLISHED', 'RESTORED', 'DEFUNCT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('CITY', 'SETTLEMENT', 'ARCHAEOLOGICAL_SITE', 'BATTLEFIELD', 'MONUMENT', 'PALACE', 'RELIGIOUS_SITE', 'REGION', 'NATURAL_FEATURE', 'TRADE_ROUTE', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OfficeType" AS ENUM ('HEAD_OF_STATE', 'HEAD_OF_GOVERNMENT', 'MONARCH', 'REGENT', 'PRIME_MINISTER', 'GOVERNOR', 'TRADITIONAL_RULER', 'RELIGIOUS_LEADER', 'MILITARY_LEADER', 'OTHER');

-- CreateEnum
CREATE TYPE "KinshipType" AS ENUM ('PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF', 'ADOPTIVE_PARENT_OF', 'GUARDIAN_OF', 'CONSORT_OF');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WAR', 'BATTLE', 'REVOLUTION', 'INDEPENDENCE', 'POLITICAL', 'TREATY', 'CORONATION', 'SUCCESSION', 'DISCOVERY', 'INVENTION', 'ARCHAEOLOGICAL', 'ECONOMIC', 'CULTURAL', 'RELIGIOUS', 'DISASTER', 'MIGRATION', 'EXPLORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('RESEARCH_REVIEW', 'EDITORIAL_APPROVAL', 'ACCURACY_CHECK', 'LICENSING_CHECK');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DECLINED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "LicenseFamily" AS ENUM ('PUBLIC_DOMAIN', 'CC0', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_ND', 'OTHER_FREE', 'RIGHTS_RESERVED', 'OWN_WORK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('AUTHENTIC_PHOTO', 'AUTHENTIC_DOCUMENT', 'ARTWORK', 'MAP', 'AI_RECONSTRUCTION', 'MODERN_PHOTO', 'DIAGRAM');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PROMPT_DRAFT', 'QUEUED', 'GENERATING', 'GENERATED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'AWAITING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INGESTION', 'RESEARCH', 'ARTICLE_DRAFT', 'MEDIA_SEARCH', 'IMAGE_GENERATION', 'SCRIPT', 'SCENE_PLAN', 'NARRATION', 'RENDER', 'THUMBNAIL', 'SUBTITLES', 'METADATA', 'YOUTUBE_UPLOAD', 'PUBLISH');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'AWAITING_APPROVAL', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentaryStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'RENDERED', 'READY_FOR_UPLOAD', 'PRIVATE_UPLOADED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VideoFormat" AS ENUM ('LANDSCAPE_1080P', 'VERTICAL_1080P');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'ASSETS_NEEDED', 'READY', 'NARRATED', 'APPROVED');

-- CreateEnum
CREATE TYPE "VoiceoverSource" AS ENUM ('SYNTHESIZED', 'UPLOADED_RECORDING');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoAssetKind" AS ENUM ('MUSIC', 'CLIP', 'INTRO', 'OUTRO', 'SUBTITLES', 'SOUND_EFFECT');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RENDERING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "YouTubePrivacy" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'UPLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "bio" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "template" "ArticleTemplate" NOT NULL DEFAULT 'GENERAL',
    "status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "primaryEntityId" TEXT,
    "heroMediaId" TEXT,
    "authorId" TEXT,
    "lastEditedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "containsUnreviewedAi" BOOLEAN NOT NULL DEFAULT false,
    "readingMinutes" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_sections" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "SectionKind" NOT NULL DEFAULT 'CUSTOM',
    "heading" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_revisions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "status" "EditorialStatus" NOT NULL,
    "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_entities" (
    "articleId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'related',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "article_entities_pkey" PRIMARY KEY ("articleId","entityId")
);

-- CreateTable
CREATE TABLE "historical_claims" (
    "id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "type" "ClaimType" NOT NULL DEFAULT 'FACT',
    "certainty" "Certainty" NOT NULL DEFAULT 'DOCUMENTED',
    "origin" "ClaimOrigin" NOT NULL DEFAULT 'HUMAN',
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "entityId" TEXT,
    "articleId" TEXT,
    "sectionId" TEXT,
    "property" TEXT,
    "value" JSONB,
    "dateId" TEXT,
    "disputeGroup" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "publisher" TEXT,
    "publishedYear" INTEGER,
    "url" TEXT,
    "archiveUrl" TEXT,
    "isbn" TEXT,
    "doi" TEXT,
    "language" TEXT,
    "repository" TEXT,
    "licenseNote" TEXT,
    "accessedAt" TIMESTAMP(3),
    "reliabilityNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "claimId" TEXT,
    "articleId" TEXT,
    "sectionId" TEXT,
    "locator" TEXT,
    "quote" TEXT,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
    "articleId" TEXT,
    "sectionId" TEXT,
    "entityId" TEXT,
    "categoryId" TEXT,
    "translatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "reading_history" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_history_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "articleId" TEXT,
    "entityId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_follows" (
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_follows_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateTable
CREATE TABLE "historical_dates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "precision" "DatePrecision" NOT NULL,
    "approximate" BOOLEAN NOT NULL DEFAULT false,
    "uncertain" BOOLEAN NOT NULL DEFAULT false,
    "calendar" "CalendarModel" NOT NULL DEFAULT 'GREGORIAN',
    "sortKey" BIGINT NOT NULL,

    CONSTRAINT "historical_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "kind" "EntityKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "startDateId" TEXT,
    "endDateId" TEXT,
    "wikidataId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_aliases" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AliasType" NOT NULL DEFAULT 'ALTERNATIVE',
    "language" TEXT,

    CONSTRAINT "entity_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identifiers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_relations" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "certainty" "Certainty" NOT NULL DEFAULT 'DOCUMENTED',
    "startDateId" TEXT,
    "endDateId" TEXT,
    "note" TEXT,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "entityId" TEXT NOT NULL,
    "iso2" CHAR(2),
    "iso3" CHAR(3),
    "unStatus" "UnStatus" NOT NULL DEFAULT 'NON_MEMBER',
    "continent" "Continent",
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "capitalId" TEXT,
    "independenceDateId" TEXT,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "territories" (
    "entityId" TEXT NOT NULL,
    "status" "TerritoryStatus" NOT NULL,
    "continent" "Continent",
    "administeredById" TEXT,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "historical_states" (
    "entityId" TEXT NOT NULL,
    "polityType" "PolityType" NOT NULL,
    "continent" "Continent",
    "capitalId" TEXT,
    "governmentForm" TEXT,
    "bordersUncertain" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "historical_states_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "kingdoms" (
    "stateId" TEXT NOT NULL,
    "rulerTitle" TEXT,
    "successionSystem" TEXT,
    "monarchyStatus" "MonarchyStatus" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "kingdoms_pkey" PRIMARY KEY ("stateId")
);

-- CreateTable
CREATE TABLE "empires" (
    "stateId" TEXT NOT NULL,
    "rulerTitle" TEXT,
    "peakAreaKm2" INTEGER,
    "peakAreaNote" TEXT,

    CONSTRAINT "empires_pkey" PRIMARY KEY ("stateId")
);

-- CreateTable
CREATE TABLE "civilizations" (
    "entityId" TEXT NOT NULL,
    "region" TEXT,
    "continent" "Continent",
    "writingSystems" TEXT[],

    CONSTRAINT "civilizations_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "dynasties" (
    "entityId" TEXT NOT NULL,
    "realmId" TEXT,
    "founderId" TEXT,

    CONSTRAINT "dynasties_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "locations" (
    "entityId" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "positionUncertain" BOOLEAN NOT NULL DEFAULT false,
    "geometry" JSONB,
    "geometrySource" TEXT,
    "modernCountryId" TEXT,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "historical_people" (
    "entityId" TEXT NOT NULL,
    "fullName" TEXT,
    "honorific" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNKNOWN',
    "occupations" TEXT[],
    "birthPlaceId" TEXT,
    "deathPlaceId" TEXT,
    "dynastyId" TEXT,
    "isLiving" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "historical_people_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "political_offices" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OfficeType" NOT NULL,
    "jurisdictionId" TEXT,
    "wikidataId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "political_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leadership_terms" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "startDateId" TEXT,
    "endDateId" TEXT,
    "ordinal" INTEGER,
    "qualifier" TEXT,
    "endReason" TEXT,
    "certainty" "Certainty" NOT NULL DEFAULT 'DOCUMENTED',
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leadership_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "royal_relationships" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" "KinshipType" NOT NULL,
    "certainty" "Certainty" NOT NULL DEFAULT 'DOCUMENTED',
    "dynastyId" TEXT,
    "startDateId" TEXT,
    "endDateId" TEXT,
    "note" TEXT,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "royal_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_events" (
    "entityId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "locationId" TEXT,

    CONSTRAINT "historical_events_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "historical_periods" (
    "entityId" TEXT NOT NULL,
    "region" TEXT,
    "parentId" TEXT,
    "conventionNote" TEXT,

    CONSTRAINT "historical_periods_pkey" PRIMARY KEY ("entityId")
);

-- CreateTable
CREATE TABLE "editorial_reviews" (
    "id" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "decision" "ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "articleId" TEXT,
    "documentaryId" TEXT,
    "claimId" TEXT,
    "articleVersion" INTEGER,
    "notes" TEXT,
    "requestedById" TEXT,
    "reviewerId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editorial_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRole" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_licenses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "LicenseFamily" NOT NULL,
    "url" TEXT,
    "requiresAttribution" BOOLEAN NOT NULL DEFAULT true,
    "allowsCommercialUse" BOOLEAN NOT NULL DEFAULT false,
    "allowsDerivatives" BOOLEAN NOT NULL DEFAULT false,
    "requiresShareAlike" BOOLEAN NOT NULL DEFAULT false,
    "publishable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "media_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "kind" "MediaKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "altText" TEXT,
    "creator" TEXT,
    "dateId" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceRef" TEXT,
    "licenseId" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "bytes" BIGINT,
    "checksum" TEXT,
    "reviewStatus" "MediaReviewStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_media" (
    "entityId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entity_media_pkey" PRIMARY KEY ("entityId","mediaId")
);

-- CreateTable
CREATE TABLE "article_media" (
    "articleId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "article_media_pkey" PRIMARY KEY ("articleId","mediaId")
);

-- CreateTable
CREATE TABLE "ai_reconstructions" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT,
    "entityId" TEXT,
    "projectId" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "evidenceNotes" TEXT,
    "interpretationNotes" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PROMPT_DRAFT',
    "parentId" TEXT,
    "costUsd" DECIMAL(10,4),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_reconstructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_projects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryEntityId" TEXT,
    "articleId" TEXT,
    "budgetUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "spentUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "costEstimateUsd" DECIMAL(10,4),
    "actualCostUsd" DECIMAL(10,4),
    "queueJobId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentaries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DocumentaryStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "primaryEntityId" TEXT,
    "articleId" TEXT,
    "projectId" TEXT,
    "containsSyntheticMedia" BOOLEAN NOT NULL DEFAULT false,
    "manifest" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentary_scripts" (
    "id" TEXT NOT NULL,
    "documentaryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ScriptStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "targetDurationSeconds" INTEGER NOT NULL,
    "narrationStyle" TEXT,
    "detailLevel" TEXT,
    "audience" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentary_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentary_scenes" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "visualDescription" TEXT,
    "onScreenText" TEXT,
    "durationSeconds" DECIMAL(7,2) NOT NULL,
    "transition" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentary_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_assets" (
    "sceneId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "motion" TEXT,

    CONSTRAINT "scene_assets_pkey" PRIMARY KEY ("sceneId","mediaId")
);

-- CreateTable
CREATE TABLE "scene_citations" (
    "sceneId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,

    CONSTRAINT "scene_citations_pkey" PRIMARY KEY ("sceneId","citationId")
);

-- CreateTable
CREATE TABLE "voiceovers" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "sceneId" TEXT,
    "source" "VoiceoverSource" NOT NULL DEFAULT 'SYNTHESIZED',
    "provider" TEXT,
    "voiceId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "speed" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "storageKey" TEXT,
    "durationMs" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "costUsd" DECIMAL(10,4),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voiceovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "documentaryId" TEXT,
    "kind" "VideoAssetKind" NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "durationMs" INTEGER,
    "language" TEXT,
    "licenseId" TEXT,
    "attribution" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_renders" (
    "id" TEXT NOT NULL,
    "documentaryId" TEXT NOT NULL,
    "scriptId" TEXT,
    "jobId" TEXT,
    "format" "VideoFormat" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT,
    "bytes" BIGINT,
    "durationSeconds" DECIMAL(9,2),
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_renders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thumbnails" (
    "id" TEXT NOT NULL,
    "documentaryId" TEXT NOT NULL,
    "mediaId" TEXT,
    "storageKey" TEXT,
    "headline" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "usesSyntheticMedia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_channels" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "verifiedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_videos" (
    "id" TEXT NOT NULL,
    "documentaryId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "renderId" TEXT,
    "videoId" TEXT,
    "privacy" "YouTubePrivacy" NOT NULL DEFAULT 'PRIVATE',
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadProgress" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "chapters" JSONB,
    "playlistId" TEXT,
    "publishAt" TIMESTAMP(3),
    "syntheticMediaDisclosed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_schedules" (
    "id" TEXT NOT NULL,
    "articleId" TEXT,
    "documentaryId" TEXT,
    "youtubeVideoId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publication_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArticleToCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ArticleToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RelatedArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedArticles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToEntity" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToEntity_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EntityToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EntityToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "articles_primaryEntityId_idx" ON "articles"("primaryEntityId");

-- CreateIndex
CREATE INDEX "articles_template_idx" ON "articles"("template");

-- CreateIndex
CREATE UNIQUE INDEX "article_sections_articleId_position_key" ON "article_sections"("articleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "article_revisions_articleId_version_key" ON "article_revisions"("articleId", "version");

-- CreateIndex
CREATE INDEX "article_entities_entityId_idx" ON "article_entities"("entityId");

-- CreateIndex
CREATE INDEX "historical_claims_entityId_idx" ON "historical_claims"("entityId");

-- CreateIndex
CREATE INDEX "historical_claims_articleId_idx" ON "historical_claims"("articleId");

-- CreateIndex
CREATE INDEX "historical_claims_verification_origin_idx" ON "historical_claims"("verification", "origin");

-- CreateIndex
CREATE INDEX "historical_claims_disputeGroup_idx" ON "historical_claims"("disputeGroup");

-- CreateIndex
CREATE UNIQUE INDEX "sources_doi_key" ON "sources"("doi");

-- CreateIndex
CREATE INDEX "sources_title_idx" ON "sources"("title");

-- CreateIndex
CREATE INDEX "sources_repository_idx" ON "sources"("repository");

-- CreateIndex
CREATE INDEX "citations_sourceId_idx" ON "citations"("sourceId");

-- CreateIndex
CREATE INDEX "citations_claimId_idx" ON "citations"("claimId");

-- CreateIndex
CREATE INDEX "citations_articleId_idx" ON "citations"("articleId");

-- CreateIndex
CREATE INDEX "citations_sectionId_idx" ON "citations"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "translations_locale_idx" ON "translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "translations_articleId_locale_field_key" ON "translations"("articleId", "locale", "field");

-- CreateIndex
CREATE UNIQUE INDEX "translations_sectionId_locale_field_key" ON "translations"("sectionId", "locale", "field");

-- CreateIndex
CREATE UNIQUE INDEX "translations_entityId_locale_field_key" ON "translations"("entityId", "locale", "field");

-- CreateIndex
CREATE UNIQUE INDEX "translations_categoryId_locale_field_key" ON "translations"("categoryId", "locale", "field");

-- CreateIndex
CREATE INDEX "bookmarks_articleId_idx" ON "bookmarks"("articleId");

-- CreateIndex
CREATE INDEX "reading_history_userId_lastReadAt_idx" ON "reading_history"("userId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "collections_userId_slug_key" ON "collections"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collectionId_articleId_key" ON "collection_items"("collectionId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collectionId_entityId_key" ON "collection_items"("collectionId", "entityId");

-- CreateIndex
CREATE INDEX "historical_dates_sortKey_idx" ON "historical_dates"("sortKey");

-- CreateIndex
CREATE INDEX "historical_dates_year_idx" ON "historical_dates"("year");

-- CreateIndex
CREATE INDEX "historical_dates_month_day_idx" ON "historical_dates"("month", "day");

-- CreateIndex
CREATE UNIQUE INDEX "entities_wikidataId_key" ON "entities"("wikidataId");

-- CreateIndex
CREATE INDEX "entities_kind_status_idx" ON "entities"("kind", "status");

-- CreateIndex
CREATE INDEX "entities_name_idx" ON "entities"("name");

-- CreateIndex
CREATE INDEX "entities_startDateId_idx" ON "entities"("startDateId");

-- CreateIndex
CREATE INDEX "entities_endDateId_idx" ON "entities"("endDateId");

-- CreateIndex
CREATE UNIQUE INDEX "entities_kind_slug_key" ON "entities"("kind", "slug");

-- CreateIndex
CREATE INDEX "entity_aliases_name_idx" ON "entity_aliases"("name");

-- CreateIndex
CREATE UNIQUE INDEX "entity_aliases_entityId_name_type_key" ON "entity_aliases"("entityId", "name", "type");

-- CreateIndex
CREATE INDEX "external_identifiers_entityId_idx" ON "external_identifiers"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "external_identifiers_source_value_key" ON "external_identifiers"("source", "value");

-- CreateIndex
CREATE INDEX "entity_relations_toId_type_idx" ON "entity_relations"("toId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relations_fromId_toId_type_key" ON "entity_relations"("fromId", "toId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_continent_idx" ON "countries"("continent");

-- CreateIndex
CREATE INDEX "historical_states_polityType_idx" ON "historical_states"("polityType");

-- CreateIndex
CREATE INDEX "historical_states_continent_idx" ON "historical_states"("continent");

-- CreateIndex
CREATE INDEX "dynasties_realmId_idx" ON "dynasties"("realmId");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE INDEX "locations_latitude_longitude_idx" ON "locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "historical_people_dynastyId_idx" ON "historical_people"("dynastyId");

-- CreateIndex
CREATE UNIQUE INDEX "political_offices_slug_key" ON "political_offices"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "political_offices_wikidataId_key" ON "political_offices"("wikidataId");

-- CreateIndex
CREATE INDEX "political_offices_jurisdictionId_idx" ON "political_offices"("jurisdictionId");

-- CreateIndex
CREATE INDEX "leadership_terms_officeId_ordinal_idx" ON "leadership_terms"("officeId", "ordinal");

-- CreateIndex
CREATE INDEX "leadership_terms_personId_idx" ON "leadership_terms"("personId");

-- CreateIndex
CREATE INDEX "royal_relationships_toId_idx" ON "royal_relationships"("toId");

-- CreateIndex
CREATE INDEX "royal_relationships_dynastyId_idx" ON "royal_relationships"("dynastyId");

-- CreateIndex
CREATE UNIQUE INDEX "royal_relationships_fromId_toId_type_key" ON "royal_relationships"("fromId", "toId", "type");

-- CreateIndex
CREATE INDEX "historical_events_type_idx" ON "historical_events"("type");

-- CreateIndex
CREATE INDEX "editorial_reviews_decision_stage_idx" ON "editorial_reviews"("decision", "stage");

-- CreateIndex
CREATE INDEX "editorial_reviews_articleId_idx" ON "editorial_reviews"("articleId");

-- CreateIndex
CREATE INDEX "editorial_reviews_reviewerId_idx" ON "editorial_reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "correction_requests_status_createdAt_idx" ON "correction_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "correction_requests_articleId_idx" ON "correction_requests"("articleId");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "media_licenses_code_key" ON "media_licenses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_checksum_key" ON "media_assets"("checksum");

-- CreateIndex
CREATE INDEX "media_assets_kind_reviewStatus_idx" ON "media_assets"("kind", "reviewStatus");

-- CreateIndex
CREATE INDEX "media_assets_licenseId_idx" ON "media_assets"("licenseId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sourceName_sourceRef_key" ON "media_assets"("sourceName", "sourceRef");

-- CreateIndex
CREATE INDEX "entity_media_mediaId_idx" ON "entity_media"("mediaId");

-- CreateIndex
CREATE INDEX "article_media_mediaId_idx" ON "article_media"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reconstructions_mediaId_key" ON "ai_reconstructions"("mediaId");

-- CreateIndex
CREATE INDEX "ai_reconstructions_entityId_idx" ON "ai_reconstructions"("entityId");

-- CreateIndex
CREATE INDEX "ai_reconstructions_projectId_idx" ON "ai_reconstructions"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "content_projects_slug_key" ON "content_projects"("slug");

-- CreateIndex
CREATE INDEX "content_projects_status_idx" ON "content_projects"("status");

-- CreateIndex
CREATE INDEX "production_jobs_projectId_type_idx" ON "production_jobs"("projectId", "type");

-- CreateIndex
CREATE INDEX "production_jobs_status_createdAt_idx" ON "production_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "documentaries_slug_key" ON "documentaries"("slug");

-- CreateIndex
CREATE INDEX "documentaries_status_idx" ON "documentaries"("status");

-- CreateIndex
CREATE INDEX "documentaries_articleId_idx" ON "documentaries"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "documentary_scripts_documentaryId_version_key" ON "documentary_scripts"("documentaryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "documentary_scenes_scriptId_position_key" ON "documentary_scenes"("scriptId", "position");

-- CreateIndex
CREATE INDEX "scene_assets_mediaId_idx" ON "scene_assets"("mediaId");

-- CreateIndex
CREATE INDEX "voiceovers_scriptId_sceneId_idx" ON "voiceovers"("scriptId", "sceneId");

-- CreateIndex
CREATE INDEX "video_assets_documentaryId_kind_idx" ON "video_assets"("documentaryId", "kind");

-- CreateIndex
CREATE INDEX "video_renders_documentaryId_status_idx" ON "video_renders"("documentaryId", "status");

-- CreateIndex
CREATE INDEX "thumbnails_documentaryId_idx" ON "thumbnails"("documentaryId");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_channels_channelId_key" ON "youtube_channels"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_videos_videoId_key" ON "youtube_videos"("videoId");

-- CreateIndex
CREATE INDEX "youtube_videos_documentaryId_idx" ON "youtube_videos"("documentaryId");

-- CreateIndex
CREATE INDEX "publication_schedules_status_scheduledFor_idx" ON "publication_schedules"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "_ArticleToCategory_B_index" ON "_ArticleToCategory"("B");

-- CreateIndex
CREATE INDEX "_ArticleToTag_B_index" ON "_ArticleToTag"("B");

-- CreateIndex
CREATE INDEX "_RelatedArticles_B_index" ON "_RelatedArticles"("B");

-- CreateIndex
CREATE INDEX "_CategoryToEntity_B_index" ON "_CategoryToEntity"("B");

-- CreateIndex
CREATE INDEX "_EntityToTag_B_index" ON "_EntityToTag"("B");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_primaryEntityId_fkey" FOREIGN KEY ("primaryEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_heroMediaId_fkey" FOREIGN KEY ("heroMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_sections" ADD CONSTRAINT "article_sections_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_entities" ADD CONSTRAINT "article_entities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_claims" ADD CONSTRAINT "historical_claims_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_claims" ADD CONSTRAINT "historical_claims_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_claims" ADD CONSTRAINT "historical_claims_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "article_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_claims" ADD CONSTRAINT "historical_claims_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_claims" ADD CONSTRAINT "historical_claims_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "historical_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "article_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "article_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_translatedById_fkey" FOREIGN KEY ("translatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_startDateId_fkey" FOREIGN KEY ("startDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_endDateId_fkey" FOREIGN KEY ("endDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identifiers" ADD CONSTRAINT "external_identifiers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_toId_fkey" FOREIGN KEY ("toId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_startDateId_fkey" FOREIGN KEY ("startDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_endDateId_fkey" FOREIGN KEY ("endDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "historical_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_capitalId_fkey" FOREIGN KEY ("capitalId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_independenceDateId_fkey" FOREIGN KEY ("independenceDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_states" ADD CONSTRAINT "historical_states_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_states" ADD CONSTRAINT "historical_states_capitalId_fkey" FOREIGN KEY ("capitalId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kingdoms" ADD CONSTRAINT "kingdoms_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "historical_states"("entityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empires" ADD CONSTRAINT "empires_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "historical_states"("entityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "civilizations" ADD CONSTRAINT "civilizations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynasties" ADD CONSTRAINT "dynasties_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynasties" ADD CONSTRAINT "dynasties_realmId_fkey" FOREIGN KEY ("realmId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynasties" ADD CONSTRAINT "dynasties_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "historical_people"("entityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_modernCountryId_fkey" FOREIGN KEY ("modernCountryId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_people" ADD CONSTRAINT "historical_people_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_people" ADD CONSTRAINT "historical_people_birthPlaceId_fkey" FOREIGN KEY ("birthPlaceId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_people" ADD CONSTRAINT "historical_people_deathPlaceId_fkey" FOREIGN KEY ("deathPlaceId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_people" ADD CONSTRAINT "historical_people_dynastyId_fkey" FOREIGN KEY ("dynastyId") REFERENCES "dynasties"("entityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "political_offices" ADD CONSTRAINT "political_offices_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_personId_fkey" FOREIGN KEY ("personId") REFERENCES "historical_people"("entityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "political_offices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_startDateId_fkey" FOREIGN KEY ("startDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_endDateId_fkey" FOREIGN KEY ("endDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leadership_terms" ADD CONSTRAINT "leadership_terms_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "historical_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "historical_people"("entityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_toId_fkey" FOREIGN KEY ("toId") REFERENCES "historical_people"("entityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_dynastyId_fkey" FOREIGN KEY ("dynastyId") REFERENCES "dynasties"("entityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_startDateId_fkey" FOREIGN KEY ("startDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_endDateId_fkey" FOREIGN KEY ("endDateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "royal_relationships" ADD CONSTRAINT "royal_relationships_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "historical_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_events" ADD CONSTRAINT "historical_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_events" ADD CONSTRAINT "historical_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_periods" ADD CONSTRAINT "historical_periods_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_periods" ADD CONSTRAINT "historical_periods_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "historical_periods"("entityId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "historical_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_reviews" ADD CONSTRAINT "editorial_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "historical_dates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "media_licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_media" ADD CONSTRAINT "entity_media_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_media" ADD CONSTRAINT "entity_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_media" ADD CONSTRAINT "article_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reconstructions" ADD CONSTRAINT "ai_reconstructions_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reconstructions" ADD CONSTRAINT "ai_reconstructions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reconstructions" ADD CONSTRAINT "ai_reconstructions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "content_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reconstructions" ADD CONSTRAINT "ai_reconstructions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ai_reconstructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reconstructions" ADD CONSTRAINT "ai_reconstructions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_primaryEntityId_fkey" FOREIGN KEY ("primaryEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_projects" ADD CONSTRAINT "content_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "content_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentaries" ADD CONSTRAINT "documentaries_primaryEntityId_fkey" FOREIGN KEY ("primaryEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentaries" ADD CONSTRAINT "documentaries_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentaries" ADD CONSTRAINT "documentaries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "content_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentary_scripts" ADD CONSTRAINT "documentary_scripts_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentary_scripts" ADD CONSTRAINT "documentary_scripts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentary_scenes" ADD CONSTRAINT "documentary_scenes_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "documentary_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "documentary_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_citations" ADD CONSTRAINT "scene_citations_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "documentary_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_citations" ADD CONSTRAINT "scene_citations_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "citations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiceovers" ADD CONSTRAINT "voiceovers_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "documentary_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voiceovers" ADD CONSTRAINT "voiceovers_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "documentary_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "media_licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "documentary_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_renders" ADD CONSTRAINT "video_renders_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "production_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "youtube_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "video_renders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_schedules" ADD CONSTRAINT "publication_schedules_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_schedules" ADD CONSTRAINT "publication_schedules_documentaryId_fkey" FOREIGN KEY ("documentaryId") REFERENCES "documentaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_schedules" ADD CONSTRAINT "publication_schedules_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "youtube_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_schedules" ADD CONSTRAINT "publication_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_schedules" ADD CONSTRAINT "publication_schedules_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToCategory" ADD CONSTRAINT "_ArticleToCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToCategory" ADD CONSTRAINT "_ArticleToCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToTag" ADD CONSTRAINT "_ArticleToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleToTag" ADD CONSTRAINT "_ArticleToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedArticles" ADD CONSTRAINT "_RelatedArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedArticles" ADD CONSTRAINT "_RelatedArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToEntity" ADD CONSTRAINT "_CategoryToEntity_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToEntity" ADD CONSTRAINT "_CategoryToEntity_B_fkey" FOREIGN KEY ("B") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EntityToTag" ADD CONSTRAINT "_EntityToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EntityToTag" ADD CONSTRAINT "_EntityToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
