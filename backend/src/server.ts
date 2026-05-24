import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import friendRoutes from './routes/friendRoutes';
import messageRoutes from './routes/messageRoutes';
import scheduledTaskRoutes from './routes/scheduledTaskRoutes';
import aiChatRoutes from './routes/aiChatRoutes';
import aiProviderRoutes from './routes/aiProviderRoutes';
import uploadRoutes from './routes/uploadRoutes';
import kbRoutes from './routes/kbRoutes';
import groupRoutes from './routes/groupRoutes';
import mcpRoutes from './routes/mcpRoutes';
import { createMonitoringRoutes } from './routes/monitoringRoutes';
import path from 'path';
import { setupSocket, getIO } from './socket/socketHandler';
import { initAdmin } from './scripts/initAdmin';
import { ensureKnowledgeBaseSchema } from './utils/kbSchema';
import redis from './utils/redis';
import { Pool } from 'pg';
import { setupMonitoring, errorHandlerMiddleware } from './monitoring';
import { startScheduledTaskEventSubscriber } from './services/scheduledTaskEvents';
import { taskQueue } from './services/taskQueue';

dotenv.config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ JWT_SECRET environment variable is required in production');
        process.exit(1);
    }
    console.warn('⚠️  JWT_SECRET not set, using insecure default (dev mode only)');
    process.env.JWT_SECRET = 'dev_secret_key_do_not_use_in_production';
}

const app = express();
const httpServer = createServer(app);
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];

const io = new Server(httpServer, {
    cors: {
        origin: corsOrigins,
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors({ origin: corsOrigins }));
app.use(helmet());
app.use(morgan('dev'));

// 初始化监控系统 — 必须在 rate limiter 之前，否则 429 响应不会被记录
const monitoring = setupMonitoring(app, {
    minSeverity: 'warning',
    alertEmail: process.env.ALERT_EMAIL,
    smtpHost: process.env.ALIYUN_SMTP_HOST,
    smtpPort: process.env.ALIYUN_SMTP_PORT,
    smtpUser: process.env.ALIYUN_SMTP_USER,
    smtpPass: process.env.ALIYUN_SMTP_PASS,
    smtpSender: process.env.ALIYUN_SMTP_SENDER_NAME,
    enableConsole: true,
    enableWebSocket: true,
    getIO,
});

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting for auth endpoints (especially SMS)
const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: '请求过于频繁，请稍后再试' },
});

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: '请求过于频繁，请稍后再试' },
});

app.use('/api/auth/send-code', authLimiter);
app.use('/api/auth', authLimiter); // Apply to all auth endpoints
app.use('/api', globalLimiter);

// PostgreSQL 连接池（/ready 健康检查和关闭时使用）
const pgPool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'minichat',
});

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-chat';
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await initAdmin();
    })
    .catch((err) => console.error('❌ MongoDB connection error:', err));

ensureKnowledgeBaseSchema()
    .then(() => {
        console.log('✅ Knowledge base schema is ready');
    })
    .catch((err) => {
        console.error('❌ Failed to initialize knowledge base schema:', err);
    });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/scheduled-tasks', scheduledTaskRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/ai-providers', aiProviderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/mcp', mcpRoutes);

// Liveness probe — 进程是否存活（不检查依赖）
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 监控端点（/api/ready, /api/metrics, /api/alerts）
app.use('/api', createMonitoringRoutes({ redis, pgPool, monitoring }));

// Setup Socket.io
setupSocket(io);
const stopScheduledTaskEvents = startScheduledTaskEventSubscriber();

// 错误处理中间件（必须放在所有路由之后）
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// ==================== 优雅关闭 ====================
const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // 1. 停止接受新连接
    httpServer.close(() => console.log('HTTP server closed'));

    // 2. 清理监控定时器
    monitoring.destroy();

    // 3. 关闭 Socket.IO
    try {
        getIO().close(() => console.log('Socket.IO closed'));
    } catch { /* socket 未初始化时忽略 */ }

    // 4. 关闭定时任务事件订阅
    await stopScheduledTaskEvents();
    console.log('Scheduled task event subscriber closed');

    // 5. 关闭 MongoDB
    await mongoose.connection.close();
    console.log('MongoDB connection closed');

    // 6. 关闭 BullMQ Queue
    await taskQueue.close();
    console.log('BullMQ queue closed');

    // 7. 关闭 Redis
    await redis.quit();
    console.log('Redis connection closed');

    // 8. 关闭 PostgreSQL
    await pgPool.end();
    console.log('PostgreSQL connection closed');

    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
