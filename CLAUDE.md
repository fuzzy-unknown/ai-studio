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

Vite dev server proxies `/api` to `http://localhost:4000` (with SSE buffering disabled for task event streams).

## Architecture

### Monorepo Layout

- **`packages/server/`** — ElysiaJS (v1.4) on Bun, SQLite via `bun:sqlite` + Drizzle ORM, Pino logging. Port 4000.
- **`packages/client/`** — React 19 + Vite 6, plain CSS, no state library. Path alias `@/` → `src/`.
- **`docs/`** — Chinese-language API reference docs for HappyHorse video, Qwen image, pricing, and error codes.
- **`tsconfig.base.json`** — Shared TS config (ES2022, strict, bundler module resolution).
- **`eslint.config.js`** — `@antfu/eslint-config` with React + TypeScript, `no-console` off.

### Server (`packages/server/`)

**Entry**: `src/index.ts` — Elysia app with CORS, global error handler.

**Three modules** under `src/modules/`, each as an Elysia plugin:

| Module | Prefix | Service | Purpose |
|--------|--------|---------|---------|
| `video` | `/api/video` | `VideoService` | HappyHorse video generation (async-only, polls DashScope every 5s) |
| `image` | `/api/image` | `ImageService` | Qwen image generation (sync for 2.0 series, async for max/plus) |
| `pricing` | `/api/pricing` | `PricingService` | CRUD for model×resolution pricing with markup multiplier |

All service classes use **static methods** (not instance-based). Both video and image modules share the same route shape: `POST /generate`, `GET /tasks`, `GET /tasks/:taskId`, `GET /tasks/:taskId/events` (SSE), `GET /usage/stats`, `GET /files/:filename`.

**Image module dual-mode**: Sync models (2.0 series) return results immediately and generate local task IDs with `sync-` prefix. Async models (max/plus) submit then poll like video. Sync uses `/services/aigc/multimodal-generation/generation` endpoint; async uses `/services/aigc/text2image/image-synthesis` with `X-DashScope-Async: enable`.

**Pricing module**: Shared by both video and image services for cost calculation. Video uses duration-based pricing (`getPricePerSecond`); image uses count-based pricing (`calculateImageCost`). Actual price = `officialPrice × markup`. Seed data is populated on first run in `src/db/index.ts`.

**Database**: SQLite (`ai-studio.db`) with WAL mode. Schema in `src/db/schema.ts` (Drizzle ORM). Backward-compatible migrations via `ALTER TABLE` with try/catch in `src/db/index.ts`. Both video and image modules write to the same `tasks` table — the `model` column distinguishes them (`happyhorse-*` vs `qwen-image-*`).

**Validation**: Elysia's built-in type-box validation (schemas in each module's `model.ts`).

**Storage**: Videos downloaded to `storage/videos/`, images to `storage/images/` (utilities in `src/utils/storage.ts`).

**Logging**: Pino with daily-rotating log files in `logs/`, configurable via `LOG_LEVEL` env var.

### Client (`packages/client/`)

**Entry**: `src/main.tsx` → `App.tsx`.

**Layout**: Two-column — sticky form on left, scrollable task list on right with filter tabs (全部/视频/图片).

**Three-level model selection** in `GenerateForm/`:
1. Category tab (`video` | `image`) — `CATEGORIES` in `constants.ts`
2. SubType tab (e.g. 文生视频, 图生视频, 文生图) — `MODEL_GROUPS` in `constants.ts`
3. Model dropdown (specific model ID within a subtype)

**Form components** in `GenerateForm/forms/` — one per model type (`HappyHorseT2vForm`, `HappyHorseI2vForm`, `HappyHorseR2vForm`, `HappyHorseEditForm`, `QwenImageForm`). Shared inputs in `GenerateForm/shared/` (`PromptEditor`, `SingleImageInput`, `MultiImageInput`, `AdvancedOptions`).

**Task display**: `TaskCard` detects model type by prefix. Image results use `ImageResult` sub-component supporting multi-image grids (stored as JSON arrays in `videoUrl`/`localPath`).

**Real-time**: `useTaskWatcher` hook accepts a `taskModels` Map to route SSE to the correct module endpoint (`/api/video` or `/api/image`) per task.

### Supported Models

**Video (HappyHorse)**: `happyhorse-1.0-t2v` (text-to-video), `happyhorse-1.0-i2v` (image-to-video/first frame), `happyhorse-1.0-r2v` (reference-image-to-video), `happyhorse-1.0-video-edit` (video editing).

**Image (Qwen)**: `qwen-image-2.0-pro` (sync, recommended), `qwen-image-2.0` (sync, faster), `qwen-image-max` (async), `qwen-image-plus` (async).

## Environment Variables

Server requires `packages/server/.env` (see `.env.example`):

- `DASHSCOPE_API_KEY` — Alibaba Cloud DashScope API key (required)
- `LOG_LEVEL` — Pino log level (optional, default: `info`)

Pricing is database-driven (seeded on first run), not via env vars.

## Testing

Tests use `bun:test` in `packages/server/tests/`. Currently covers video module request validation, 404 handling, and API key/terminal state checks. No client-side tests.
