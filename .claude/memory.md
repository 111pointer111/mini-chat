# Project Memory — Mini-Chat

## Architecture Decisions

### Dual Database Strategy
- **MongoDB**: Primary store for users, messages, conversations, groups, scheduled tasks, AI providers, MCP servers
- **PostgreSQL + pgvector**: Dedicated to knowledge base (RAG) embeddings and file metadata
- Rationale: Vector similarity search requires pgvector; keeping it separate avoids MongoDB vector extension dependency

### AI Provider Resolution Order
1. User's `selectedAIProvider` (from `AIProvider` collection)
2. Default `AIProvider` (`isDefault: true`)
3. Environment variables (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)
- This three-tier fallback allows per-user customization while maintaining sensible defaults

### Socket.IO Singleton Pattern
- `socket/index.ts` exports `getIO()` — single instance across the app
- Auth via `socket.handshake.auth.token` (JWT)
- Friend chat uses `join_room` / `send_message` events
- Group chat triggers AI on `@小助手` / `@AI` / `@助手` mentions

### Scheduled Task Architecture
- BullMQ JobScheduler backed by Redis for schedule persistence
- API syncs schedulers on task CRUD; worker reconciles on startup
- Worker runs as separate process: `npm run dev:worker` / `npm run start:worker`
- Results published via Redis pub/sub → WebSocket push to clients

### AI Assistant Identity
- Fixed ObjectId `000000000000000000000001` used as AI sender
- Never change this — it's referenced across messages, conversations, and group members

## Key Conventions

### Module Systems
- Backend: CommonJS (`"type": "commonjs"`)
- Frontend: ESM (`"type": "module"`)
- Never mix import styles across the boundary

### Commit Style
- Conventional Commits with Chinese descriptions: `feat(scope): 中文描述`
- Examples: `fix(ai): 修复移动端 AI 流式空白回复`, `feat(group): 新增群知识库管理面板`

### Frontend Constraints
- `tsconfig.app.json` has `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- ESLint 9 flat config (`eslint.config.js`)
- Vite proxies `/api`, `/uploads`, `/socket.io` to `localhost:5000`

### CORS
- Configurable via `CORS_ORIGINS` env var (comma-separated)
- Defaults: `localhost:5173`, `localhost:5174`, `localhost:5175`

### Authentication
- JWT-based; `JWT_SECRET` env required in production (exits on missing)
- Dev fallback: hardcoded secret with warning
- Admin routes require `admin` role

## Deployment

### CI/CD
- `.github/workflows/deploy.yml`: push to `main` → Docker build+push → SSH deploy
- Uses `docker compose pull && up -d --force-recreate`

### Docker
- Dev: `docker-compose.yml` (MongoDB + Redis + PostgreSQL+pgvector)
- Prod: `docker-compose.prod.yml --env-file .env.production` (full stack)

### Knowledge Base Dependencies
- Backend Dockerfile installs system deps for document parsing: antiword, catdoc, poppler-utils, unrtf
- Required for PDF/Office document text extraction in RAG pipeline

## Known Gotchas

- No test framework configured — verification is `npm run build` + `npm run lint` only
- Frontend has historical lint warnings in `FriendList.tsx`, `ProtectedLayout.tsx`, `ScheduledTasks.tsx`
- Admin default credentials: `admin / admin123` (override via `ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- Embedding batch size configurable via `KB_EMBEDDING_BATCH_SIZE` env
