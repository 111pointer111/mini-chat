# AGENTS.md — Mini-Chat

## Project

Full-stack chat platform: real-time 1v1 messaging, AI chat, scheduled task push, knowledge base (RAG).

- `backend/` — Express 5 + Socket.IO + Mongoose (CommonJS, `"type": "commonjs"`)
- `frontend/` — React 19 + Vite 7 + MUI 7 + Zustand + TanStack Query + Tailwind CSS 4 (ESM, `"type": "module"`)

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
| frontend | `npm run lint` | ESLint 9 flat config |
| Docker | `docker compose -f docker-compose.yml up -d` | dev deps only (MongoDB, Redis, PostgreSQL+pgvector) |
| Docker | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d` | full prod stack |

No test framework configured (`test: echo "Error: no test specified"`). Verification = `npm run build` + `npm run lint`.

## Architecture

### Backend

**Entry**: `backend/src/server.ts` — Express + HTTP server + Socket.IO init. Boots scheduler and worker inline.

**Routes**: All under `/api/*`. Auth middleware (`middleware/authMiddleware.ts`) via JWT `Bearer` header. Route files: `authRoutes`, `userRoutes`, `friendRoutes`, `messageRoutes`, `scheduledTaskRoutes`, `aiChatRoutes`, `aiProviderRoutes`, `uploadRoutes`, `kbRoutes`, `groupRoutes`, `mcpRoutes`.

**Socket.IO**: Singleton via `socket/index.ts` → `getIO()`. Auth via `socket.handshake.auth.token`. Key events: `join_room`, `send_message` (friend chat only), streaming AI responses, task result push.

**AI Config resolution order**:
1. User's `selectedAIProvider` (from `AIProvider` collection, field: `modelName`)
2. Default `AIProvider` (`isDefault: true`)
3. Environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)

**Scheduled Tasks**: `node-cron` (every minute) checks user timezone. BullMQ + Redis for job processing. Task plugin registry pattern.

**Admin bootstrap**: `scripts/initAdmin.ts` runs on MongoDB connect. Default: `admin / admin123` (configurable via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars).

**Knowledge base**: PostgreSQL + pgvector. Schema initialized on startup via `utils/kbSchema.ts`. Embedding batch size configurable via `KB_EMBEDDING_BATCH_SIZE` env.

**Models**: `User`, `Message`, `Conversation`, `Friendship`, `Group`, `GroupMember`, `ScheduledTask`, `AIProvider`, `PushHistory`, `MCPServer`.

### Frontend

**State**: Zustand stores — `authStore` (JWT in localStorage), `chatStore`, `socketStore`.

**API client**: `services/api.ts` — Axios with auto JWT injection interceptor.

**Routing**: React Router v7. `AuthLayout` (public: login/register/reset-password) and `ProtectedLayout` (authenticated: dashboard, AI chat, scheduled tasks, knowledge base, MCP tools, admin).

**Conversation.type**: `'ai'` | `'friend'` | `'scheduled_task'`. Friend messages use Socket.IO; AI/scheduled use REST.

## Key Conventions

- AI assistant sender uses fixed ObjectId `000000000000000000000001`
- Commit style: Conventional Commits, description in Chinese: `feat(scope): 中文描述`
- CORS origins: configurable via `CORS_ORIGINS` env var (comma-separated); defaults to `localhost:5173-5175`
- In dev, if `JWT_SECRET` is unset, a hardcoded dev secret is used (warning printed, not an error); in production, startup exits with error
- Voice/message recording files served via `/uploads` static mount
- AI Provider model fields: `baseURL`, `apiKey`, `modelName`; env vars are fallback only
- Health check: `GET /health` returns `{ status: 'ok', timestamp }`
- Frontend `tsconfig.app.json` has `verbatimModuleSyntax: true` — use `import type` for type-only imports
- Frontend uses ESLint 9 flat config (`eslint.config.js`)

## Known Issues

- No `test` script in either package
- Frontend `npm run lint` has historical warnings in `FriendList.tsx`, `ProtectedLayout.tsx`, `ScheduledTasks.tsx`
- Backend Dockerfile installs system deps for textract (antiword, catdoc, poppler-utils, unrtf) — needed for PDF/Office document parsing in knowledge base

## CI/CD

`.github/workflows/deploy.yml` — pushes to `main` trigger Docker build+push then SSH deploy with `docker compose pull && up -d --force-recreate`.

## Skills

`.agent/skills/` contains React best practices and composition patterns — loaded automatically by OpenCode when working on frontend code.
