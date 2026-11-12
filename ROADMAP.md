# Roadmap

Each milestone is implemented, tested, documented and **reviewed by the project owner before the next begins**.
The milestone list in `src/config/milestones.ts` mirrors this file.

| #   | Milestone                                  | Status                       |
| --- | ------------------------------------------ | ---------------------------- |
| 1   | Project Foundation                         | ✅ Complete                  |
| 2   | Homepage and Design System                 | ✅ Complete                  |
| 3   | Database and Authentication                | ✅ Complete                  |
| 4   | Historical Data Integration                | ✅ Complete                  |
| 5   | Historical Article System                  | ✅ Complete                  |
| 6   | Historical Search Engine                   | ✅ Complete                  |
| 7   | Administrator CMS                          | 🔍 Complete, awaiting review |
| 8   | AI Historical Research Engine              | Planned                      |
| 9   | Image and AI Reconstruction Studio         | Planned                      |
| 10  | Documentary Scripts and Narration          | Planned                      |
| 11  | Documentary Video Production Studio        | Planned                      |
| 12  | YouTube Integration                        | Planned                      |
| 13  | Maps, Timelines and Family Trees           | Planned                      |
| 14  | AI Assistant and Global Features           | Planned                      |
| 15  | Testing, Optimization and Launch Readiness | Planned                      |

## Milestone 1: Project Foundation ✅

- Next.js 16.4 (App Router, Turbopack, Cache Components, typed routes), React 19.3, TypeScript 5.9 strict
- Tailwind CSS 4 with HISTORYVERSE design tokens (dark midnight / light parchment) and shadcn/ui primitives
- Zod-validated environment with per-variable fault isolation
- Integration registry (21 integrations: mandatory vs optional, milestone, fallback, billable) and status resolver
- Provider contracts for LLM, embeddings, TTS, image generation, storage, archive sources and video publishing
- Historical date engine (BCE/CE, precision, circa/uncertain, Julian, Wikidata parsing, chronological sort)
- Structured logger with secret redaction, a health probe and baseline security headers
- Vitest (59 tests), Playwright (12 tests: 6 scenarios × desktop/mobile), ESLint, Prettier, CI workflow

## Milestone 2: Homepage and Design System ✅

- Public route group `src/app/(public)` with a shared header and footer. The AI Studio gets its own layout in Milestone 7.
- Sticky header with primary navigation, a theme toggle and a mobile drawer (Radix Dialog sheet) that includes search.
- **Honest navigation:** routes that do not exist yet render as unavailable items labelled with their milestone, never as links to 404s. A route becomes a link once it is added to `availableRoutes` in `src/config/navigation.ts`.
- Cinematic homepage: hero ("Discover the story of our world"), a decorative SVG graticule (deliberately without coastlines or borders), and all 15 specified sections in order.
- Homepage curation in `src/content/homepage.ts` names real subjects by **name and region only**. A test fails if any entry contains a number, so dates cannot slip in uncited.
- Data-driven sections (Today in History, Latest Documentaries, Recently Published) show honest empty states. Today's date comes from the visitor's browser.
- Search box: labelled search landmark and suggestion chips. Until Milestone 6 it explains that search is not open yet instead of faking results.
- Interactive era timeline using the WAI-ARIA tabs pattern with arrow-key support. Era boundaries are marked "c." and caveated as conventions.
- Design system additions: section shell, topic plates (abstract monograms, never imitation imagery), status pills, empty states, a Sheet component, Motion reveal animations respecting `prefers-reduced-motion`, and `MediaFrame`. `MediaFrame` makes the media-kind label and source/licence credit mandatory and always shows _"AI-Generated Historical Reconstruction — Not an Authentic Photograph"_ on reconstructions.
- Accessibility: axe-core scans (WCAG 2.1 AA) pass in dark and light themes on desktop and mobile. Also covered: skip link, keyboard operation and no horizontal overflow at 320 px. Every colour token is checked for AA contrast by these scans.
- Tests: 108 unit/component (Vitest) and 31 end-to-end (Playwright; 1 mobile-only test skipped on desktop).

### Milestone 2 revision: "Neon bento" redesign

At the owner's request after review, the UI moved from the original editorial "museum" look (navy, gold, serif) to a Gen-Z **neon bento** style. Details:

- **Tokens and type:** new colour tokens (violet, lime, hot pink, cyan on a near-black base) and Bricolage Grotesque, Inter and JetBrains Mono fonts.
- **Layout:** a floating pill navbar, rounded bento grids, gradient plates, sticker badges and a topic marquee.
- **Homepage details:** a lime-pill era switcher, a giant gradient footer wordmark, and playful section kickers. Section titles still follow the specification.
- **Reconstruction label:** now amber, kept distinct from the brand violet.
- **Unchanged:** all behaviour, honesty rules and accessibility checks. axe passes in both themes.

## Milestone 3: Database and Authentication ✅

- **Database:** PostgreSQL 16 with pgvector and pg_trgm; Prisma 7 schema of 60 models in seven domain files; two migrations (generated tables plus hand-written integrity constraints and triggers); seed of 15 media licences and 11 categories. See `DATABASE.md`.
- **Authentication:** Better Auth (email and password, optional Google sign-in), database sessions, scrypt password hashing, database-backed rate limiting in production. Auth.js was not used because its own README now recommends Better Auth for new projects.
- **Roles:** USER, RESEARCHER, EDITOR, ADMINISTRATOR, SUPER_ADMINISTRATOR with a hierarchical permission matrix (`src/lib/auth/roles.ts`). Roles cannot be set through the auth API. The role is re-read from the database on every request, so a demotion applies immediately. The last Super Administrator cannot be demoted.
- **Protection:** `src/proxy.ts` redirects visitors without a session cookie; every protected page then validates the session and permission on the server (`src/server/auth/session.ts`). A forged cookie gets no access.
- **Pages:** `/sign-in`, `/sign-up`, `/profile` (edit details, change password, sign out) and the AI Studio shell at `/admin` with real database counts, integration status and recent audit activity, shown according to permission.
- **Audit log:** append-only table; registrations, sessions and role changes are recorded.
- **Operator tools:** `pnpm admin:create`, `pnpm user:role`.
- **Health probe:** `/api/health` now makes a real database round trip and reports `degraded` (503) if it fails.
- **Tests:** 131 unit/component, 35 integration (real PostgreSQL), 65 end-to-end (1 mobile-only test skipped on desktop).

## Milestone 4: Historical Data Integration ✅

- **Polite source client** (`src/server/sources/http.ts`): per-host pacing, retries with backoff that honour `Retry-After`, descriptive User-Agent, and no invented responses when retries run out.
- **Adapters:** Wikidata (entity data and SPARQL), Wikipedia (summaries as research input only), Wikimedia Commons (file metadata, licence and attribution).
- **Importer** (`src/server/ingestion/wikidata-import.ts`, `pnpm ingest:wikidata`):
  - creates draft entities with detail rows, structured dates (precision and calendar preserved), aliases and external identifiers;
  - stores every Wikidata statement as an UNVERIFIED claim citing the exact statement id;
  - links places, family relationships and terms of office between imported entities;
  - records image licence and attribution as UNCLASSIFIED, pending-review media (no files downloaded yet);
  - is idempotent, never overwrites an entity that has entered review, and never touches verified claims;
  - records each run as an ingestion job and in the audit log.
- **Initial dataset** (`data/datasets/uganda-buganda.json`): imported live from Wikidata on 2026-11-10: 28 entities (Uganda, Buganda, Kampala and 25 people of the Buganda royal family), 218 claims, 26 family links, 9 terms of office, 10 media records.
- **Studio page** `/admin/imports`: imported entities with dates, claim counts, review status and source links, plus import runs.
- **Tests:** 167 unit/component, 44 integration, 67 end-to-end. Mapping tests use real Wikidata and Commons responses saved as fixtures.

### Known limits of the data

- Wikidata's coverage of the Kabakas is incomplete (only some are linked to the office), and several dates are simplifications (for example Buganda "1420 – 1966"). That is why everything is imported as unverified.
- Wikimedia throttles shared cloud IPs on its action API. The client waits and retries, so imports with media can take minutes.
- Behind an HTTPS proxy, run the importer with `NODE_USE_ENV_PROXY=1`.

## Milestone 5: Historical Article System ✅

- **Article files** (`data/articles/*.json`, schema in `src/server/content/article-file.ts`): reviewable, version-controlled drafts. Every factual section must cite a declared source (`[@source|locator]`), dates are validated, and AI-assisted drafts are flagged.
- **Loader** (`pnpm article:load`): writes a file as a DRAFT with sections, numbered citations, sources, dated key-date claims, linked entities and proposed image classifications. It keeps a revision snapshot, and refuses to overwrite an article that has entered review.
- **Publishing** (Studio `/admin/articles/[id]`): editors preview exactly what readers will see, annotated with review notes and with every withheld image and its reason. To publish they must tick a source-check confirmation. Publishing:
  - records the approving editor, an EditorialReview, a revision snapshot and an audit entry;
  - verifies the key dates;
  - approves only images that are classified, publishable and stored.
    Unpublishing requires a reason.
- **Public pages:** `/kingdoms`, `/countries`, `/people` and their `[slug]` article pages. Each has a hero image, cited sections, a key-dates timeline, people and places, an image gallery, a documentary slot, numbered sources and references, further reading, text-size and share controls, and Open Graph metadata. Article data is cached (`use cache`), and publishing refreshes it immediately (`updateTag`).
- **Real 404s:** `proxy.ts` checks article slugs with one indexed query and rewrites unknown or unpublished ones to a static not-found page, because streamed pages are committed to HTTP 200.
- **Media storage:** local storage provider (content-addressed, path-traversal-safe), `pnpm media:fetch` to download an article's Commons images, and `/media/[id]`, which serves only approved, publishable images publicly and everything else only to signed-in staff.
- **First article:** _The Complete History of the Buganda Kingdom_, drafted from sources retrieved in-session:
  - the Library of Congress _Uganda: A Country Study_ (1990, public domain);
  - Uganda's 1995 Constitution, Article 246;
  - Wikidata;
  - Wikipedia, used only for Ganda oral tradition and to corroborate a date.
    It presents both origin accounts (Kintu in Ganda tradition; Kimera in the Library of Congress study). It is loaded as an **unreviewed AI draft awaiting the owner's editorial approval**.
- **Tests:** 182 unit/component, 56 integration, 76 end-to-end (1 mobile-only skipped on desktop; the serial article flow runs on desktop only).

### Image review notes for the Buganda article

| Commons file                              | Classified as                             | Decision                                                                                                                                         |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| King Mwanga II Buganda.jpg                | Historical artwork (engraving)            | Public domain, hero image                                                                                                                        |
| Mutesa I.jpg                              | Photograph, date and photographer unknown | Public domain per Commons, weak provenance (sourced from a website)                                                                              |
| Sir. Edward Fredrick Mutesa… .jpg         | Photograph                                | Public domain per Commons                                                                                                                        |
| Kabaka Muwenda Mutebi II cropped.jpg      | Modern photograph                         | CC0                                                                                                                                              |
| Uganda – Location Map (2013) – UNOCHA.svg | Map                                       | CC BY 3.0, attribution shown                                                                                                                     |
| Buganda map.jpg                           | **Not used**                              | Commons calls it a 1910 public-domain map, but it is visibly a modern digital map of present-day districts, so the date and licence are doubtful |

## Milestone 6: Historical Search Engine ✅

- **Search index** (`search_documents`): one row per published article, written in the same transaction as publication and removed on unpublishing, so search can only surface reviewed content. It holds a weighted `tsvector`, names, countries, continents, subject years and key-date years. `pnpm search:reindex` rebuilds it.
- **Matching** (all in PostgreSQL, no paid services):
  - Weighted full-text search: names and title > summary > body. Prose uses English stemming and stop words; names use exact (`simple`) matching.
  - Accent-insensitive (`unaccent`), so "Muteesá" finds "Muteesa".
  - Natural-language questions: "Who was Kabaka Mwanga?" becomes the meaningful words.
  - Year questions: "What happened in 1993?" and "Who ruled France in 1804?" match key dates and the subject's lifespan, and show the matching dates. BCE years are understood.
  - Typo tolerance with `pg_trgm`, including a "Did you mean …?" suggestion.
- **`/search`:** highlighted snippets, type / era / continent filters with counts, related searches, pagination and honest empty states (it says how many articles are published). Results are cached and refreshed on publish. Search pages are `noindex`.
- **`/explore`:** browse by type, era and continent. The homepage continent cards now lead there.
- **Autocomplete:** `/api/search/suggest` (prefix + fuzzy, published only, 60 requests a minute per visitor) and an accessible combobox used on the homepage and the search page. It is a plain GET form underneath, so it works without JavaScript.
- **Tests:** 204 unit/component, 69 integration (13 for search, including SQL/tsquery injection attempts), 81 end-to-end.

### Not done (planned)

- Semantic search with pgvector embeddings (optional; needs an embedding provider), in Milestone 14 alongside the AI assistant.
- Searching unpublished, imported records: that belongs in the Studio (Milestone 7).
- "Popular searches" ranked by real usage requires analytics (Milestone 15).

## Milestone 7: Administrator CMS 🔍 (in review)

- **Editorial workflow:** articles move draft → research review → editorial approval → published.
  - Researchers submit drafts. Editors approve the research, request changes (with a note the author sees) or publish.
  - Publishing re-checks everything: editorial approval, a citation in every factual section, image licences and classification.
  - Each decision is an `EditorialReview` row and an audit entry. Requesting changes cancels any scheduled publication.
- **Article editor:** create and edit drafts in the Studio.
  - Sources, citation insertion (`[@key|locator]`), sections, key dates (historical numbering, precision, circa), linked entities, images and categories.
  - Unfinished drafts can be saved; missing citations show as warnings and still block publication.
  - Drafts round-trip unchanged through the same format as `data/articles/*.json` (tested).
- **Entity managers** (countries, people, kingdoms and states, civilizations, events):
  - Search by name, alias or Wikidata id, and import an item by Wikidata id.
  - Each imported claim is shown with its source. Editors verify or reject claims; verification needs a cited source.
- **Media library:**
  - Upload: the file type is read from the file's bytes, with a 10 MB cap and duplicate detection.
  - Classify what the image is, record its licence, attribution and alt text, and download imported Commons files.
  - Editors approve an image only if it is classified, publishable, stored and described. Changing the kind or licence sends it back to review.
- **References:** correct a source once; every citation to it follows, and published pages refresh.
- **Editorial reviews:** queue of articles awaiting review, reader error reports (submitted from published articles by signed-in readers, rate-limited), and counts of images and claims to check.
- **Publishing calendar:** an editor schedules an approved article, confirming the source check at that moment.
  - Due articles are published by `POST /api/cron/publish` (bearer `CRON_SECRET`, disabled without it) or by "Publish due articles now".
  - Each run republishes with every check, as the approving editor, who must still hold the role. Failures are recorded, never retried silently.
- **Categories:** nesting with loop prevention, stable addresses after renames, deletion only when unused.
- **Users:** Super Administrators assign roles. The last Super Administrator cannot be demoted, and nobody changes their own role.
- **Integrations:** live connection tests. These are real, free, read-only requests; "Connected" only ever comes from a passing test. Integrations without an adapter offer no test.
- **Settings and audit log:** read-only platform settings (from the environment; secrets never shown) and a filterable view of the append-only audit log.
- **Tests:** 204 unit/component, 90 integration, 90 end-to-end (including axe scans of 11 Studio pages in both themes).

### Not done (planned)

- Timeline Manager (Milestone 13) and Analytics (Milestone 15) remain labelled in the Studio navigation.
- AI reconstructions are managed in the AI Image Studio (Milestone 9); the library refuses to reclassify them.
- Settings are environment-based; there is no in-browser settings editor, by design.
- No email notifications for reviews or reader reports yet (no email provider is configured).

## Milestone 8: next steps

AI Historical Research Engine: Generate History Project, source retrieval with evidence tracking, AI-assisted drafts that enter this editorial workflow as unreviewed drafts, and the job queue (Redis + BullMQ).

## Continuation notes (for the next coding session)

- Project root: `historyverse/`. Run `pnpm install && pnpm check && pnpm build && pnpm test:e2e` to confirm a clean state.
- Read `AGENTS.md`: Next 16 differs from older versions. Its bundled docs live in `node_modules/next/dist/docs/`.
- In this environment, Playwright must stay pinned to `@playwright/test@1.63.0` to match the pre-installed Chromium.
- Local services: start PostgreSQL with `service postgresql start` if the container restarted; the dev database is `historyverse`, the test database `historyverse_test`.
- Network: Wikidata, Wikipedia and Commons are reachable, but Commons often answers HTTP 429 (throttling); scripts wait for its Retry-After. Node `fetch` needs `NODE_USE_ENV_PROXY=1` to use the environment's proxy. `ui.shadcn.com` was blocked.
- The Buganda article draft (`data/articles/buganda-kingdom.json`) still awaits the owner's editorial approval. It has never been published in the development database.
