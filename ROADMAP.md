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
| 7   | Administrator CMS                          | ✅ Complete                  |
| 8   | AI Historical Research Engine              | ✅ Complete                  |
| 9   | Image and AI Reconstruction Studio         | ✅ Complete                  |
| 10  | Documentary Scripts and Narration          | 🔍 Complete, awaiting review |
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

## Milestone 7: Administrator CMS ✅

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

## Milestone 8: AI Historical Research Engine ✅

- **Job system:** Redis + BullMQ (`pnpm worker`). The `production_jobs` row is the source of truth. A queue delivery only asks a worker to run that row; the row decides whether it runs, so duplicates are harmless.
  - Progress and the current step are recorded.
  - People can cancel a job; it stops at its next safe point.
  - Transient failures (rate limits, network) are retried with backoff. Other failures, and exhausted attempts, end as `FAILED` with the reason.
  - When a worker starts, it re-queues jobs that were waiting or interrupted.
  - `QUEUE_PREFIX` keeps environments that share a Redis server apart.
- **Generate History Project** (administrators): topic, optional Wikidata id, budget (default $0).
- **Step 1, research:** free sources only, no AI.
  - It finds the subject on Wikidata, or uses the id given, and shows the other matches.
  - It imports the subject with provenance, reads the Wikipedia article by section (CC BY-SA, a research input only), and finds books in Open Library. Other editions count once. The Library of Congress is searched when `LOC_ENABLED`.
  - The report lists the dated statements and any **differing accounts**: two different values for a property that holds one date (founding, dissolution, birth, death). These are presented side by side, not resolved.
  - A live run on "The Complete History of the Buganda Kingdom" found Q473748 by search, imported it, and gathered 14 Wikipedia sections and 10 catalogue books, waiting out a Wikidata rate limit along the way.
- **Source-set review (checkpoint):** a person accepts or rejects each source (rejecting needs a reason), then approves the set. Approval locks it. Reopening it cancels draft jobs based on it. The database refuses a decision without a reviewer.
- **Step 2, AI article draft:**
  - The model sees only the accepted evidence: Wikipedia sections and imported Wikidata statements. Books are cited only as further reading, never for facts.
  - After generation the draft is checked, whatever the model was told:
    - every sentence must cite an existing excerpt;
    - sentences that don't are removed and listed for the reviewer;
    - key dates whose year is not in the cited excerpt are removed;
    - passages of ten or more words copied from the sources are flagged.
  - The draft is saved as an **unreviewed AI draft** (`containsUnreviewedAi`, claims `AI_DRAFT`/`UNVERIFIED`) in the normal editorial workflow, so it cannot be published without research review and editorial approval.
- **Language models:** `anthropic` (official SDK; structured JSON output; refusals stop the job), `ollama`, `openai`, `openai-compatible`.
- **Spending:**
  - Every paid job gets an estimate first. It is an upper bound: estimated prompt tokens plus the full output budget.
  - It waits in `AWAITING_APPROVAL` until an administrator approves it, within the project budget **and** `AI_MONTHLY_BUDGET_USD`. Both default to $0.
  - Actual cost is computed from the provider's reported usage and recorded as soon as the call returns, even if the job then fails. Paid jobs are not retried automatically.
  - Prices: built in for current Claude models; otherwise `AI_INPUT_USD_PER_MTOK` / `AI_OUTPUT_USD_PER_MTOK` are required. An unknown price means the model counts as not configured.
- **Tests:** 215 unit/component, 102 integration (including a real BullMQ worker round-trip and research against recorded API responses), 96 end-to-end.

### Not verified, and why

- **No language model has been configured or called.** Drafting is tested end to end with a test-double model, including the grounding checks, cost recording, refusals and invalid output. It has never run against a real model, because that needs either an API key and an approved budget (owner's decision) or a local model (Ollama could not be downloaded in this environment).
- Automatic server-side "refusal fallback" to another model is deliberately not enabled: it would bill a different model than the one whose cost was approved.

### Not done (planned)

- Steps 3–11 of the pipeline (media discovery, reconstructions, script, narration, video, YouTube): Milestones 9–12.
- Retrieval from scholarly full text (JSTOR, archives with OCR) and semantic search: later milestones, and they need licensed access.

## Milestone 9: Image and AI Reconstruction Studio ✅

- **Archival media discovery (pipeline step 3):** a `MEDIA_SEARCH` job searches Wikimedia Commons for the subject (and the Library of Congress when `LOC_ENABLED`; its search results carry no licence, so those images are marked UNKNOWN).
  - Each image is a **candidate** with the archive's stated licence, rights wording, creator, date and a link to its page.
  - **Selecting** one requires confirming the licence was checked on the source page. It then enters the media library as unclassified and pending, linked to the subject, recording who checked the licence. **Rejecting** needs a reason.
  - The database refuses a decision without a reviewer.
  - Live run on the Buganda project: 30 Commons images (17 CC0, 9 CC BY-SA 4.0, 3 CC BY 2.0, 1 public domain). Some show why a person must check: a kingdom logo labelled CC0 by its uploader.
- **AI Image Studio (`/admin/ai-images`, pipeline step 4):**
  - A reconstruction prompt must link at least one source, saying what each supports, and state what rests on evidence and what is interpretation. These notes travel with every image made from it.
  - "Start from the subject" builds a starting prompt from the subject, place and period, with `[describe …]` placeholders that must be replaced from the sources before saving.
- **Generation (`IMAGE_GENERATION` job):** adapters for `openai`, `openai-compatible` (for example a local server) and `stability`. `gemini` and `comfyui` are not built.
  - A per-image price is required (`IMAGE_USD_PER_IMAGE`; 0 for a free local server).
  - Paid generation waits for an administrator's approval within the project budget and the monthly ceiling. Cost is recorded per image returned.
  - Images are stored as `AI_RECONSTRUCTION` (licence HISTORYVERSE original), with an attribution that says "Not an authentic image". Variations are recorded with the same prompt and evidence.
- **Without a generator:** write the prompt, make the image with any tool and upload it. It is labelled exactly the same, and the tool is named in the attribution.
- **Review:** editors approve a reconstruction only with a description. Its alt text always starts with "AI reconstruction:". Publication never approves reconstructions in bulk, so an unreviewed one stays hidden. The database already prevents relabelling a reconstruction as authentic (Milestone 3 trigger).
- **Articles:** approved reconstructions can be attached in the editor, where their label is fixed. Public pages show the label on the image and in the caption.
- **Storage:** an S3-compatible driver (`STORAGE_DRIVER=s3`: AWS S3, R2, MinIO and similar) with private objects and short-lived signed URLs. It is tested against s3rver, a local S3 server, with no cloud account involved.
- **Tests:** 218 unit/component, 115 integration (including a recorded Commons search response, image generation with a test double, and S3), 100 end-to-end.

### Not verified, and why

- **No image generator has been configured or called.** Generation is tested end to end with a test double: approval, storage, labelling, variations, costs and failure. It has never run against a real image API, because that needs an API key and a budget (the owner's decision) or a local server.
- The S3 driver is tested against a local emulator, not a real cloud bucket.

### Not done (planned)

- Gemini and ComfyUI image adapters; Europeana and Smithsonian search (they need API keys).
- Documentary scripts, scene plans and narration: Milestone 10.

## Milestone 10: Documentary Scripts and Narration 🔍 (in review)

- **Script generator (pipeline step 5):** builds a script from an article's **reviewed text**, in the documentary structure: hook → background → origins → key developments → important figures → turning points → consequences → significance → conclusion.
  - Each paragraph becomes one or more scenes of up to about 90 words, keeping that paragraph's citations.
  - Turning points come from the article's cited key dates.
  - A part of the structure with no material is left out, never invented.
  - Nothing is written by AI.
  - Uncited text (such as an editorial note) stays uncited and blocks approval until an editor cites, rewrites or removes it.
  - The live Buganda article gives 24 scenes, about 8½ minutes.
- **Scene planner (step 6):** narration, visual description, on-screen text and duration per scene.
  - Images: only approved, publishable ones.
  - Citations: only the article's own, from sections or key dates.
  - Scenes can be reordered, added and removed.
- **Review:** an editor approves a script only when the article is published (so the narration is editorially approved text) and every scene has narration, a citation and an image. Scripts are versioned; approved versions are revised as new drafts and superseded versions are kept.
- **Narration (step 7):** narrates approved scripts only, so paid narration is never wasted on text that will change.
  - **Free engines:**
    - eSpeak NG (formant synthesis, no recorded-voice dataset);
    - Piper (neural; each voice has its own licence: the `en_GB-alan` card says only "See URL", and its base voice comes from a dataset under research-type terms, so Piper voices are not assumed publishable).
  - **Paid engines:** OpenAI and ElevenLabs, stock voices only, with a required price per million characters, approval within budgets, and cost recorded as each scene is spoken.
  - A pronunciation guide applies to whole words.
  - Scene durations grow to fit the audio plus a short pause.
- **Recordings:** WAV or MP3 per scene. The uploader confirms the speaker consented to publication, and this is stored with the take.
- **Voice licence:** every take records it. The Studio flags takes whose licence nobody has stated; the YouTube step (Milestone 12) will check it. Earlier takes are kept; the database allows one current take per scene.
- **Live checks:**
  - eSpeak narrated the whole Buganda script in the integration test (real audio, durations read from the WAV files).
  - The Piper adapter produced real speech with the `en_GB-alan-medium` voice.
  - Both are available in this development environment (`TTS_PROVIDER=espeak` in `.env.local`).
- **Tests:** 224 unit/component, 123 integration, 104 end-to-end.

### Not verified, and why

- OpenAI and ElevenLabs speech were not called (they need keys and a budget).
- The Buganda documentary in the development database is a draft: its script cannot be approved and narrated until the article is published, which is the owner's decision.

### Not done (planned)

- An AI pass that restructures narration (it would need a language model and a budget); a Google speech adapter.
- Video rendering with Remotion and FFmpeg, captions and music: Milestone 11.

## Milestone 11: next steps

Documentary Video Production Studio: Remotion composition from the scene plan (images with camera moves, on-screen text, labelled reconstructions), narration and licensed music mixing with FFmpeg, captions from the narration text, 16:9 and 9:16 renders as jobs, and the source and licence manifest.

## Continuation notes (for the next coding session)

- Project root: `historyverse/`. Run `pnpm install && pnpm check && pnpm build && pnpm test:e2e` to confirm a clean state.
- Read `AGENTS.md`: Next 16 differs from older versions. Its bundled docs live in `node_modules/next/dist/docs/`.
- In this environment, Playwright must stay pinned to `@playwright/test@1.63.0` to match the pre-installed Chromium.
- Local services: start PostgreSQL with `service postgresql start` if the container restarted; the dev database is `historyverse`, the test database `historyverse_test`.
- Network: Wikidata, Wikipedia and Commons are reachable, but Commons often answers HTTP 429 (throttling); scripts wait for its Retry-After. Node `fetch` needs `NODE_USE_ENV_PROXY=1` to use the environment's proxy. `ui.shadcn.com` was blocked.
- The Buganda article draft (`data/articles/buganda-kingdom.json`) still awaits the owner's editorial approval. It has never been published in the development database.
- Narration engines: `apt-get install espeak-ng` (free). Piper: `pip install piper-tts` plus a voice model (`.onnx` and `.onnx.json`) from huggingface.co/rhasspy/piper-voices, then set `PIPER_PATH` and `PIPER_MODEL`. Check the voice's model card before publishing.
- Background jobs: start Redis (`service redis-server start`) and a worker (`pnpm worker`). The dev `.env.local` has `REDIS_URL=redis://127.0.0.1:6379`; tests use database 1 and the `historyverse-test` prefix.
