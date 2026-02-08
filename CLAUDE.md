# CLAUDE.md — RepoBeam

## What Is This

RepoBeam is a personal, LLM-friendly code browsing platform. It connects to my GitHub
repos, indexes all source code, and exposes a REST API that any LLM with web-fetch
can use to read, search, and navigate code without hitting token limits.

## The Problem

LLMs that fetch code from GitHub get truncated at ~10,000 tokens. A file like
`src/evaluation.cpp` at 23,000 tokens gets cut in half. There's no way to ask for
just one function, search for a symbol, or get a specific line range.

## The Solution

A hosted API that sits on top of my GitHub repos and serves code in smart,
LLM-sized chunks. Instead of fetching a raw GitHub file, an LLM hits RepoBeam's
API and can request exactly what it needs.

---

## Core Principles

1. Every API response must be consumable by an LLM in a single fetch — default max 8000 tokens
2. Every response includes token count metadata so the LLM knows what it's dealing with
3. Truncated responses include a `hint` field explaining how to get the rest
4. The `/api/help` endpoint requires NO auth and explains the entire API in plain text — this is the entry point for any LLM
5. `?raw=true` on any endpoint returns plain text instead of JSON
6. Incremental sync only — never re-index a full repo, only changed files
7. API is the product. UI is secondary — just for me to manage and browse

---

## Tech Stack (LATEST VERSIONS — FEBRUARY 2026)

| Package | Version |
|---|---|
| `next` | `16.1.6` |
| `react` / `react-dom` | `19.2.4` |
| `tailwindcss` | `4.1.18` |
| `shadcn` | `3.8.4` |
| `@supabase/supabase-js` | `2.95.3` |
| `@supabase/ssr` | `0.8.0` |
| `@upstash/redis` | `1.36.1` |
| `octokit` | `5.0.5` |
| `web-tree-sitter` | `0.26.5` |
| `shiki` | `3.22.0` |

### DO NOT USE (deprecated/sunset):
- `@vercel/postgres` — use Supabase
- `@vercel/kv` — use Upstash Redis
- `@supabase/auth-helpers-nextjs` — use `@supabase/ssr`
- Prisma — use Supabase client directly

### Deployment: Vercel
### App Router ONLY — no Pages Router

---

## Database: Supabase Postgres

Three tables: `repos`, `files`, `symbols`.

- `repos` tracks indexed repositories with sync state (last SHA, last synced time)
- `files` stores full file content with path, language, token count, line count
- `symbols` stores extracted functions/classes/structs with name, kind, signature, start line, end line, token count, parent symbol, and a foreign key to `files`
- Use `pg_trgm` extension for fuzzy symbol name search
- Use `to_tsvector` for full-text content search
- Enable RLS but allow all via service role (this is a personal tool)
- Use Supabase client directly for all queries, no ORM

---

## Cache: Upstash Redis

Cache frequently accessed parsed files and symbol lists. Invalidate on sync.

---

## API Endpoints

All require `Authorization: Bearer <API_KEY>` except `/api/help`.

### Repo Management
- `GET /api/repos` — list all repos with stats
- `POST /api/repos` — add a repo (triggers initial index)
- `DELETE /api/repos/[id]` — remove a repo
- `POST /api/repos/[id]/sync` — manual re-sync

### File Browsing
- `GET /api/tree?repo=owner/name` — file tree with token counts per file
- `GET /api/file?repo=owner/name&path=...` — file content (auto-truncates at 8000 tokens)
  - Supports: `startLine`, `endLine`, `function`, `raw`, `fresh`, `maxTokens`

### Symbol Navigation (the killer feature)
- `GET /api/symbols?repo=owner/name&path=...` — list all symbols in a file with line ranges and token counts
- `GET /api/function?repo=owner/name&path=...&name=...` — fetch a single function by name
  - Supports: `context=true` for 5 lines before/after
- `GET /api/symbols/search?repo=owner/name&q=...` — fuzzy search symbols across all files

### Search
- `GET /api/search?repo=owner/name&q=...` — full-text search with snippets (5 lines context)
  - Supports: `filePattern`, `maxResults`
- `GET /api/search/regex?repo=owner/name&q=...` — regex search

### Diff & Change Tracking
- `GET /api/diff?repo=owner/name&since=sha` — changed files since a commit
- `GET /api/diff/function?repo=owner/name&path=...&name=...&since=sha` — before/after of a function

### Smart Context
- `GET /api/context?repo=owner/name&path=...&name=...` — function + referenced types + called function signatures, budget 10K tokens

### LLM Landing Page
- `GET /api/help` — NO AUTH — plain text guide explaining every endpoint and usage tips

---

## Auto-Sync

### GitHub Webhook: `POST /api/webhook/github`
- Validates `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET`
- On push: parse changed files from commits payload, re-index only those files
- Update repo's sync state

### Vercel Cron: `GET /api/cron/sync`
- Every 15 minutes, check all repos for new commits
- Fallback in case webhooks are missed
- Protect with `CRON_SECRET`

Configure in `vercel.json`.

---

## Code Parsing

Use `web-tree-sitter` with WASM grammars to extract symbols from source files.
Support at minimum: C, C++, Python, JavaScript, TypeScript, Rust, Go, Java.
Store `.wasm` grammar files in `public/tree-sitter-grammars/`.

If tree-sitter is problematic in Vercel's serverless environment, fall back to
regex-based extraction per language.

Detect language from file extension.

---

## Web UI

Minimal but clean. Tailwind + shadcn/ui. Four pages:

1. **`/`** — Dashboard: repo list, add repo, quick search
2. **`/repo/[owner]/[name]`** — Repo browser: file tree, symbol list, sync button
3. **`/repo/[owner]/[name]/[...path]`** — File viewer: Shiki syntax highlighting, line numbers, symbol gutter, **"Copy API URL" button per symbol**
4. **`/search`** — Global search across repos

The "Copy API URL" button is important — it lets me quickly copy a
`/api/function?repo=...&path=...&name=...` URL and paste it into a conversation
with an LLM.

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=
API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
```

---

## Test With

My repo: `github.com/changcheng967/Luminex` — specifically the large file
`src/evaluation.cpp` which is ~23,000 tokens and has many functions to extract.

---

## Response Envelope

Every JSON response wraps in:
```json
{
  "_meta": { "total_tokens": ..., "truncated": ..., "hint": ..., ... },
  "data": { ... }
}
```

Token estimation: `Math.ceil(text.length / 4)` — good enough.