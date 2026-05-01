# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mini-Chat is a full-stack intelligent chat platform with real-time messaging, AI chat, and scheduled task push notifications. The repo root contains `backend/` and `frontend/` directories side by side.

## Development Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Start dev server (port 5173, proxies /api and /socket.io to backend)
npm run build    # Build for production (TypeScript check + Vite build)
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend (`backend/`)
```bash
npm run dev      # Start with nodemon (src/server.ts)
npm run build    # TypeScript compile
npm run start    # Start production build
```

### Docker
```bash
docker compose -f docker-compose.yml up    # Local dev (MongoDB + Redis only)
docker compose -f docker-compose.prod.yml --env-file .env.production up  # Full production stack
```

## Architecture

### Backend (`backend/src/`)

**Entry**: `server.ts` — Express + HTTP server + Socket.IO initialization, all middleware, routes, and services are bootstrapped here.

**Routing**: All routes live in `routes/` and are mounted on `/api/*`. Auth middleware (`middleware/authMiddleware.ts`) protects routes via JWT.

**Socket.IO** (`socket/`): Singleton pattern — `socket/index.ts` exports `getIO()` which returns the initialized io instance. Socket auth uses JWT from `socket.handshake.auth.token`. Key events: `join_room`, `send_message` (friend chat only). WebSocket pushes are used for scheduled task results.

**AI Service** (`services/aiService.ts`): OpenAI-compatible client with streaming support. Config resolution order:
1. User's `selectedAIProvider` (from `AIProvider` collection, field: `modelName`)
2. Default `AIProvider` (marked `isDefault: true`)
3. Environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)
Supports any OpenAI-compatible API. Includes Agent ReAct loop with tool calling (e.g., weather queries) and image upload support.

**Agent Service** (`services/agentService.ts`): Implements the AI agent loop with tool registration and execution.

**File Service** (`services/fileService.ts`): Handles file uploads (used for AI image understanding).

**Scheduled Tasks**: `taskScheduler.ts` uses `node-cron` (every minute) to check enabled tasks against user timezone. `taskQueue.ts` uses BullMQ with Redis for job processing. Task plugins are registered via a `TaskRegistry` pattern. AI content is generated via `aiService`, results pushed via WebSocket.

**Key Models**: `User`, `Message`, `Conversation`, `Friendship`, `ScheduledTask`, `AIProvider`, `PushHistory`

### Frontend (`frontend/src/`)

**State Management**: Zustand stores — `authStore` (JWT in localStorage), `chatStore` (friends, messages, task selection), `socketStore` (Socket.IO connection).

**API Client**: `services/api.ts` — Axios instance with auto JWT injection via interceptor. Proxies through Vite dev server.

**Routing**: React Router v7. Two layouts: `AuthLayout` (public: login/register/reset-password) and `ProtectedLayout` (protected: dashboard, AI chat, scheduled tasks).

**AI Chat**: `pages/AIChat.tsx` — Handles multi-conversation AI chat, task creation intent parsing (user confirms/cancels), and history display.

**Conversation Types**: `Conversation.type` can be `'ai'` | `'friend'` | `'scheduled_task'`. Friend messages use Socket.IO; AI/scheduled messages use REST API.

## Key Conventions

- Backend uses CommonJS (`"type": "commonjs"` in package.json)
- Frontend uses ESM (`"type": "module"`)
- Frontend Vite proxy forwards `/api` and `/socket.io` to `localhost:5000`
- CORS origins: `localhost:5173`, `5174`, `5175`
- Admin routes: `/admin/ai-providers` (requires admin role)
- AI assistant uses fixed ObjectId `000000000000000000000001` as sender
