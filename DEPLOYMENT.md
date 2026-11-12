# Deployment

> **Status:** target topology. Production deployment is completed and verified in Milestone 15. No hosting provider is mandatory.

## Components

| Component      | Requirement                                                             | Options                                                             |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Web app        | Node 22 runtime for Next.js 16                                          | Vercel, a container on any VM, Fly.io, Render, a Kubernetes cluster |
| Database       | PostgreSQL 16+ with pgvector                                            | Managed Postgres (Neon, Supabase, RDS, Cloud SQL) or self-hosted    |
| Queue          | Redis 7+                                                                | Managed Redis or self-hosted                                        |
| Workers        | **Long-running** Node processes with FFmpeg and Chromium (for Remotion) | VM or container. **Not** serverless functions.                      |
| Object storage | S3-compatible                                                           | S3, R2, MinIO, GCS (S3 API)                                         |

Video rendering and narration run only on dedicated workers. Serverless request timeouts are too short, and those functions lack FFmpeg.

From Milestone 8, run at least one worker next to the web app: `pnpm worker`, with the same environment and `REDIS_URL`. It processes research, drafting, media, image and narration jobs, and re-queues interrupted jobs when it starts. Free local narration needs `espeak-ng` (or Piper and a voice model) installed on the worker. Several workers can share one queue. `QUEUE_PREFIX` keeps environments that share a Redis server apart.

## Build and run

```bash
pnpm install --frozen-lockfile   # also generates the Prisma client
pnpm db:deploy                   # apply migrations
pnpm db:seed                     # licences and categories (idempotent)
pnpm build
pnpm start            # serves on $PORT (default 3000)
```

Liveness: `GET /api/health`. Dependency readiness checks are added as each dependency arrives.

## Configuration

Set environment variables from `.env.example` in the host's secret manager. `AUTH_URL` must be the public https origin (cookies are then marked Secure). If the app sits behind a proxy, make sure the client IP header is forwarded so auth rate limiting works per visitor. Never bake secrets into images. Only `NEXT_PUBLIC_*` values reach the browser.

## Scheduled publishing

Articles scheduled in the Studio's publishing calendar are published by `POST /api/cron/publish`. Set `CRON_SECRET` (at least 32 characters) and call the endpoint every few minutes from any scheduler:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-site.example/api/cron/publish
```

Without `CRON_SECRET` the endpoint answers 404 and editors publish due articles from the calendar instead.

## Uploads

Server Actions accept request bodies up to 11 MB (`next.config.ts`) so the media library can take 10 MB images. A reverse proxy in front of the app must allow at least that body size.

## Operations checklist (completed in Milestone 15)

- Automated database backups and restore drill
- Error monitoring (`instrumentation.ts` `onRequestError`)
- Nonce-based Content-Security-Policy
- Rate limiting on search, assistant and auth endpoints
- CDN caching for static shells and media
