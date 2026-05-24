import dotenv from 'dotenv';
import mongoose from 'mongoose';
import redis from '../utils/redis';
import { taskQueue, createTaskWorker } from '../services/taskQueue';
import { reconcileTaskSchedulers } from '../services/taskScheduleService';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mini-chat';

const start = async () => {
    await mongoose.connect(MONGODB_URI);
    console.log('Worker connected to MongoDB');

    await reconcileTaskSchedulers();
    const worker = createTaskWorker();

    const shutdown = async (signal: string) => {
        console.log(`\n${signal} received, shutting down scheduled task worker...`);

        await worker.close();
        console.log('BullMQ worker closed');

        await taskQueue.close();
        console.log('BullMQ queue closed');

        await mongoose.connection.close();
        console.log('MongoDB connection closed');

        await redis.quit();
        console.log('Redis connection closed');

        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch(async (error) => {
    console.error('Failed to start scheduled task worker:', error);
    await redis.quit().catch(() => undefined);
    await mongoose.connection.close().catch(() => undefined);
    process.exit(1);
});
