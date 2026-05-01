# AGENTS.md — Mini-Chat

## Project

Full-stack chat platform: real-time 1v1 messaging, AI chat, scheduled task push, knowledge base (RAG).

- `backend/` — Express + Socket.IO + Mongoose (CommonJS, `"type": "commonjs"`)
- `frontend/` — React 19 + Vite + MUI + Zustand (ESM, `"type": "module"`)

## Quick Start

```bash
docker compose up -d                          # MongoDB + Redis + PostgreSQL
cp backend/.env.example backend/.env           # then edit as needed
npm --prefix backend install && npm --prefix backend run dev    # port 5000
npm --prefix frontend install && npm --prefix frontend run dev  # port 5173
```

## Commands

| Context | Command | Notes |
|---------|---------|-------|
| backend | `npm run dev` | nodemon on `src/server.ts` |
| backend | `npm run build` | `tsc` only (no bundler) |
| backend | `npm start` | run compiled `dist/server.js` |
| frontend | `npm run dev` | Vite dev server, proxies `/api` + `/socket.io` + `/uploads` → :5000 |
| frontend | `npm run build` | `tsc -b && vite build` |
| frontend | `npm run lint` | ESLint |
| Docker | `docker compose -f docker-compose.yml up -d` | dev deps only |
| Docker | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d` | full prod stack |

No test framework configured (`test: echo "Error: no test specified"`).

## Architecture

### Backend

**Entry**: `backend/src/server.ts` — Express + HTTP server + Socket.IO init. Boots up scheduler and worker inline.

**Routes**: All under `/api/*`. Auth middleware (`middleware/authMiddleware.ts`) via JWT `Bearer` header.

**Socket.IO**: Singleton via `socket/index.ts` → `getIO()`. Auth via `socket.handshake.auth.token`. Key events: `join_room`, `send_message` (friend chat only), streaming AI responses, task result push.

**AI Config order**: User's `selectedAIProvider` (field: `modelName`) → default `AIProvider` (`isDefault: true`) → env vars (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`).

**Scheduled Tasks**: `node-cron` (every minute) checks user timezone. BullMQ + Redis for job processing. Task plugin registry pattern.

**Admin bootstrap**: `scripts/initAdmin.ts` runs on MongoDB connect. Default: `admin / admin123` (configurable via env).

**Knowledge base**: PostgreSQL + pgvector. Schema initialized on startup via `utils/kbSchema.ts`.

**Known issues**:
- No `test` script in either package
- CORS origins configurable via `CORS_ORIGINS` env var (comma-separated); defaults to `localhost:5173-5175`

### Frontend

**State**: Zustand stores — `authStore` (JWT in localStorage), `chatStore`, `socketStore`.

**API client**: `services/api.ts` — Axios with auto JWT injection interceptor.

**Routing**: React Router v7. `AuthLayout` (public) and `ProtectedLayout` (authenticated).

**Conversation.type**: `'ai'` | `'friend'` | `'scheduled_task'`. Friend messages use Socket.IO; AI/scheduled use REST.

## Key Conventions

- AI assistant sender uses fixed ObjectId `000000000000000000000001`
- Commit style: Conventional Commits, description in Chinese: `feat(scope): 中文描述`
- CORS origins: configurable via `CORS_ORIGINS` env var (comma-separated)
- In dev, if `JWT_SECRET` is unset, a hardcoded dev secret is used (warning printed, not an error)
- Voice/message recording files served via `/uploads` static mount
- Model `AIProvider.baseURL`/`apiKey`/`modelName`; env vars are fallback only

## CI/CD

`.github/workflows/deploy.yml` — pushes to `main` trigger Docker build+push then SSH deploy with `docker compose pull && up -d --force-recreate`.

## Behavioral Guidelines (Karpathy Principles)

Derived from [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills). Bias toward caution over speed; use judgment for trivial tasks.

### 1. Think Before Coding

State assumptions explicitly before implementing. If uncertain, ask. If multiple interpretations exist, present them — don't pick silently. If something is unclear, stop and name what's confusing.

### 2. Simplicity First

Minimum code that solves the problem. No speculative features, abstractions for single-use code, or "flexibility" not requested. If 200 lines could be 50, rewrite it. Ask: would a senior engineer say this is overcomplicated?

### 3. Surgical Changes

Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Don't refactor things not broken. Match existing style. Clean up only what your changes made unused — don't remove pre-existing dead code unless asked. Every changed line should trace to the request.

### 4. Goal-Driven Execution

Define verifiable success criteria before starting. For multi-step tasks, state a brief plan with verify checks:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```
Loop until criteria are met. After changes, run relevant verification (lint → typecheck → build).
