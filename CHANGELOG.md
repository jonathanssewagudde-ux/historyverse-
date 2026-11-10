# Changelog

All notable changes to HISTORYVERSE are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
