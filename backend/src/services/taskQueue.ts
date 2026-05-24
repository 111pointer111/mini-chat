import { Queue, Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import ScheduledTask, { TaskType } from '../models/ScheduledTask';
import PushHistory from '../models/PushHistory';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import aiService from './aiService';
import { SYSTEM_USER_ID } from '../scripts/initAdmin';
import { redisConnectionOptions } from '../utils/redis';
import { publishScheduledTaskMessage } from './scheduledTaskEvents';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

export const SCHEDULED_TASK_JOB_NAME = 'scheduled-task';

export const taskQueue = new Queue('scheduled-tasks', {
    connection: redisConnectionOptions,
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
    const { taskId } = job.data as {
        taskId: string;
    };

    console.log(`Processing scheduled task: ${taskId}`);

    try {
        const scheduledTask = await ScheduledTask.findById(taskId);
        if (!scheduledTask) {
            console.warn(`Task ${taskId} not found, skipping`);
            return;
        }

        if (!scheduledTask.enabled) {
            console.log(`Task ${taskId} is disabled, skipping`);
            return;
        }

        const userId = scheduledTask.userId.toString();
        const taskType = scheduledTask.taskType;

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

        await publishScheduledTaskMessage({
            userId,
            conversationId: conversation._id.toString(),
            taskType,
            message: {
                _id: message._id.toString(),
                content,
                type: 'system',
                createdAt: message.createdAt.toISOString(),
            },
        });

        console.log(`Task ${taskType} completed for user ${userId}`);
    } catch (error) {
        console.error(`Task ${taskId} failed:`, error);
        throw error;
    }
};

export const createTaskWorker = () => {
    console.log('[Worker] Creating task worker with Redis connection:', REDIS_HOST, REDIS_PORT);

    const worker = new Worker('scheduled-tasks', processTask, {
        connection: redisConnectionOptions,
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
