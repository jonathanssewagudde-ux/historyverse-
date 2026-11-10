# Changelog

All notable changes to HISTORYVERSE are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
