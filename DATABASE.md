# Database

> **Status:** design plan. The Prisma schema and migrations are implemented in **Milestone 3**. This document records the decisions the schema must honour.

## Stack

PostgreSQL 16+ with the `pgvector` extension, accessed through Prisma ORM. Migrations live in `prisma/migrations` and are applied with `prisma migrate deploy`.

## Modelling principles

1. **Entities are not articles.** A `HistoricalPerson`, `Kingdom` or `HistoricalEvent` is a structured record. An `Article` is editorial prose _about_ one or more entities. Each has its own lifecycle and revisions.
2. **Claims carry provenance.** Facts that can be disputed (dates, relationships, roles) are stored as `HistoricalClaim` rows linked to `Citation`s and `Source`s, with a confidence or dispute flag. Competing claims coexist and are never overwritten.
3. **Historical dates are structured.** Columns follow `src/lib/history/dates.ts`: `year` (historical numbering, no year 0), `month`, `day`, `precision`, `approximate`, `uncertain` and `calendar`, plus a generated `sort_key` for indexing.
4. **External identifiers** (Wikidata QIDs, Commons file names, LoC and Europeana IDs) live in a unique `(source, external_id)` table to support incremental re-imports and deduplication.
5. **Media licensing is mandatory data.** `MediaAsset` must reference a `MediaLicense` and record its source URL, creator, attribution text and its `kind`: `authentic_photo`, `authentic_document`, `artwork`, `map` or `ai_reconstruction`. AI reconstructions also store their prompt, model and generation timestamp.
6. **Every editorial change is auditable** through `AuditLog`, plus revision tables for articles and claims.
7. **Soft deletion** for editorial content, so references and audit trails stay valid.

## Planned models (Milestone 3)

Users, UserRoles · Countries, Territories, HistoricalStates, Kingdoms, Empires, Civilizations, Dynasties · HistoricalPeople, PoliticalOffices, LeadershipTerms, RoyalRelationships · HistoricalEvents, HistoricalPeriods, Locations · Articles, ArticleSections, HistoricalClaims, Sources, Citations · MediaAssets, MediaLicenses, AIReconstructions · Documentaries, DocumentaryScripts, DocumentaryScenes, Voiceovers, VideoAssets, VideoRenders, Thumbnails · YouTubeChannels, YouTubeVideos · ContentProjects, ProductionJobs, PublicationSchedules · Categories, Tags · Bookmarks, ReadingHistory · Translations · EditorialReviews · AuditLogs.

## Indexing plan

- `tsvector` generated columns with GIN indexes for full-text search (M6)
- `pg_trgm` trigram indexes for typo-tolerant autocomplete (M6)
- `vector` columns with HNSW indexes for semantic retrieval (M6/M14, optional)
- B-tree indexes on date sort keys, foreign keys and `(status, published_at)`

## Local development

PostgreSQL 16 is available in the development container. Docker Compose (`pgvector/pgvector:pg16`, `redis:7`) is added in Milestone 3.
