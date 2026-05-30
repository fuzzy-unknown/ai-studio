# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI video generation web app using Alibaba Cloud DashScope "HappyHorse" models. Chinese-language UI. Bun monorepo with two workspace packages: `packages/server` (ElysiaJS backend) and `packages/client` (React 19 + Vite frontend).

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

Vite dev server proxies `/api` to `http://localhost:4000`.

## Architecture

### Monorepo Layout

- **`packages/server/`** — ElysiaJS (v1.4) on Bun, SQLite via `bun:sqlite` + Drizzle ORM, Pino logging. Port 4000.
- **`packages/client/`** — React 19 + Vite 6, plain CSS, no state library. Path alias `@/` → `src/`.
- **`docs/`** — Chinese-language HappyHorse API reference docs.
- **`tsconfig.base.json`** — Shared TS config (ES2022, strict, bundler module resolution).
- **`eslint.config.js`** — `@antfu/eslint-config` with React + TypeScript, `no-console` off.

### Server (`packages/server/`)

- **Entry**: `src/index.ts` — Elysia app with CORS, global error handler.
- **Modules**: Elysia plugins under `src/modules/`. Currently only `video` module at prefix `/api/video`.
- **Routes**: `POST /generate`, `GET /tasks`, `GET /tasks/:taskId`, `GET /tasks/:taskId/events` (SSE), `GET /usage/stats`, `GET /files/:filename`.
- **Service pattern**: Static class methods (`VideoService` in `service.ts`) — not instance-based.
- **Background work**: After task creation, `VideoService.pollUntilDone()` polls DashScope every 5s until terminal state, then downloads the video locally to `storage/videos/`.
- **Database**: SQLite (`ai-studio.db`) with WAL mode. Schema in `src/db/schema.ts` (Drizzle ORM) and raw SQL auto-creation in `src/db/index.ts`. `ALTER TABLE` with try/catch for backward-compatible migrations.
- **Validation**: Elysia's built-in type-box validation (schemas in `model.ts`).
- **Logging**: Pino with daily-rotating log files in `logs/`.

### Client (`packages/client/`)

- **Entry**: `src/main.tsx` → `App.tsx`.
- **Layout**: Two-column sticky form + scrollable task list.
- **Key components**: `GenerateForm` (model selection, image upload/URL, contentEditable prompt with `@` mentions), `TaskList`/`TaskCard` (status badges, loading animations, video playback).
- **Real-time**: `useTaskWatcher` hook manages SSE connections per in-progress task via `EventSource`.
- **Types**: Shared interfaces (`Task`, `UsageData`, `UsageStats`) in `src/types/index.ts`.

### Supported Models

- `happyhorse-1.0-t2v` — text-to-video (default)
- `happyhorse-1.0-i2v` — image-to-video (first frame)
- `happyhorse-1.0-r2v` — reference-image-to-video
- `happyhorse-1.0-video-edit` — video editing

## Environment Variables

Server requires `packages/server/.env` (see `.env.example`):

- `DASHSCOPE_API_KEY` — Alibaba Cloud DashScope API key (required)
- `PRICE_SR_720` — price per second for 720P (default: 0.04 yuan/sec)
- `PRICE_SR_1080` — price per second for 1080P (default: 0.08 yuan/sec)

## Testing

Tests use `bun:test` and live in `packages/server/tests/`. They cover request body validation, 404 handling, and API key/terminal state checks. No client-side tests exist.
