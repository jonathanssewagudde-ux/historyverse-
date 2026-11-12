# HISTORYVERSE

**Every Story. Every Civilization. Every Century.**

HISTORYVERSE is an AI-assisted historical knowledge platform made of two applications on one backend:

- **Public platform:** a sourced historical encyclopedia with articles, archival media, maps, timelines, family trees, documentaries and a grounded AI history assistant.
- **HISTORYVERSE AI Studio** (`/admin`): a private studio for research, article editing, media licensing, documentary scripting, narration, video rendering and YouTube publishing.

> **Status:** Milestones 1–10 are complete. Milestone 11 (Documentary Video Production) is awaiting review. See [ROADMAP.md](./ROADMAP.md).
> No historical content is published yet. Content arrives from Milestone 4 onward, sourced and reviewed.

## Requirements

| Tool       | Version               | Needed from  |
| ---------- | --------------------- | ------------ |
| Node.js    | ≥ 22                  | Milestone 1  |
| pnpm       | 10.x                  | Milestone 1  |
| PostgreSQL | 16+ with pgvector     | Milestone 3  |
| Redis      | 7+                    | Milestone 8  |
| FFmpeg     | 6+ (and DejaVu fonts) | Milestone 11 |

## Quick start

```bash
pnpm install
docker compose up -d         # PostgreSQL (pgvector) and Redis
cp .env.example .env.local   # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
pnpm db:migrate && pnpm db:seed
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' pnpm admin:create
pnpm dev                     # http://localhost:3000
pnpm worker                  # background jobs (research, drafts); needs REDIS_URL
```

## Scripts

| Command                                    | What it does                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`                                 | Development server (Turbopack)                                           |
| `pnpm build`                               | Production build                                                         |
| `pnpm start`                               | Serve the production build                                               |
| `pnpm lint`                                | ESLint (zero warnings allowed)                                           |
| `pnpm typecheck`                           | Generate route types, then `tsc --noEmit`                                |
| `pnpm format`                              | Prettier (with Tailwind class sorting)                                   |
| `pnpm test`                                | Vitest unit and component tests                                          |
| `pnpm test:e2e`                            | Playwright end-to-end tests, desktop and mobile (run `pnpm build` first) |
| `pnpm check`                               | lint + typecheck + format check + unit tests                             |
| `pnpm worker`                              | Background job worker (research, AI drafts)                              |
| `pnpm project:create "Topic" [--qid Q123]` | Start a Generate History Project from the command line                   |

Health probe: `GET /api/health`.

## Documentation

| Document                                     | Contents                                              |
| -------------------------------------------- | ----------------------------------------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md)         | System design, directory layout, key decisions        |
| [ROADMAP.md](./ROADMAP.md)                   | 15 milestones, status, continuation notes             |
| [CHANGELOG.md](./CHANGELOG.md)               | Release history                                       |
| [DATABASE.md](./DATABASE.md)                 | Data model plan (implemented in Milestone 3)          |
| [API_INTEGRATIONS.md](./API_INTEGRATIONS.md) | Mandatory and optional integrations, configuration    |
| [CONTENT_PIPELINE.md](./CONTENT_PIPELINE.md) | Generate History Project workflow and production jobs |
| [EDITORIAL_POLICY.md](./EDITORIAL_POLICY.md) | Accuracy, sourcing, AI-labelling and licensing rules  |
| [DEPLOYMENT.md](./DEPLOYMENT.md)             | Hosting topology and environment                      |
| [.env.example](./.env.example)               | Every configuration variable                          |

## Known limitations

- Public pages: homepage, kingdoms, countries, people, search, explore, sign-in, sign-up and profile. The AI Studio (`/admin`) has the CMS of Milestone 7, the research engine of Milestone 8, the media and reconstruction studio of Milestone 9, documentary scripts and narration of Milestone 10, and the video editor, music library and thumbnails of Milestone 11. Navigation shows every later route as unavailable, with the milestone that delivers it.
- No email delivery yet, so there is no email verification or self-service password reset. Super Administrators assign roles at `/admin/users` (or with `pnpm user:role`).
- The first article (Buganda) is a draft awaiting editorial approval; until an editor publishes it, the public sections show empty states.
- Homepage topic cards are planned subjects (name and region only). Search covers published articles only, so it stays small until more articles are approved.
- Scheduled publishing needs a scheduler calling `POST /api/cron/publish` with `CRON_SECRET`; without one, editors run due publications from the calendar.
- Video renders run on the worker with FFmpeg (free). The web server also needs FFmpeg for thumbnails and music checks. Remotion, named in the specification, is not used: its licence needs a paid company licence for larger organisations, which awaits the owner's decision.
- Narration works for free with eSpeak NG (installed separately); Piper voices need their licence checked before publishing. Paid voices need a key, a price and a budget.
- Image generation needs an image provider with a per-image price (none is configured by default). Reconstructions made with other tools can be uploaded instead, and are labelled the same way.
- AI drafting needs a language model: an API key plus an approved budget, or a free local model (Ollama). None is configured by default, so drafting reports that it is unavailable; research and source review work without one.
- The shadcn/ui CLI could not reach `ui.shadcn.com` from the build environment, so the components in `src/components/ui` were written by hand to the shadcn source conventions. `pnpm dlx shadcn add <component>` works on any network that allows that host.
