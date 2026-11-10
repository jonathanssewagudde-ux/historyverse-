# Database

PostgreSQL 16+ with the `pg_trgm` and `vector` (pgvector) extensions, accessed through **Prisma 7** with the `pg` driver adapter. Implemented in Milestone 3.

## Layout

| Path                      | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `prisma.config.ts`        | Prisma configuration (schema folder, migrations, datasource URL from `DATABASE_URL`) |
| `prisma/schema/*.prisma`  | Schema, split by domain                                                              |
| `prisma/migrations/`      | SQL migrations (generated, plus one hand-written integrity migration)                |
| `prisma/seed.ts`          | Reference data: media licences and top-level categories                              |
| `src/generated/prisma/`   | Generated client (not committed; `pnpm install` regenerates it)                      |
| `src/server/db/client.ts` | `getDb()`: lazy, cached client                                                       |

## Commands

```bash
pnpm db:migrate     # create/apply migrations in development
pnpm db:deploy      # apply migrations in production/CI
pnpm db:seed        # licences and categories (idempotent)
pnpm db:studio      # browse data
pnpm admin:create   # first Super Administrator (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
pnpm user:role <email> <ROLE>
```

## Schema by domain (60 models, 66 tables)

| File                | Models                                                                                                                                                                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.prisma`       | User (with `UserRole`), Session, Account, Verification, RateLimit                                                                                                                                                                                                       |
| `entities.prisma`   | HistoricalDate, Entity, EntityAlias, ExternalIdentifier, EntityRelation, Country, Territory, HistoricalState, Kingdom, Empire, Civilization, Dynasty, Location, HistoricalPerson, PoliticalOffice, LeadershipTerm, RoyalRelationship, HistoricalEvent, HistoricalPeriod |
| `content.prisma`    | Article, ArticleSection, ArticleRevision, ArticleEntity, HistoricalClaim, Source, Citation, Category, Tag, Translation                                                                                                                                                  |
| `media.prisma`      | MediaLicense, MediaAsset, EntityMedia, ArticleMedia, AIReconstruction                                                                                                                                                                                                   |
| `production.prisma` | ContentProject, ProductionJob, Documentary, DocumentaryScript, DocumentaryScene, SceneAsset, SceneCitation, Voiceover, VideoAsset, VideoRender, Thumbnail, YouTubeChannel, YouTubeVideo, PublicationSchedule                                                            |
| `engagement.prisma` | Bookmark, ReadingHistory, Collection, CollectionItem, CategoryFollow                                                                                                                                                                                                    |
| `governance.prisma` | EditorialReview, CorrectionRequest, AuditLog                                                                                                                                                                                                                            |

## Design decisions

1. **Entity supertype.** Every historical subject is an `Entity` (kind + slug + name + start/end dates) with one detail row of its kind. Relationships, external identifiers, media, claims, categories and translations attach to `Entity`, so all subjects behave alike. Kingdoms and empires specialise `HistoricalState` (entity → state → kingdom).
2. **Structured historical dates.** `HistoricalDate` mirrors `src/lib/history/dates.ts`: historical year numbering (no year 0), precision, `approximate`, `uncertain`, calendar, and a `sortKey` for chronological ordering.
3. **Claims carry provenance.** `HistoricalClaim` records type (fact, interpretation, tradition, disputed), certainty, origin (human, import, AI draft) and verification. Competing claims share a `disputeGroup` and coexist. Citations link sources to claims, sections or articles.
4. **Roles are an enum on the user** (`UserRole`: USER, RESEARCHER, EDITOR, ADMINISTRATOR, SUPER_ADMINISTRATOR). One role per user keeps authorization simple and auditable; the permission matrix is in `src/lib/auth/roles.ts`.
5. **Media must be licensed and labelled.** `MediaAsset.licenseId` is required, and `kind` says what the asset is (authentic photo, document, artwork, map, AI reconstruction).
6. **Soft deletion** (`deletedAt`) on entities, articles and media keeps references and audit trails valid.

## Integrity rules enforced by the database

These live in `prisma/migrations/20261110083700_integrity_constraints` and are covered by `tests/integration/constraints.test.ts`.

| Rule                                                                                                            | Mechanism                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| No year 0; month/day ranges; month and day stored only at matching precision                                    | CHECK on `historical_dates`     |
| Coordinates in range and paired; geometry requires a named source                                               | CHECK on `locations`            |
| Slug format; no self-referencing relations                                                                      | CHECK                           |
| Translation, schedule, review and collection item each target exactly one thing                                 | CHECK (`num_nonnulls`)          |
| An article cannot be public while it contains unreviewed AI text, and must have `publishedAt`                   | CHECK on `articles`             |
| A schedule cannot be approved without a recorded approver                                                       | CHECK                           |
| A claim cannot be VERIFIED without a verifier                                                                   | CHECK                           |
| A YouTube video stays PRIVATE until a real video id exists                                                      | CHECK                           |
| The audit log is append-only                                                                                    | Trigger rejecting UPDATE/DELETE |
| An `AIReconstruction` can only attach to media of kind `AI_RECONSTRUCTION`, and such media cannot be relabelled | Triggers                        |

Not yet enforced in the database: that an entity's detail row matches its `kind`. The repository layer will guarantee this when entity writes arrive in Milestone 4.

## Planned indexes (later milestones)

- `tsvector` columns with GIN indexes and `pg_trgm` indexes for search (M6)
- `vector` columns with HNSW indexes for semantic retrieval (M6/M14)

## Local development

```bash
docker compose up -d            # PostgreSQL with pgvector, plus Redis
cp .env.example .env.local      # set DATABASE_URL and AUTH_SECRET
pnpm db:migrate && pnpm db:seed
```

The compose file also creates `historyverse_test`, which integration and e2e tests migrate and empty on every run. Tests never touch the development database.

## Production notes

- Use a least-privilege application role. A privileged role must create the `pg_trgm` and `vector` extensions once, before `pnpm db:deploy`.
- Enable automated backups and test a restore before launch (Milestone 15 checklist).
