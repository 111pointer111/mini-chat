# Mini-Chat

一款现代化的全栈实时聊天应用，支持好友聊天、AI 对话、定时任务推送等功能。基于 React + Node.js + MongoDB 构建。

![License](https://img.shields.io/badge/license-ISC-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)

## 功能特性

### 即时通讯
- 用户注册登录（手机号 + 短信验证码 / 密码）
- 好友搜索、添加与管理
- 实时 1v1 聊天（Socket.io）
- 好友在线状态实时显示

### AI 对话
- 支持多种 AI 提供者（OpenAI、Claude、DeepSeek 等兼容 OpenAI 格式的 API）
- 流式响应输出
- Markdown / 代码块渲染
- AI 提供者管理界面（管理员）

### 定时任务
- GitHub Trending 定时抓取推送
- 插件化任务架构（TaskRegistry）
- 用户订阅管理

### 技术亮点
- JWT 身份认证
- Redis 会话与消息队列
- BullMQ 后台任务处理
- Docker 一键部署
- 前后端 TypeScript 类型共享

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, MUI, TailwindCSS, Zustand, TanStack Query, Socket.io Client, Framer Motion |
| 后端 | Node.js, Express, TypeScript, Socket.io, Mongoose, BullMQ, ioredis, JWT, bcrypt |
| 数据库 | MongoDB (主数据), Redis (缓存/队列) |
| 部署 | Docker, Docker Compose, Nginx |

## 项目结构

```
mini-chat/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── controllers/       # 控制器层
│   │   │   ├── authController.ts       # 认证（登录/注册/重置密码）
│   │   │   ├── friendController.ts    # 好友管理
│   │   │   ├── messageController.ts    # 消息操作
│   │   │   ├── userController.ts       # 用户信息
│   │   │   ├── aiChatController.ts     # AI 对话
│   │   │   ├── aiProviderController.ts # AI 提供者管理
│   │   │   └── scheduledTaskController.ts # 定时任务
│   │   ├── models/            # MongoDB 数据模型
│   │   │   ├── User.ts, Message.ts, Friendship.ts
│   │   │   ├── Conversation.ts, ScheduledTask.ts
│   │   │   ├── AIProvider.ts, PushHistory.ts
│   │   ├── routes/            # Express 路由
│   │   ├── middleware/        # 中间件（认证守卫等）
│   │   ├── services/          # 业务服务
│   │   │   ├── aiService.ts           # AI API 封装
│   │   │   ├── smsService.ts          # 阿里云短信
│   │   │   ├── taskScheduler.ts       # 定时调度器
│   │   │   └── taskQueue.ts           # BullMQ 任务队列
│   │   ├── socket/            # Socket.io 实时通讯
│   │   │   ├── socketHandler.ts
│   │   │   └── index.ts
│   │   ├── utils/             # 工具函数
│   │   ├── scripts/           # 初始化脚本
│   │   └── server.ts          # 服务入口
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   │   ├── ChatWindow.tsx         # 聊天窗口
│   │   │   ├── FriendList.tsx         # 好友列表
│   │   │   ├── UserSearch.tsx         # 用户搜索
│   │   │   ├── AIProviderSelector.tsx # AI 提供者选择器
│   │   │   └── PhoneCodeInput.tsx     # 短信验证码输入
│   │   ├── pages/             # 页面
│   │   │   ├── Login.tsx, Register.tsx, ResetPassword.tsx
│   │   │   ├── Dashboard.tsx          # 主仪表盘
│   │   │   ├── AIChat.tsx             # AI 对话页
│   │   │   ├── ScheduledTasks.tsx     # 定时任务管理
│   │   │   └── AdminAIProviders.tsx    # AI 提供者管理（管理员）
│   │   ├── store/             # Zustand 状态管理
│   │   │   ├── authStore.ts, chatStore.ts, socketStore.ts
│   │   ├── services/          # API 服务层
│   │   ├── layouts/           # 布局组件
│   │   ├── theme.ts           # MUI 主题配置
│   │   └── App.tsx            # 应用入口
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docs/                       # 文档
│   ├── ROADMAP.md             # 项目路线图
│   └── ROADMAP-DETAILED.md    # 详细路线图
│
├── docker-compose.yml          # 开发环境（MongoDB + Redis）
├── docker-compose.prod.yml     # 生产环境完整部署
├── .env.production.example     # 生产环境配置示例
└── .gitignore
```

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- MongoDB 7+
- Redis

### 1. 克隆项目

```bash
git clone https://github.com/111pointer111/mini-chat.git
cd mini-chat
```

### 2. 启动基础设施（开发环境）

```bash
docker-compose up -d
```

这将启动 MongoDB 和 Redis 容器。

### 3. 配置后端

```bash
cd backend
cp .env.example .env   # 或手动创建 .env 文件
npm install
npm run dev           # 开发模式启动
```

**后端 `.env` 配置项：**

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mini-chat
JWT_SECRET=your_jwt_secret_at_least_32_chars
REDIS_HOST=localhost
REDIS_PORT=6379

# AI 配置（可选）
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your_api_key
AI_MODEL=gpt-4

# 阿里云短信（可选，用于手机号注册）
ALIYUN_ACCESS_KEY_ID=your_key_id
ALIYUN_ACCESS_KEY_SECRET=your_key_secret
ALIYUN_SMS_SIGN_NAME=your_sign_name
ALIYUN_SMS_TEMPLATE_CODE=your_template_code
```

### 4. 配置前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`。

### 5. 访问应用

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:5000`
- 健康检查：`http://localhost:5000/health`

## 生产环境部署

### Docker 一键部署

1. 复制并配置环境变量：

```bash
cp .env.production.example .env
# 编辑 .env 填写实际配置
```

2. 构建并推送 Docker 镜像：

```bash
# 后端
cd backend
docker build -t your_docker_username/minichat-backend:latest .
docker push your_docker_username/minichat-backend:latest

# 前端
cd frontend
docker build -t your_docker_username/minichat-frontend:latest .
docker push your_docker_username/minichat-frontend:latest
```

3. 在服务器上运行：

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 手动部署

```bash
# 构建后端
cd backend && npm run build && npm start

# 构建前端
cd frontend && npm run build
# 前端构建产物在 dist/ 目录，通过 Nginx 托管
```

**Nginx 配置参考**：`frontend/nginx.conf`

## API 路由概览

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/send-code` | 发送短信验证码 |
| POST | `/api/auth/reset-password` | 重置密码 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/users` | 用户搜索 |
| GET/POST | `/api/friends` | 好友列表/添加好友 |
| PUT/DELETE | `/api/friends/:id` | 接受/删除好友 |
| GET/POST | `/api/messages/:friendId` | 获取/发送消息 |
| GET/POST | `/api/ai-chat` | AI 对话 |
| GET/POST/PUT/DELETE | `/api/ai-providers` | AI 提供者管理 |
| GET/POST/PUT/DELETE | `/api/scheduled-tasks` | 定时任务管理 |

## 数据库模型

- **User** — 用户信息（用户名、手机号、密码哈希、头像、角色）
- **Friendship** — 好友关系（申请人、接受人、状态）
- **Message** — 聊天消息（发送者、接收者、内容、类型、时间戳）
- **Conversation** — 对话上下文（用于 AI 多轮对话）
- **AIProvider** — AI 服务提供者配置
- **ScheduledTask** — 用户订阅的定时任务
- **PushHistory** — 推送历史记录

## 开发规范

项目遵循以下开发规范：

- **前端**：React + TypeScript，组件化开发，Zustand 状态管理，TanStack Query 数据获取
- **后端**：Express + TypeScript，MVC 架构，JWT 认证，Socket.io 实时通讯
- **代码风格**：ESLint + Prettier，TypeScript 严格模式

详见 `docs/` 目录下的路线图文档。

## 许可证

ISC
