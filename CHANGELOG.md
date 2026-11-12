# Changelog

All notable changes to HISTORYVERSE are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.0] - 2026-11-12: Milestone 8, AI Historical Research Engine

### Added

- Generate History Project (`/admin/projects/new`) and the research overview (`/admin/research`)
- Job system: Redis + BullMQ queue with the database row as the source of truth. It supports progress, cancellation, retries (transient errors only), recovery after restarts, and `pnpm worker`
- Research step from free sources:
  - finds the subject on Wikidata (with alternatives shown) and imports it;
  - reads Wikipedia by section and searches Open Library (and, optionally, the Library of Congress);
  - writes a report of dates and differing accounts.
- Source-set review: accept or reject each candidate (a reason is required to reject), then approve the set, which locks it
- Grounded AI article draft:
  - uses only accepted evidence;
  - every sentence must cite an existing excerpt, and unsupported sentences are removed and listed;
  - a key date is kept only if its year appears in the cited excerpt;
  - copied passages are flagged;
  - the result is saved as an unreviewed AI draft.
- Language-model adapters: Anthropic (official SDK), Ollama, OpenAI and any OpenAI-compatible server
- Cost controls:
  - estimates are made before any paid call;
  - an administrator approves each paid job within the project budget and `AI_MONTHLY_BUDGET_USD`;
  - actual spend is recorded even when a job fails.
- Live connection test for Redis; `pnpm project:create`; `QUEUE_PREFIX`, `AI_INPUT_USD_PER_MTOK`, `AI_OUTPUT_USD_PER_MTOK`
- Recorded API responses for research tests (`tests/fixtures/research`)

### Changed

- A paid language model with no known price counts as not configured, so spending can never be estimated as zero by accident
- CI runs a Redis service

## [0.7.0] - 2026-11-12: Milestone 7, Administrator CMS

### Added

- Editorial workflow: draft → research review → editorial approval → published, with submit, approve, request-changes and unpublish decisions, reviewer notes and an audit entry for each
- Studio article editor (`/admin/articles/new`, `/admin/articles/[id]/edit`): sources, citation insertion, sections, key dates, linked entities, images and categories. Drafts round-trip unchanged through the editable format
- Entity managers for countries, people, kingdoms, civilizations and events, with claim verification (verifying requires a cited source) and import by Wikidata id
- Media library: upload (type checked from file bytes, 10 MB cap, duplicate detection), classification, licence and alt text, editor approval, and download of imported Commons files
- References manager: correct a source once and every citation follows, including on published pages
- Editorial review queue and reader error reports ("Spotted an error? Report it" on published articles)
- Publishing calendar with scheduled publication: the editor's approval is given at scheduling; `POST /api/cron/publish` (needs `CRON_SECRET`) or "Publish due articles now" runs it
- Categories manager (nesting, loop prevention, stable addresses, delete only when unused)
- Users and roles page for Super Administrators
- Integrations page with live, free, read-only connection tests (PostgreSQL, auth, storage, Wikidata, Wikipedia, Wikimedia Commons)
- Settings and audit log page
- `CRON_SECRET` environment variable

### Changed

- Publishing now requires editorial approval and a citation in every factual section
- Creating an article in the Studio refuses an address that is already taken instead of overwriting that draft
- The access-denied page distinguishes "no Studio access" from "not this page"
- Server Actions accept bodies up to 11 MB, for image uploads

## [0.6.0] - 2026-11-11: Milestone 6, Historical Search Engine

### Added

- PostgreSQL search index of published articles (weighted full-text, unaccent, trigram), kept in sync with publishing
- `/search` with snippets, filters, facets, year questions, typo tolerance and related searches
- `/explore` browse page; homepage continent cards and popular searches now link to real pages
- `/api/search/suggest` autocomplete with rate limiting, and an accessible search combobox
- `pnpm search:reindex`

### Changed

- The homepage search box now runs real searches
- Search filter rows scroll sideways on phones; the browser's built-in clear button is hidden so it no longer overlaps the search button

## [0.5.0] - 2026-11-11: Milestone 5, Historical Article System

### Added

- Article data files with strict validation; `pnpm article:load`
- Editorial preview and publish/unpublish workflow in the Studio (`/admin/articles`)
- Public kingdom, country and people pages with citations, key dates, galleries, references and reader tools
- Proxy slug check that returns real HTTP 404s for unknown or unpublished articles
- Local media storage, `pnpm media:fetch`, and a permission-checked `/media/[id]` route
- The first article draft: _The Complete History of the Buganda Kingdom_
- Integration and end-to-end tests for loading, publishing, visibility and media licensing

### Changed

- Integration test files each start from an empty database
- `MediaFrame` labels modern photographs, diagrams and unclassified images correctly

## [0.4.0] - 2026-11-10: Milestone 4, Historical Data Integration

### Added

- Rate-limited, retrying HTTP client for knowledge sources
- Wikidata, Wikipedia and Wikimedia Commons adapters; Commons licence mapping
- Wikidata importer with provenance, idempotency and overwrite protection; `pnpm ingest:wikidata`
- Starter dataset (Uganda and the Buganda Kingdom), imported live
- `/admin/imports` Studio page
- `UNCLASSIFIED` media kind for imported images awaiting editorial classification

## [0.3.0] - 2026-11-10: Milestone 3, Database and Authentication

### Added

- PostgreSQL schema (Prisma 7, 60 models) with migrations, integrity constraints and triggers, and reference-data seed
- Better Auth authentication: sign-up, sign-in, sign-out, profile editing, password change, optional Google sign-in
- Role and permission system, server-side session data-access layer, `proxy.ts` route gate
- AI Studio shell and overview at `/admin`; account menu in the header
- Append-only audit log; `pnpm admin:create` and `pnpm user:role` operator scripts
- Database readiness in `/api/health`
- Integration test suite against real PostgreSQL; auth and access-control e2e tests
- `docker-compose.yml` (PostgreSQL with pgvector, Redis); CI database service

### Changed

- TypeScript target raised to ES2022
- Authentication library is Better Auth instead of Auth.js (recommended by the Auth.js project for new work)

### Fixed

- Emails with surrounding spaces or capitals were rejected by form validation

## [0.2.1] - 2026-11-10: Milestone 2 revision, "Neon bento" redesign

### Changed

- New Gen-Z visual identity (owner request): violet, lime, hot pink and cyan on near-black, rounded bento layouts, Bricolage Grotesque and JetBrains Mono, floating pill navigation, gradient topic plates, sticker status tags, a giant gradient footer wordmark
- The AI-reconstruction label colour is now amber, distinct from the brand violet
- On phones, the search button shows an arrow (its accessible name is still "search") so the placeholder has room

### Added

- `Marquee` topic ticker (decorative, static under reduced motion), `lime` button and badge variants, `text-gradient` and `bg-grid` utilities

## [0.2.0] - 2026-11-10: Milestone 2, Homepage and Design System

### Added

- Public layout (`src/app/(public)`): sticky header, primary navigation, mobile drawer with search, footer with editorial notice and build status
- Cinematic homepage with hero, search box and all 15 specified sections
- Navigation availability system: unimplemented routes render as labelled, unavailable items instead of dead links
- Homepage curation (`src/content/homepage.ts`) restricted to names and regions, enforced by tests
- Components: `Section`, `TopicRail`, `TopicPlate`, `StatusPill`, `EmptyState`, `FeaturedStories`, `TodayInHistory`, `ExploreWorld`, `EraTimeline`, `ContinentGrid`, `TechGrid`, `PopularSearches`, `Graticule`, `Wordmark`, `Sheet`, `MediaFrame`, Motion `Reveal` and `MotionProvider`
- World era definitions (`src/lib/history/eras.ts`)
- axe-core accessibility tests in both themes, plus keyboard, skip-link, 320 px overflow and mobile-menu e2e tests

### Changed

- Light theme `--gold`, `--bronze` and `--reconstruction` darkened for WCAG AA text contrast
- The milestone tracker moved from the homepage to the footer status line and `ROADMAP.md`

## [0.1.0] - 2026-11-10: Milestone 1, Project Foundation

### Added

- Next.js 16 application with TypeScript, Tailwind CSS 4 and shadcn/ui primitives (button, badge, card, input, separator)
- HISTORYVERSE design tokens (dark and light themes), Cormorant Garamond and Inter typography, theme toggle, skip link
- Foundation landing page with a milestone tracker, a custom 404 page and the `GET /api/health` probe
- Server environment validation (`src/server/env.ts`) with per-variable fault isolation
- Integration registry and status resolver (`src/server/integrations`)
- Provider contracts (`src/server/providers/contracts.ts`)
- Historical date engine (`src/lib/history/dates.ts`)
- Structured logger with secret redaction
- Baseline security headers
- Vitest unit and component tests, Playwright end-to-end tests, ESLint, Prettier, a GitHub Actions CI workflow
- Documentation set and `.env.example`
