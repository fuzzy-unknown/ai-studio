# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Studio — bilingual-titled (Chinese UI) web app for AI video and image generation via Alibaba Cloud DashScope. Bun monorepo: `packages/server` (ElysiaJS backend) + `packages/client` (React 19 + Vite frontend).

## Commands

```bash
bun run dev              # Start both server (:4000) and client (:5173) concurrently
bun run dev:server       # Server only (watch mode via bun --watch)
bun run dev:client       # Client only (Vite dev server)
bun run build            # Build client (tsc -b && vite build)
bun run lint             # ESLint check
bun run lint:fix         # ESLint auto-fix
bun run --cwd packages/server test     # Run server tests (bun:test)
bun run --cwd packages/server db:push  # Push Drizzle schema to SQLite
```

To run a single test file: `bun test packages/server/tests/video.test.ts` (from repo root).

Vite dev server proxies `/api` to `http://localhost:4000` (with SSE buffering disabled for task event streams).

## Architecture

### Monorepo Layout

- **`packages/server/`** — ElysiaJS (v1.4) on Bun, SQLite via `bun:sqlite` + Drizzle ORM, Pino logging. Port 4000.
- **`packages/client/`** — React 19 + Vite 6, plain CSS, no state library. Path alias `@/` → `src/`.
- **`docs/`** — Chinese-language API reference docs for HappyHorse video, Wan2.7 video, Qwen image/image-edit, pricing, and error codes.
- **`tsconfig.base.json`** — Shared TS config (ES2022, strict, bundler module resolution).
- **`eslint.config.js`** — `@antfu/eslint-config` with React + TypeScript, `no-console` off.

### Server (`packages/server/`)

**Entry**: `src/index.ts` — Elysia app composing three module plugins with CORS and a global error handler.

**Three modules** under `src/modules/`, each as an Elysia plugin following `index.ts` (routes) / `service.ts` (logic) / `model.ts` (type-box validation schemas):

| Module | Prefix | Service | Purpose |
|--------|--------|---------|---------|
| `video` | `/api/video` | `VideoService` | HappyHorse + Wan2.7 video generation (async-only, polls DashScope every 5s) |
| `image` | `/api/image` | `ImageService` | Qwen image generation (sync for 2.0 series, async for max/plus; edit models are sync) |
| `pricing` | `/api/pricing` | `PricingService` | CRUD for model×resolution pricing with markup multiplier |

All service classes use **static methods** (not instance-based). Both video and image modules share the same route shape: `POST /generate`, `GET /tasks`, `GET /tasks/:taskId`, `GET /tasks/:taskId/events` (SSE), `GET /usage/stats`, `GET /files/:filename`.

**Dual polling architecture**: There are two independent polling loops:
1. **Server → DashScope** (background): `pollUntilDone()` fires every 5s in a fire-and-forget promise, updating the DB row on each poll. On success, downloads media to local storage.
2. **Client → Server** (SSE): Each SSE endpoint polls its own SQLite DB every 2s (max ~10 min), pushing status-change events to the client. Terminal states (`SUCCEEDED`, `FAILED`, `UNKNOWN`, `CANCELED`) close the connection.

**Image module dual-mode**: Sync models (2.0 series, edit models) return results immediately and generate local task IDs with `sync-` prefix — the HTTP request blocks until the image is generated and downloaded. Async models (max/plus) submit then poll like video. Sync uses `/services/aigc/multimodal-generation/generation` endpoint; async uses `/services/aigc/text2image/image-synthesis` with `X-DashScope-Async: enable`.

**Pricing module**: Shared by both video and image services via direct imports. Video uses duration-based pricing (`calculateCost` → `duration × pricePerSecond`); image uses count-based pricing (`calculateImageCost` → `imageCount × officialPrice × markup`). Actual price = `officialPrice × markup`. Seed data is populated on first run in `src/db/index.ts`.

**Database**: SQLite (`ai-studio.db`) with WAL mode. Schema in `src/db/schema.ts` (Drizzle ORM). Backward-compatible migrations via `ALTER TABLE ADD COLUMN` with try/catch in `src/db/index.ts`. Both video and image modules write to the same `tasks` table — the `model` column distinguishes them (`happyhorse-*`/`wan2.7-*` vs `qwen-image-*`).

**`videoUrl` naming quirk**: Despite the name, this column stores both video and image result URLs, and can contain JSON arrays for multi-image results. `localPath` follows the same pattern.

**Error handling**: Services maintain Chinese-language error code maps (`ERROR_CODE_MAP`) translating DashScope API codes to human-readable Chinese messages. Global Elysia error handler maps `VALIDATION`→400, `NOT_FOUND`→404, `UNKNOWN`→500.

**Storage**: Videos downloaded to `storage/videos/`, images to `storage/images/` (utilities in `src/utils/storage.ts`, uses `Bun.write()`).

**Logging**: Pino with dual output (stdout + daily-rotating log files in `logs/`), configurable via `LOG_LEVEL` env var.

### Client (`packages/client/`)

**Entry**: `src/main.tsx` → `App.tsx`.

**Layout**: Two-column — sticky form on left, scrollable task list on right with filter tabs (全部/视频/图片).

**Three-level model selection** in `GenerateForm/`:
1. Category tab (`video` | `image`) — `CATEGORIES` in `constants.ts`
2. SubType tab (e.g. 文生视频, 图生视频, 文生图) — `MODEL_GROUPS` in `constants.ts`
3. Model dropdown (specific model ID within a subtype) — each model has a `formType` that selects the form component

**Form components** in `GenerateForm/forms/` — one per `formType`: `HappyHorseT2vForm` (t2v), `HappyHorseI2vForm` (i2v), `Wan27I2vForm` (wan27-i2v, most complex — 3 sub-task modes: first_frame, first_last_frame, video_continuation), `HappyHorseR2vForm` (r2v), `HappyHorseEditForm` (edit), `QwenImageForm` (t2i), `QwenImageEditForm` (i2i). All accept `ModelFormProps { model, loading, onSubmit }`. Shared inputs in `GenerateForm/shared/` (`PromptEditor` — contentEditable div with `@` mention support, `SingleImageInput`, `MultiImageInput`, `AdvancedOptions`).

**Optimistic UI**: On form submit, `App.tsx` immediately inserts a temp task card (`taskId: "temp-${timestamp}"`), then replaces it with real server data. The SSE watcher skips `temp-` prefixed tasks.

**Task display**: `TaskCard` detects model type by prefix. `ImageResult` sub-component parses JSON arrays from `videoUrl`/`localPath` for multi-image grids. `getVideoSrc` routes to `/api/image/files/` or `/api/video/files/` based on model prefix.

**Real-time**: `useTaskWatcher` hook maintains a `Map<string, EventSource>` for active SSE connections. Routes each task to the correct module endpoint based on model prefix (`qwen-image-*` → `/api/image`, otherwise `/api/video`). Uses serialized sorted key comparison to avoid re-running on array reference changes.

### Supported Models

**Video**: `happyhorse-1.0-t2v` (text-to-video), `happyhorse-1.0-i2v` (image-to-video/first frame), `happyhorse-1.0-r2v` (reference-image-to-video, 1–9 images), `happyhorse-1.0-video-edit` (video editing), `wan2.7-i2v` (image-to-video with 3 sub-task modes).

**Image**: `qwen-image-2.0-pro` (sync, recommended), `qwen-image-2.0` (sync, faster), `qwen-image-max` (async), `qwen-image-plus` (async), `qwen-image-edit` (sync, image editing).

## Environment Variables

Server requires `packages/server/.env` (see `.env.example`):

- `DASHSCOPE_API_KEY` — Alibaba Cloud DashScope API key (required)
- `LOG_LEVEL` — Pino log level (optional, default: `info`)

Pricing is database-driven (seeded on first run), not via env vars.

## Testing

Tests use `bun:test` in `packages/server/tests/`. Pattern: creates an `Elysia` app instance directly (no HTTP server) and uses `app.handle(request)` for in-process testing. Constructs `Request` objects manually with full URLs. No mocking framework. Tests remove `DASHSCOPE_API_KEY` in `beforeAll` to prevent real API calls. Currently covers video module request validation, 404 handling, API key/terminal state checks, and service-layer guards. No client-side tests.
