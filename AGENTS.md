<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HISTORYVERSE project rules

- Work milestone by milestone (see `ROADMAP.md`). Stop for owner review at the end of each milestone.
- Keep `src/config/milestones.ts`, `ROADMAP.md` and `CHANGELOG.md` in sync.
- Never fabricate historical facts, references, API responses, renders or uploads. Report blockers instead.
- Secrets only in `src/server/**` modules marked `import "server-only"`.
- External services go through `src/server/integrations/registry.ts` and `src/server/providers/contracts.ts`.
- Use `src/lib/history/dates.ts` for every historical date. Never use JS `Date` for historical years.
- AI reconstructions always use the `reconstruction` badge variant and label text.
- Before finishing a change, run `pnpm check && pnpm build && pnpm test:e2e`.
