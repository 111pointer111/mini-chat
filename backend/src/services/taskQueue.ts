import { Queue, Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import ScheduledTask, { TaskType } from '../models/ScheduledTask';
import PushHistory from '../models/PushHistory';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { getIO } from '../socket';
import aiService from './aiService';
import { SYSTEM_USER_ID } from '../scripts/initAdmin';
import redis from '../utils/redis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
};

export const taskQueue = new Queue('scheduled-tasks', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
    },
});

const PRESET_TASK_NAMES: Record<string, string> = {
    github_trending: 'GitHub 热点',
    daily_poem: '每日诗句',
    daily_english: '每日英文',
};

const getExcludeList = async (userId: string, taskType: TaskType): Promise<string[]> => {
    const recentHistory = await PushHistory.find({
        userId: new mongoose.Types.ObjectId(userId),
        taskType,
    })
        .sort({ pushedAt: -1 })
        .limit(30)
        .select('content');

    return recentHistory.map((h) => h.content.substring(0, 100));
};

const generateTaskContent = async (taskType: TaskType, userId: string, customPrompt?: string): Promise<string> => {
    const excludeList = await getExcludeList(userId, taskType);

    switch (taskType) {
        case 'github_trending':
            return aiService.generateGitHubTrending(excludeList, userId);
        case 'daily_poem':
            return aiService.generateDailyPoem(excludeList, userId);
        case 'daily_english':
            return aiService.generateDailyEnglish(excludeList, userId);
        case 'custom':
            if (!customPrompt) {
                throw new Error('Custom task requires a prompt');
            }
            return aiService.generateCustomContent(customPrompt, excludeList, userId);
        default:
            throw new Error(`Unknown task type: ${taskType}`);
    }
};

const processTask = async (job: Job) => {
    const { taskId, userId, taskType } = job.data as {
        taskId: string;
        userId: string;
        taskType: TaskType;
    };

    console.log(`Processing task: ${taskType} for user ${userId}`);

    try {
        const scheduledTask = await ScheduledTask.findById(taskId);
        if (!scheduledTask) {
            throw new Error(`Task ${taskId} not found`);
        }

        let conversation = await Conversation.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'scheduled_task',
            taskType,
            ...(taskType === 'custom' ? { _id: scheduledTask.conversationId } : {}),
        });

        if (!conversation) {
            const taskName = taskType === 'custom'
                ? scheduledTask.taskName
                : PRESET_TASK_NAMES[taskType];

            conversation = await Conversation.create({
                userId: new mongoose.Types.ObjectId(userId),
                type: 'scheduled_task',
                name: taskName,
                taskType,
            });

            await ScheduledTask.findByIdAndUpdate(taskId, {
                conversationId: conversation._id,
            });
        }

        const customPrompt = taskType === 'custom' ? scheduledTask.prompt : undefined;
        const content = await generateTaskContent(taskType, userId, customPrompt);

        const contentHash = createHash('md5').update(content).digest('hex');

        const existingPush = await PushHistory.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            taskType,
            contentHash,
        });

        if (existingPush) {
            console.log(`Duplicate content detected for ${taskType}, skipping`);
            return;
        }

        await PushHistory.create({
            userId: new mongoose.Types.ObjectId(userId),
            taskType,
            contentHash,
            content: content.substring(0, 500),
        });

        const message = await Message.create({
            sender: SYSTEM_USER_ID,
            receiver: new mongoose.Types.ObjectId(userId),
            conversationId: conversation._id,
            content,
            type: 'system',
        });

        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessageAt: new Date(),
        });

        const io = getIO();
        io.to(userId).emit('scheduled_task_message', {
            conversationId: conversation._id,
            taskType,
            message: {
                _id: message._id,
                content,
                type: 'system',
                createdAt: message.createdAt,
            },
        });

        console.log(`Task ${taskType} completed for user ${userId}`);
    } catch (error) {
        console.error(`Task ${taskType} failed for user ${userId}:`, error);
        throw error;
    }
};

export const createTaskWorker = () => {
    console.log('[Worker] Creating task worker with Redis connection:', REDIS_HOST, REDIS_PORT);

    const worker = new Worker('scheduled-tasks', processTask, {
        connection,
        limiter: {
            max: 10,
            duration: 60000,
        },
        concurrency: 5,
    });

    worker.on('ready', () => {
        console.log('[Worker] Worker is ready and connected to Redis');
    });

    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
        console.error('[Worker] Error details:', err);
    });

    worker.on('error', (err) => {
        console.error('[Worker] Worker error:', err);
    });

    return worker;
};

export const addTaskToQueue = async (taskId: string, userId: string, taskType: TaskType, delayMs?: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const dedupKey = `task:queue:${taskType}:${userId}:${today}`;

    try {
        const alreadyQueued = await redis.get(dedupKey);
        if (alreadyQueued) {
            console.log(`[Queue] Task ${taskType} for user ${userId} already queued today, skipping`);
            return;
        }
    } catch (err) {
        console.warn('[Queue] Redis check failed, proceeding:', err);
    }

    await taskQueue.add(
        `task-${taskType}-${userId}`,
        { taskId, userId, taskType },
        {
            jobId: `${taskType}-${userId}-${Date.now()}`,
            delay: delayMs || 0,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 60000,
            },
        },
    );

    try {
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const ttl = Math.ceil((endOfDay.getTime() - Date.now()) / 1000);
        await redis.set(dedupKey, '1', 'EX', ttl);
    } catch (err) {
        console.warn('[Queue] Redis set failed, dedup not applied:', err);
    }
};
