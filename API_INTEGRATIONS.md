# Integrations

All integrations are declared in `src/server/integrations/registry.ts` and consumed through the contracts in `src/server/providers/contracts.ts`. The administrator page `/admin/integrations` (Milestone 7) renders this registry with live status and connection tests.

## Rules

1. A failed or unconfigured integration never stops unrelated features.
2. External responses are never simulated and presented as real. Missing credentials raise `ProviderUnavailableError`.
3. Billable calls show a cost estimate first, need explicit approval and respect `AI_MONTHLY_BUDGET_USD` (default `0`, meaning never spend).
4. Credentials live only in server environment variables and are never sent to the browser or written to logs.
5. Statuses: `not_configured` → `configured` (all required variables valid) → `connected` / `connection_failed` (only after a real test). `disabled` is set via `INTEGRATIONS_DISABLED`.

## Mandatory platform capabilities

| Integration    | Env                                              | Milestone | Fallback when unavailable                    |
| -------------- | ------------------------------------------------ | --------- | -------------------------------------------- |
| PostgreSQL     | `DATABASE_URL`                                   | 3         | none                                         |
| Auth.js        | `AUTH_SECRET`                                    | 3         | public pages stay readable                   |
| Media storage  | `STORAGE_DRIVER` (+ `S3_*`)                      | 5         | local filesystem                             |
| Redis + BullMQ | `REDIS_URL`                                      | 8         | browsing and manual editing keep working     |
| FFmpeg         | `FFMPEG_PATH`, `FFPROBE_PATH`, `VIDEO_FONT_PATH` | 11        | none for rendering                           |
| Remotion       | none                                             | 11        | not built (licence decision); FFmpeg renders |
| MapLibre style | `MAP_STYLE_URL`                                  | 13        | bundled outline map                          |

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

### Image generation providers (Milestone 9)

| `IMAGE_PROVIDER`    | Adapter                                     | Needs                                                              |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `openai`            | Images API                                  | `IMAGE_API_KEY`, `IMAGE_MODEL`, `IMAGE_USD_PER_IMAGE`              |
| `openai-compatible` | Images API at `IMAGE_BASE_URL` (e.g. local) | `IMAGE_BASE_URL`, `IMAGE_MODEL`, `IMAGE_USD_PER_IMAGE` (0 if free) |
| `stability`         | Stable Image API                            | `IMAGE_API_KEY`, `IMAGE_USD_PER_IMAGE`                             |
| `gemini`, `comfyui` | Not built yet                               | —                                                                  |

Every generated image is stored and shown as an AI reconstruction. Without a provider, images made elsewhere can be uploaded and are labelled the same way.

### Storage (Milestone 9)

`STORAGE_DRIVER=local` (default) or `s3` with `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and, for S3-compatible services, `S3_ENDPOINT`. Objects stay private.

### Text-to-speech providers (Milestone 10)

| `TTS_PROVIDER` | Adapter                        | Needs                                                                | Voice licence                                            |
| -------------- | ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------- |
| `espeak`       | eSpeak NG (local, free)        | `espeak-ng` installed (`ESPEAK_PATH`)                                | Formant synthesis; no recorded-voice dataset             |
| `piper`        | Piper (local, free)            | `PIPER_PATH`, `PIPER_MODEL`                                          | Per voice: check its model card; set `TTS_VOICE_LICENSE` |
| `openai`       | Speech API (WAV)               | `TTS_API_KEY`, `TTS_MODEL`, `TTS_VOICE`, `TTS_USD_PER_MILLION_CHARS` | Stock voice under the provider's terms                   |
| `elevenlabs`   | Text-to-speech API (PCM → WAV) | `TTS_API_KEY`, `TTS_VOICE`, `TTS_USD_PER_MILLION_CHARS`              | Stock voice under the provider's terms                   |
| `google`       | Not built                      | —                                                                    | —                                                        |

Voices are stock synthetic voices; no one's voice is cloned. Recorded narration can always be uploaded with the speaker's consent.

### Video rendering (Milestone 11)

**FFmpeg** (LGPL/GPL build from the operating system, free) does the whole job on the worker: picture composition with camera moves (`zoompan`), text and the reconstruction label (`drawtext` with `VIDEO_FONT_PATH`, DejaVu Sans Bold by default), captions (`subtitles`, libass), mixing and loudness (`amix`, `loudnorm`), and H.264/AAC encoding. The Integrations page tests that these filters and the font are present.

**Remotion is not used.** The specification lists it, but its licence is free only for individuals and companies of up to three employees; larger organisations need a paid company licence. A paid licence is the owner's decision, so nothing was bought or installed. FFmpeg covers every Milestone 11 feature. Remotion could add React-based motion graphics (animated maps, kinetic titles) later if the owner approves the licence.

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
