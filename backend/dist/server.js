"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const friendRoutes_1 = __importDefault(require("./routes/friendRoutes"));
const messageRoutes_1 = __importDefault(require("./routes/messageRoutes"));
const scheduledTaskRoutes_1 = __importDefault(require("./routes/scheduledTaskRoutes"));
const aiChatRoutes_1 = __importDefault(require("./routes/aiChatRoutes"));
const aiProviderRoutes_1 = __importDefault(require("./routes/aiProviderRoutes"));
const socketHandler_1 = require("./socket/socketHandler");
const taskScheduler_1 = require("./services/taskScheduler");
const taskQueue_1 = require("./services/taskQueue");
const initAdmin_1 = require("./scripts/initAdmin");
dotenv_1.default.config();
// Validate required environment variables
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('❌ JWT_SECRET environment variable is required in production');
        process.exit(1);
    }
    console.warn('⚠️  JWT_SECRET not set, using insecure default (dev mode only)');
    process.env.JWT_SECRET = 'dev_secret_key_do_not_use_in_production';
}
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
        methods: ["GET", "POST"]
    }
});
// Middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)({ origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"] }));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-chat';
mongoose_1.default.connect(MONGODB_URI)
    .then(async () => {
    console.log('✅ Connected to MongoDB');
    await (0, initAdmin_1.initAdmin)();
})
    .catch((err) => console.error('❌ MongoDB connection error:', err));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/friends', friendRoutes_1.default);
app.use('/api/messages', messageRoutes_1.default);
app.use('/api/scheduled-tasks', scheduledTaskRoutes_1.default);
app.use('/api/ai-chat', aiChatRoutes_1.default);
app.use('/api/ai-providers', aiProviderRoutes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});
// Setup Socket.io
(0, socketHandler_1.setupSocket)(io);
// Start task scheduler and worker
(0, taskScheduler_1.startTaskScheduler)();
(0, taskQueue_1.createTaskWorker)();
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
