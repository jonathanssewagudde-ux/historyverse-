# Integrations

All integrations are declared in `src/server/integrations/registry.ts` and consumed through the contracts in `src/server/providers/contracts.ts`. The administrator page `/admin/integrations` (Milestone 7) renders this registry with live status and connection tests.

## Rules

1. A failed or unconfigured integration never stops unrelated features.
2. External responses are never simulated and presented as real. Missing credentials raise `ProviderUnavailableError`.
3. Billable calls show a cost estimate first, need explicit approval and respect `AI_MONTHLY_BUDGET_USD` (default `0`, meaning never spend).
4. Credentials live only in server environment variables and are never sent to the browser or written to logs.
5. Statuses: `not_configured` → `configured` (all required variables valid) → `connected` / `connection_failed` (only after a real test). `disabled` is set via `INTEGRATIONS_DISABLED`.

## Mandatory platform capabilities

| Integration    | Env                         | Milestone | Fallback when unavailable                |
| -------------- | --------------------------- | --------- | ---------------------------------------- |
| PostgreSQL     | `DATABASE_URL`              | 3         | none                                     |
| Auth.js        | `AUTH_SECRET`               | 3         | public pages stay readable               |
| Media storage  | `STORAGE_DRIVER` (+ `S3_*`) | 5         | local filesystem                         |
| Redis + BullMQ | `REDIS_URL`                 | 8         | browsing and manual editing keep working |
| FFmpeg         | `FFMPEG_PATH`               | 11        | none for rendering                       |
| Remotion       | none                        | 11        | none for rendering                       |
| MapLibre style | `MAP_STYLE_URL`             | 13        | bundled outline map                      |

## Mandatory external integrations (required for one capability each)

| Integration                            | Env                                                    | Milestone | Fallback                                 |
| -------------------------------------- | ------------------------------------------------------ | --------- | ---------------------------------------- |
| Wikidata, Wikipedia, Wikimedia Commons | `WIKIMEDIA_USER_AGENT`                                 | 4         | previously imported data                 |
| Language model                         | `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY` | 8         | manual editing, search, source retrieval |
| Text-to-speech                         | `TTS_PROVIDER`, `TTS_API_KEY`, `TTS_BASE_URL`          | 10        | upload recorded narration                |
| YouTube Data API                       | `YOUTUBE_OAUTH_*`                                      | 12        | local MP4 export and manual upload       |

Wikimedia requires a descriptive User-Agent with contact information ([policy](https://meta.wikimedia.org/wiki/User-Agent_policy)). The env validator enforces the format `AppName/version (contact)`.

### Language model providers

`ollama` (local, free), `openai-compatible` (any self-hosted server such as vLLM or llama.cpp), `anthropic`, `openai`, `gemini`. A ChatGPT, Claude or Gemini _subscription_ does not include API credits: API keys are billed separately.

Implemented in Milestone 8:

| `AI_PROVIDER`       | Adapter                                            | Price used for estimates                                    |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| `anthropic`         | Official SDK (`@anthropic-ai/sdk`), streamed       | Built-in list price for current Claude models, or the env   |
| `ollama`            | OpenAI-compatible endpoint on localhost            | Free (local)                                                |
| `openai`            | Chat Completions over HTTPS                        | `AI_INPUT_USD_PER_MTOK` / `AI_OUTPUT_USD_PER_MTOK` required |
| `openai-compatible` | Chat Completions at `AI_BASE_URL`                  | `AI_INPUT_USD_PER_MTOK` / `AI_OUTPUT_USD_PER_MTOK` required |
| `gemini`            | Not built; use Gemini's OpenAI-compatible endpoint | —                                                           |

Example: `AI_PROVIDER=anthropic`, `AI_MODEL=claude-opus-5-5`, `AI_API_KEY=…`. Nothing paid runs until an administrator sets a project budget and `AI_MONTHLY_BUDGET_USD`, and approves each job's estimate.

### Text-to-speech providers

`piper` and `espeak` (local, free) · `openai`, `elevenlabs`, `google` (paid). No real person's voice is cloned without documented authorization.

## Optional enhancements

| Integration             | Env                                                 | Milestone |
| ----------------------- | --------------------------------------------------- | --------- |
| Google sign-in          | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`              | 3         |
| Europeana               | `EUROPEANA_API_KEY`                                 | 4         |
| Library of Congress     | `LOC_ENABLED`                                       | 4         |
| Smithsonian Open Access | `SMITHSONIAN_API_KEY`                               | 4         |
| Embeddings / pgvector   | `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`             | 6 / 14    |
| AI image generation     | `IMAGE_PROVIDER`, `IMAGE_API_KEY`, `IMAGE_BASE_URL` | 9         |
| AI video generation     | `VIDEO_GEN_PROVIDER`, `VIDEO_GEN_API_KEY`           | after 11  |
| Analytics               | `ANALYTICS_PROVIDER`, `ANALYTICS_KEY`               | 15        |

## Wikimedia sources (implemented in Milestone 4)

- Set `WIKIMEDIA_USER_AGENT`; without it the importer refuses to run.
- Entities are read from `Special:EntityData` and SPARQL, which are less throttled than the action API. Commons metadata uses the action API and may wait on `Retry-After`.
- Wikidata content is CC0. Wikipedia text is CC BY-SA and is used as a research input only, never copied into articles. Commons files keep their own licence, recorded per file.
- Behind an HTTPS proxy, set `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses it.

## Adding a provider

1. Add any new environment variables to `serverEnvSchema` in `src/server/env.ts` and to `.env.example`.
2. Add or extend an entry in `registry.ts` (classification, `missing()`, fallback, `billable`).
3. Implement the relevant contract in `src/server/providers/<kind>/<provider>.ts`, including a real connection test.
4. Set `implemented: true` and add tests.
