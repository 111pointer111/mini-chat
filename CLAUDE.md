# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mini-Chat is a full-stack intelligent chat platform with real-time messaging, AI chat, knowledge base (RAG), MCP tool integration, and scheduled task push notifications. The repo root contains `backend/`, `frontend/`, and `mobile/` directories side by side.

## Development Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Start dev server (port 5173, proxies /api, /uploads, /socket.io to backend)
npm run build    # Build for production (TypeScript check + Vite build)
npm run lint     # Run ESLint (flat config)
npm run preview  # Preview production build
```

### Backend (`backend/`)
```bash
npm run dev        # Start with nodemon (src/server.ts)
npm run build      # TypeScript compile (tsc, no bundler)
npm run start      # Start production build
npm run typecheck  # Type-check only (tsc --noEmit)
```

### Docker
```bash
docker compose -f docker-compose.yml up    # Local dev (MongoDB + Redis + PostgreSQL+pgvector)
docker compose -f docker-compose.prod.yml --env-file .env.production up  # Full production stack
```

### No test framework
Tests are not configured. Validation is done via `npm run build` + `npm run lint` + CI.

## Architecture

### Backend (`backend/src/`)

**Entry**: `server.ts` — Express 5 + HTTP server + Socket.IO initialization. All middleware, routes, and services are bootstrapped here. Monitoring is set up via `setupMonitoring(app)`.

**Routing**: All routes live in `routes/` and are mounted on `/api/*`. Auth middleware (`middleware/authMiddleware.ts`) protects routes via JWT. Admin routes (e.g., `/admin/ai-providers`) require the `admin` role.

**Socket.IO** (`socket/socketHandler.ts`): Singleton pattern — exports `getIO()`. Socket auth uses JWT from `socket.handshake.auth.token`. Handles:
- Friend chat: `join_room`, `send_message` events
- Group chat: group room management, `@小助手` / `@AI` / `@助手` mention triggers AI response with streaming
- Scheduled task results pushed via WebSocket

**AI Service** (`services/aiService.ts`): OpenAI-compatible client with streaming support. Config resolution order:
1. User's `selectedAIProvider` (from `AIProvider` collection, field: `modelName`)
2. Default `AIProvider` (marked `isDefault: true`)
3. Environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)
Supports any OpenAI-compatible API. Includes Agent ReAct loop with tool calling and image upload (multimodal).

**Agent Service** (`services/agentService.ts`): AI agent loop with tool registration and execution. Used by both AI chat and group @AI mentions.

**Knowledge Base** (`services/kbService.ts`, `kbFileService.ts`, `kbEmbeddingService.ts`): RAG pipeline — upload/import → text extraction → chunking → embedding → PostgreSQL+pgvector. Storage layer in `utils/kbDb.ts` (raw `pg.Pool`, not an ORM). Supports per-user and per-group scopes (`scope_type: 'user' | 'group'`). Embedding provider is configured independently from chat provider in `AIProvider`.

**MCP Service** (`services/mcpService.ts`): Connects to external MCP servers via Streamable HTTP or SSE transports. Supports Bearer Token and custom header auth. Tool discovery, caching, and execution integrated with AI chat.

**Scheduled Tasks**: `taskScheduler.ts` uses `node-cron` (every minute) to check enabled tasks against user timezone. `taskQueue.ts` uses BullMQ with Redis for job processing. Task plugins are registered via a `TaskRegistry` pattern. AI content is generated via `aiService`, results pushed via WebSocket.

**Monitoring** (`monitoring/`): Self-contained module — `metrics.ts` (sliding window collector), `alertManager.ts` (state machine: normal→pending→firing→resolved), `alertNotifier.ts` (WebSocket, email, console channels), `middleware.ts` (auto HTTP metrics). Initialized via `setupMonitoring(app)` in `server.ts`.

**Key Models** (`models/`): `User`, `Message`, `Conversation`, `Friendship`, `Group`, `GroupMember`, `ScheduledTask`, `AIProvider`, `MCPServer`, `PushHistory`

### Frontend (`frontend/src/`)

**State Management**: Zustand stores — `authStore` (JWT in localStorage), `chatStore` (friends, messages, task selection), `socketStore` (Socket.IO connection).

**API Client**: `services/api.ts` — Axios instance with auto JWT injection via interceptor. Proxies through Vite dev server.

**Routing**: React Router v7. Two layouts: `AuthLayout` (public: login/register/reset-password) and `ProtectedLayout` (protected: dashboard, AI chat, groups, knowledge base, MCP tools, scheduled tasks, monitoring).

**AI Chat** (`pages/AIChat.tsx`): Multi-conversation AI chat, task creation intent parsing (user confirms/cancels), history display, streaming responses.

**Conversation Types**: `Conversation.type` can be `'ai'` | `'friend'` | `'scheduled_task'`. Friend and group messages use Socket.IO; AI/scheduled messages use REST API.

### Mobile (`mobile/`)

Flutter 3.x Android client (BoltChat). Uses Riverpod for state, Dio for HTTP, Socket.IO client for real-time. Feature parity with web frontend.

## Key Conventions

- Backend uses CommonJS (`"type": "commonjs"` in package.json)
- Frontend uses ESM (`"type": "module"`)
- Frontend Vite proxy forwards `/api`, `/uploads`, and `/socket.io` to `localhost:5000`
- CORS origins: `localhost:5173`, `5174`, `5175` (configurable via `CORS_ORIGINS` env var)
- AI assistant uses fixed ObjectId `000000000000000000000001` as sender
- Knowledge base uses PostgreSQL+pgvector (separate from MongoDB which stores everything else)
- Commit messages: Conventional Commits style with Chinese descriptions, e.g., `feat(group): 新增群知识库管理面板`
- Production requires `JWT_SECRET` env var or the server exits
