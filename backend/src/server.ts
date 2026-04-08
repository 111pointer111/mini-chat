import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import friendRoutes from './routes/friendRoutes';
import messageRoutes from './routes/messageRoutes';
import scheduledTaskRoutes from './routes/scheduledTaskRoutes';
import aiChatRoutes from './routes/aiChatRoutes';
import aiProviderRoutes from './routes/aiProviderRoutes';
import { setupSocket } from './socket/socketHandler';
import { startTaskScheduler } from './services/taskScheduler';
import { createTaskWorker } from './services/taskQueue';
import { initAdmin } from './scripts/initAdmin';

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
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"] }));
app.use(helmet());
app.use(morgan('dev'));

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-chat';
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await initAdmin();
    })
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/scheduled-tasks', scheduledTaskRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/ai-providers', aiProviderRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Setup Socket.io
setupSocket(io);

// Start task scheduler and worker
startTaskScheduler();
createTaskWorker();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
