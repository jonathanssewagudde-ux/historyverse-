# Architecture

## Overview

```
                 ┌──────────────────────── Next.js 16 (App Router) ────────────────────────┐
 Visitors ──────▶│  Public platform  (/, /countries, /people, /search, /ask-history …)      │
 Editors  ──────▶│  AI Studio        (/admin/**, role-protected)                            │
                 │  Route handlers   (/api/**) · Server Actions · Zod validation            │
                 └───────────┬──────────────────────────┬───────────────────────────────────┘
                             │                          │ enqueue
                     Prisma  ▼                          ▼
              ┌─────────────────────────┐     ┌──────────────────┐      ┌───────────────────────┐
              │ PostgreSQL + pgvector   │◀───▶│ Redis + BullMQ   │◀────▶│ Workers (Node)         │
              │ entities, articles,     │     │ durable job      │      │ research · ingestion   │
              │ claims, citations,      │     │ queues           │      │ TTS · FFmpeg           │
              │ media, jobs, audit      │     └──────────────────┘      │ render · YouTube upload│
              └─────────────────────────┘                                └──────────┬────────────┘
                             ▲                                                      │
                             └────────── object storage (local FS / S3) ◀───────────┘
```

The web app and the workers share one codebase and one database. Long-running work (rendering, narration, large imports, uploads) **never** runs inside a web request. It is queued and executed by dedicated workers, so it survives page reloads and can be retried step by step.

## Directory layout

```
src/
  app/                  Routes
    (public)/           Public site: shared header/footer layout, homepage
    api/health/         Liveness probe
    not-found.tsx       Branded 404
  components/
    ui/                 shadcn/ui primitives (Radix + Tailwind), owned source
    site/               Header, footer, wordmark, navigation (NavLink honours route availability)
    home/               Homepage sections and building blocks
    media/              MediaFrame: mandatory media-kind labelling and licence credit
    motion/             Motion provider (reduced-motion aware) and Reveal
  config/               Public, non-secret configuration (site, locales, milestones, navigation)
  content/              Editorial curation used before the database exists (names/regions only)
  lib/                  Isomorphic domain logic, safe for client and server
    history/dates.ts    Historical date model (BCE/CE, precision, circa, uncertainty, Wikidata)
    history/eras.ts     Conventional world-history eras (approximate, caveated)
  server/               Server-only code (guarded by `import "server-only"`)
    env.ts              Per-variable Zod validation of the environment
    logger.ts           Structured JSON logging with secret redaction
    integrations/       Registry of every integration, plus status resolution
    providers/          Provider contracts (LLM, embeddings, TTS, images, storage, archives, publishing)
  test/                 Test helpers
e2e/                    Playwright end-to-end tests
```

Also: `prisma/` (schema, migrations, seed), `scripts/` (operator tools), `tests/integration/` (real-database tests), `src/app/admin` (AI Studio), `src/server/{db,auth,users,admin}`.

Also: `src/server/sources/*` (Wikimedia adapters), `src/server/ingestion` (importer), `data/datasets` (seed lists), `tests/fixtures` (real source responses).

Job handlers live in `src/server/jobs` (M8); video rendering in `src/server/video` (M11).

## Key decisions

| Decision                                          | Rationale                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js 16, App Router, Cache Components**      | Server Components keep secrets and data access on the server. With Cache Components, static shells are prerendered and request-time data streams in. Note: `new Date()`/`Math.random()` cannot run in prerendered code; call `connection()` or move the code into a Client Component.                                     |
| **`proxy.ts`, not `middleware.ts`**               | Next 16 renamed the convention. Admin route protection goes here in M3, with authorization re-checked in every server action and handler.                                                                                                                                                                                 |
| **Tolerant, per-variable environment validation** | A malformed optional key (for example a bad `IMAGE_API_KEY`) must not take down the encyclopedia. Invalid values are dropped and surfaced as integration errors, and values are never echoed.                                                                                                                             |
| **Integration registry + provider contracts**     | Each external service is declared once (classification, milestone, env keys, fallback, billable flag) and consumed through an interface. Swapping a provider means writing a new adapter, not editing features.                                                                                                           |
| **Status honesty**                                | Status derived from configuration can only be `not_configured`, `configured` or `disabled`. `connected` requires a real connection test, and `implemented` stays false until an adapter ships.                                                                                                                            |
| **Historical date model**                         | JS `Date` has no precision, no "circa" and an astronomical year 0. HISTORYVERSE stores historical (Wikidata-style) numbering plus precision and flags, and sorts by astronomical key.                                                                                                                                     |
| **Cost safety**                                   | Billable providers must expose `estimateCost`. `AI_MONTHLY_BUDGET_USD` defaults to 0 (never spend). Paid calls need explicit approval.                                                                                                                                                                                    |
| **AI reconstruction labelling as a design token** | The `reconstruction` colour and badge variant are reserved for AI-generated imagery, so the label cannot be mistaken for ordinary styling.                                                                                                                                                                                |
| **"Neon bento" identity, dark default**           | Owner-chosen Gen-Z direction: near-black violet base, violet primary, lime/pink/cyan accents, rounded bento grids, Bricolage Grotesque display type, Inter body text and JetBrains Mono labels. Lime is only ever a background (with dark text), so contrast holds in both themes. The light theme is a full alternative. |

## Security baseline

- `server-only` guards every module that touches secrets. `NEXT_PUBLIC_*` variables are the only ones sent to the browser.
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and no `X-Powered-By`. A nonce-based CSP follows in M15, once embed and tile origins are fixed.
- The logger redacts secret-looking keys. The public health probe exposes no configuration.

## Testing strategy

| Layer      | Tool                                                        | Scope                                                               |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| Unit       | Vitest                                                      | Domain logic (dates, env, registry, redaction)                      |
| Component  | Vitest + Testing Library (jsdom)                            | Synchronous components. Async Server Components are covered by e2e. |
| End-to-end | Playwright (desktop + mobile Chromium) against `next start` | Rendering, theming, headers, 404, health, overflow                  |
| Static     | ESLint (zero warnings), `tsc`, Prettier                     | Every change                                                        |
