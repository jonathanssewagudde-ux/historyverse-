# Roadmap

Each milestone is implemented, tested, documented and **reviewed by the project owner before the next begins**.
The milestone list in `src/config/milestones.ts` mirrors this file.

| #   | Milestone                                  | Status                                                                                                 |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1   | Project Foundation                         | ✅ Complete, awaiting review                                                                           |
| 2   | Homepage and Design System                 | Planned                                                                                                |
| 3   | Database and Authentication                | Planned                                                                                                |
| 4   | Historical Data Integration                | Planned (**blocked by network:** Wikimedia hosts are not reachable from the current build environment) |
| 5   | Historical Article System                  | Planned                                                                                                |
| 6   | Historical Search Engine                   | Planned                                                                                                |
| 7   | Administrator CMS                          | Planned                                                                                                |
| 8   | AI Historical Research Engine              | Planned                                                                                                |
| 9   | Image and AI Reconstruction Studio         | Planned                                                                                                |
| 10  | Documentary Scripts and Narration          | Planned                                                                                                |
| 11  | Documentary Video Production Studio        | Planned                                                                                                |
| 12  | YouTube Integration                        | Planned                                                                                                |
| 13  | Maps, Timelines and Family Trees           | Planned                                                                                                |
| 14  | AI Assistant and Global Features           | Planned                                                                                                |
| 15  | Testing, Optimization and Launch Readiness | Planned                                                                                                |

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

## Milestone 3: next steps

1. PostgreSQL + pgvector via Docker Compose (and the local Postgres 16 in this container), with Prisma schema and migrations for the models in `DATABASE.md`.
2. Auth.js with credentials and optional Google sign-in, roles (Super Administrator, Administrator, Editor, Researcher), `proxy.ts` protection for `/admin/**`, and authorization re-checked on the server.
3. User profiles (`/profile`), seed script for a first super-administrator, audit-log foundation.
4. Health probe gains a database readiness check.

## Continuation notes (for the next coding session)

- Project root: `historyverse/`. Run `pnpm install && pnpm check && pnpm build && pnpm test:e2e` to confirm a clean state.
- Read `AGENTS.md`: Next 16 differs from older versions. Its bundled docs live in `node_modules/next/dist/docs/`.
- In this environment, Playwright must stay pinned to `@playwright/test@1.63.0` to match the pre-installed Chromium.
- Hosts blocked by the current environment's network policy: `ui.shadcn.com`, `*.wikipedia.org`, `www.wikidata.org`, `query.wikidata.org`, `commons.wikimedia.org`. Reachable: npm registry and Google Fonts.
