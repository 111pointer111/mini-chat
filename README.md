# Mini-Chat

一款面向个人和小团队的全栈聊天应用，集成了实时私聊、AI 对话、知识库问答和定时推送能力。项目采用前后端分离架构，包含 Web 前端和 Android 原生客户端，适合本地开发、Docker 部署和二次开发。

![License](https://img.shields.io/badge/license-ISC-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)
![Flutter](https://img.shields.io/badge/Flutter-3.x-blue)
![Dart](https://img.shields.io/badge/Dart-3.5-blue)

## 功能概览

### 即时通讯
- 用户注册、登录、重置密码（支持邮箱、手机号、Google OAuth）
- 好友搜索、发起申请、接受申请
- 基于 Socket.io 的实时 1v1 聊天
- 在线状态感知
- 图片消息支持

### 群组
- 创建/管理群组
- 群成员管理（owner/admin/member 角色）
- 群消息实时推送
- @AI 助手触发群内 AI 回答
- 群组独立知识库

### AI 对话
- 支持接入 OpenAI 兼容格式的大模型服务
- 多轮会话管理
- 流式输出
- Markdown / 代码块渲染
- 图片理解（多模态）
- Agent ReAct 循环（多轮工具调用）
- MCP 工具集成
- 管理员可在后台维护 AI Provider

### 知识库
- 支持上传本地文档或导入网页链接
- 文档解析、分块、向量化、RAG 问答
- 支持将聊天模型和 embedding 模型拆分配置
- 前端展示上传状态、失败原因和知识库问答来源
- 群组独立知识库管理

### MCP 工具管理
- 支持 Streamable HTTP 和 SSE 两种传输方式
- Bearer Token 和自定义 Header 认证
- 工具发现与缓存
- 工具测试与执行
- 与 AI 对话深度集成

### 定时任务
- GitHub Trending、每日诗词、每日英语等预设任务
- 自定义定时推送任务
- BullMQ + Redis 驱动后台任务
- 多时区支持
- 推送历史去重

### 监控告警
- 内存滑动窗口指标收集（5 分钟窗口，30 秒清理）
- HTTP 请求自动采集：状态码、响应延迟、错误率
- 告警状态机：normal → pending → firing → resolved（防抖动）
- 通知渠道：前端实时弹窗（Socket.IO）、邮件（SMTP）、控制台
- 前端监控面板：请求数、错误率、P95 延迟、内存、Socket 连接数
- 健康检查端点：/health（存活）、/api/ready（依赖检查：MongoDB、Redis、PostgreSQL）

## 技术栈

| 层级 | 技术 |
|------|------|
| Web 前端 | React 19, TypeScript 5.9, Vite 7, MUI 7, Zustand 5, TanStack Query 5, Tailwind CSS 4, Socket.io Client, Framer Motion, React Hook Form, React Markdown |
| Android 客户端 | Flutter 3.x, Dart 3.5, Riverpod 2, Dio, Socket.IO Client, GoRouter, Flutter Markdown |
| 后端 | Node.js 18+, Express 5, TypeScript 5.9, Socket.io 4, Mongoose 9, BullMQ 5, Helmet, Express Rate Limit |
| 主数据 | MongoDB |
| 队列 / 缓存 | Redis |
| 知识库向量存储 | PostgreSQL + pgvector |
| AI 集成 | OpenAI SDK, LangChain, @modelcontextprotocol/sdk |
| 文档解析 | textract, Tesseract.js, Cheerio |
| 监控 | 自研指标收集器 + 告警状态机 + 邮件/WebSocket 通知 |
| 部署 | Docker, Docker Compose, Nginx, GitHub Actions |

## 项目结构

```text
mini-chat/
├── .agent/skills/               # AI Agent 技能库
├── .github/workflows/           # CI/CD 自动部署
├── .mcp.json                    # MCP 配置
├── AGENTS.md                    # OpenCode Agent 指令
├── CLAUDE.md                    # Claude Code 指令
├── backend/                     # Express + TypeScript API
│   ├── src/
│   │   ├── controllers/        # 路由控制器
│   │   ├── middleware/          # JWT 认证中间件
│   │   ├── models/             # MongoDB 模型
│   │   ├── routes/             # Express 路由
│   │   ├── services/           # AI、知识库、任务、MCP 等业务逻辑
│   │   ├── socket/             # Socket.io 实时通讯
│   │   ├── workers/            # BullMQ 后台任务入口
│   │   ├── monitoring/         # 指标收集、告警管理、通知渠道
│   │   ├── scripts/            # 初始化脚本
│   │   └── utils/              # PostgreSQL / Redis / schema 工具
│   ├── scripts/                # 种子用户脚本
│   └── Dockerfile
├── frontend/                    # React + Vite 前端
│   ├── src/components/
│   ├── src/layouts/
│   ├── src/pages/
│   ├── src/services/
│   ├── src/store/              # Zustand 状态管理
│   └── Dockerfile
├── mobile/                      # Flutter Android 客户端 (BoltChat)
│   ├── lib/
│   │   ├── core/               # 常量、主题、路由
│   │   ├── data/               # API 层、数据模型、Socket 服务
│   │   ├── providers/          # Riverpod 状态管理
│   │   ├── features/           # 各功能页面
│   │   └── shared/             # 通用组件和工具
│   ├── android/                # Android 原生配置
│   └── pubspec.yaml
├── docs/                        # 路线图和设计文档
├── docker-compose.yml           # 开发环境依赖
├── docker-compose.prod.yml      # 生产环境编排
└── README.md
```

## 运行前准备

### 基础环境
- Node.js 18+
- npm 9+
- Docker / Docker Compose

### 外部服务
- MongoDB：主业务数据
- Redis：任务队列、验证码限流、缓存
- PostgreSQL + pgvector：知识库文档和向量索引

### AI 相关准备
- 聊天功能需要至少一个可用的 AI Provider
- 知识库问答额外需要可用的 embedding provider
- 推荐方案：
  - 聊天：MiniMax / DeepSeek / OpenAI 兼容服务
  - Embedding：DashScope `text-embedding-v2`

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/111pointer111/mini-chat.git
cd mini-chat
```

### 2. 启动本地依赖

开发环境使用 `docker-compose.yml` 启动 MongoDB、Redis 和 PostgreSQL：

```bash
docker compose up -d
```

默认端口：
- MongoDB: `27017`
- Redis: `6379`
- PostgreSQL: `5432`

### 3. 配置后端

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

后端默认运行在 `http://localhost:5000`。
定时任务需要另开一个终端启动 Worker：

```bash
npm run dev:worker
```

### 4. 配置前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。

如果 `5173` 已被占用，可以改端口：

```bash
npm run dev -- --port 5174
```

### 5. 构建 Android 客户端 (BoltChat)

```bash
cd mobile
flutter pub get
flutter run          # 调试模式
flutter build apk    # 构建 Release APK
```

Android 客户端功能与 Web 前端一致，包括：
- 实时 1v1 / 群聊
- AI 对话（流式输出 + Markdown）
- 定时任务管理
- 知识库
- MCP 工具管理

APK 输出路径：`mobile/build/app/outputs/flutter-apk/app-release.apk`

### 6. 访问应用

- Web 前端：`http://localhost:5173`
- Android 客户端：安装 APK 后配置服务器地址
- 后端健康检查：`http://localhost:5000/health`

## 环境变量

### 后端 `.env`

项目已提供 [`backend/.env.example`](backend/.env.example) 作为开发模板。

关键配置如下：

```env
PORT=5000
MONGODB_URI=mongodb://admin:password@localhost:27017/mini-chat?authSource=admin
JWT_SECRET=replace_me_in_production

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=minichat

AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_EMBEDDING_BASE_URL=
AI_EMBEDDING_API_KEY=
AI_EMBEDDING_MODEL=
AI_EMBEDDING_DIMENSIONS=

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@minichat.com

ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=

# 知识库 embedding 批处理大小（可选）
KB_EMBEDDING_BATCH_SIZE=2

# CORS 源（逗号分隔，可选）
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175

# 告警邮件接收人（通过 GitHub Secrets 注入，不写在文件里）
# ALERT_EMAIL=admin@example.com
ALERT_MIN_SEVERITY=warning
ALERT_ERROR_RATE_PERCENT=2
ALERT_LATENCY_P95_MS=800
ALERT_MEMORY_MB=350
ENABLE_MONITORING_TEST_ROUTES=false
MONITORING_TEST_TOKEN=

# 运行环境（production 时强制要求 JWT_SECRET）
NODE_ENV=development
```

### AI Provider 配置说明

管理员可在后台维护 AI Provider。当前实现支持：

- `Base URL`：聊天模型接口地址
- `模型名称`：聊天模型名
- `Embedding API Key`：独立 embedding API Key，留空则复用聊天模型 API Key
- `Embedding Base URL`：独立 embedding 接口地址
- `Embedding 模型`：embedding 模型名
- `Embedding 维度`：可选，适用于 DashScope `text-embedding-v4` 等需显式维度的模型

如果你使用：

- MiniMax 负责聊天
- DashScope 负责知识库 embedding

推荐配置：

- Chat `Base URL`：MiniMax OpenAI 兼容地址
- Chat `模型名称`：你当前使用的 MiniMax 模型
- `Embedding API Key`：DashScope API Key
- `Embedding Base URL`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- `Embedding 模型`：`text-embedding-v2`
- `Embedding 维度`：留空

## 默认管理员账号

开发环境下，如果数据库中还没有管理员账号，系统会自动初始化：

- 用户名：`admin`
- 密码：`admin123`

对应逻辑见 [backend/src/scripts/initAdmin.ts](backend/src/scripts/initAdmin.ts)。

强烈建议在生产环境中通过环境变量显式设置：
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`

## 知识库说明

知识库链路包括：

1. 文档上传或网页导入
2. 文本提取
3. 文本分块
4. 调用 embedding provider 生成向量
5. 写入 PostgreSQL + pgvector
6. 提问时检索相关片段，再交给聊天模型生成回答

当前支持情况：

- 支持的本地文件类型：`txt`, `md`, `json`, `csv`, `pdf`, `doc/docx`, `ppt/pptx`, `xls/xlsx`, 常见图片
- 纯文本文件优先直接读取
- PDF / Office 文档依赖系统解析组件
- 图片走 OCR

如果只配置聊天模型，没有配置 embedding 能力，知识库上传会在向量化阶段失败。

## 生产环境部署

### 1. 准备环境变量

复制模板：

```bash
cp .env.production.example .env.production
```

按需填写：
- `DOCKERHUB_USERNAME`
- `JWT_SECRET`
- `MONGO_USER` / `MONGO_PASSWORD`
- `POSTGRES_*`
- `AI_*`
- `ADMIN_*`

### 2. 构建并推送镜像

```bash
# 后端
cd backend
docker build -t your_dockerhub_username/minichat-backend:latest .
docker push your_dockerhub_username/minichat-backend:latest

# 前端
cd ../frontend
docker build -t your_dockerhub_username/minichat-frontend:latest .
docker push your_dockerhub_username/minichat-frontend:latest
```

### 3. 配置 GitHub Secrets

push 到 `main` 分支会自动触发 CI（类型检查）和部署（构建镜像 + SSH 部署）。

需要在 repo → Settings → Secrets → Actions 中配置：

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |
| `SERVER_HOST` | 服务器 IP / 域名 |
| `SERVER_USER` | SSH 用户名 |
| `SERVER_SSH_KEY` | SSH 私钥 |
| `JWT_SECRET` | JWT 签名密钥 |
| `MONGO_USER` / `MONGO_PASSWORD` | MongoDB 凭据 |
| `ALIYUN_SMTP_PASS` | 阿里云 SMTP 密码 |
| `ALERT_EMAIL` | 告警邮件接收人 |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | AI Provider 配置 |
| `ALIYUN_*` | 短信服务配置（可选） |

### 4. 使用生产编排启动

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

生产环境编排包括：
- MongoDB
- Redis
- PostgreSQL + pgvector
- 后端 API
- Nginx 托管的前端

## API 概览

以下仅列出主要路由，完整逻辑请参考 `backend/src/routes/`。

### 认证
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/send-code`
- `POST /api/auth/register-phone`
- `POST /api/auth/login-phone`
- `POST /api/auth/bind-phone`
- `POST /api/auth/reset-password-phone`

### 用户 / 好友 / 消息
- `GET /api/users/search`
- `GET /api/friends`
- `POST /api/friends/request`
- `GET /api/friends/requests/pending`
- `PUT /api/friends/request/:requestId/accept`
- `GET /api/messages/:userId`

### 群组
- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId/members`
- `POST /api/groups/:groupId/members`
- `GET /api/groups/:groupId/messages`
- `GET /api/groups/:groupId/kb/documents`
- `POST /api/groups/:groupId/kb/documents/upload`
- `POST /api/groups/:groupId/kb/documents/url`
- `DELETE /api/groups/:groupId/kb/documents/:documentId`

### AI 对话
- `POST /api/ai-chat`
- `GET /api/ai-chat/conversations`
- `POST /api/ai-chat/conversations`
- `PUT /api/ai-chat/conversations/:conversationId`
- `DELETE /api/ai-chat/conversations/:conversationId`

### AI Provider
- `GET /api/ai-providers`
- `GET /api/ai-providers/user`
- `PUT /api/ai-providers/user`
- `GET /api/ai-providers/admin`
- `POST /api/ai-providers/admin`

### 定时任务
- `GET /api/scheduled-tasks`
- `GET /api/scheduled-tasks/conversations`
- `POST /api/scheduled-tasks/custom`
- `PUT /api/scheduled-tasks/custom/:taskId`
- `DELETE /api/scheduled-tasks/custom/:taskId`

### 知识库
- `GET /api/kb/documents`
- `POST /api/kb/documents/upload`
- `POST /api/kb/documents/url`
- `GET /api/kb/search`

知识库问答能力已合并到 AI 助手和群聊小助手中，不再提供独立的 `/api/kb/chat` 入口。

### MCP 工具管理
- `GET /api/mcp/servers`
- `POST /api/mcp/servers`
- `PUT /api/mcp/servers/:id`
- `DELETE /api/mcp/servers/:id`
- `POST /api/mcp/servers/:id/test`
- `POST /api/mcp/servers/:id/refresh-tools`
- `GET /api/mcp/tools`

### 文件上传
- `POST /api/upload`

### 监控
- `GET /health` — 存活检查（无认证）
- `GET /api/ready` — 就绪检查（无认证，检查 MongoDB、Redis、PostgreSQL）
- `GET /api/metrics` — 指标快照（admin）
- `GET /api/alerts` — 告警规则状态（admin）
- `GET /api/test/ok|slow|error` — 监控测试端点（默认关闭，需 `ENABLE_MONITORING_TEST_ROUTES=true` 和 `X-Monitoring-Test-Token`）

生产环境告警测试建议只打 `/api/test/*`，不要压登录、短信、AI 等真实业务接口：

```bash
wrk -t1 -c5 -d30s -H "X-Monitoring-Test-Token: <token>" https://mini-chat.cn/api/test/ok
wrk -t1 -c5 -d60s -H "X-Monitoring-Test-Token: <token>" "https://mini-chat.cn/api/test/slow?ms=1000"
wrk -t1 -c5 -d40s -H "X-Monitoring-Test-Token: <token>" "https://mini-chat.cn/api/test/error?status=500"
```

## 当前已知情况

- 没有配置测试框架（`test: echo "Error: no test specified"`），验证方式为 `npm run build` + `npm run lint` + CI
- 后端 Dockerfile 安装了系统依赖用于文档解析（antiword, catdoc, poppler-utils, unrtf），这些是知识库功能所需的
- 生产环境必须设置 `JWT_SECRET`，否则服务启动失败
- 告警阈值支持通过环境变量配置；测试端点默认关闭，生产测试后应及时关闭

## 开发建议

- 知识库首选小文件和纯文本文件验证链路
- 如果使用 DashScope `text-embedding-v4`，建议同时显式设置 `Embedding 维度 = 1536`
- 如果只需要稳定上线知识库，优先选择 `text-embedding-v2`

## 路线图

详细规划请参考：

- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/ROADMAP-DETAILED.md](docs/ROADMAP-DETAILED.md)

## 贡献

欢迎提交 Issue 和 PR。建议在提交前至少完成：

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

如果你的改动涉及知识库，请附带：
- 使用的 provider 配置方式
- 测试文件类型
- 上传 / 检索 / 问答结果

### Commit 信息规范

提交信息采用 Conventional Commits 风格，描述使用中文：

```text
<type>(<scope>): <中文描述>
```

常用 `type`：

- `feat`：新增功能
- `fix`：修复问题
- `docs`：文档更新
- `refactor`：重构，不改变外部行为
- `style`：格式或样式调整
- `test`：测试相关
- `chore`：构建、依赖、配置、脚手架等杂项

示例：

```text
feat(group): 新增群知识库管理面板
fix(kb): 修复 pgvector 向量写入格式
docs(readme): 补充提交信息规范
```

如果存在破坏性变更，在 type 或 scope 后加 `!`，并在正文或页脚说明影响：

```text
feat(api)!: 调整知识库问答入口

BREAKING CHANGE: 移除独立的 /api/kb/chat，改由 AI 助手统一触发 RAG。
```

## License

本项目使用 ISC License，详见 [LICENSE](LICENSE)。
