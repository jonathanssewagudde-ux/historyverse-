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

## Milestone 2: next steps

1. Public layout: header with primary navigation and search entry point, mobile drawer, footer.
2. Cinematic homepage: hero ("DISCOVER THE STORY OF OUR WORLD"), search bar, and the 15 homepage sections built as real components. Sections without data yet render honest empty states rather than invented content.
3. Design system: typography scale, motion primitives (Motion, respecting `prefers-reduced-motion`), media frame with mandatory attribution and AI-reconstruction labelling.
4. Accessibility pass (keyboard, contrast in both themes) and e2e coverage.

## Continuation notes (for the next coding session)

- Project root: `historyverse/`. Run `pnpm install && pnpm check && pnpm build && pnpm test:e2e` to confirm a clean state.
- Read `AGENTS.md`: Next 16 differs from older versions. Its bundled docs live in `node_modules/next/dist/docs/`.
- In this environment, Playwright must stay pinned to `@playwright/test@1.63.0` to match the pre-installed Chromium.
- Hosts blocked by the current environment's network policy: `ui.shadcn.com`, `*.wikipedia.org`, `www.wikidata.org`, `query.wikidata.org`, `commons.wikimedia.org`. Reachable: npm registry and Google Fonts.
