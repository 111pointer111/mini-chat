import { Queue, Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import ScheduledTask, { TaskType } from '../models/ScheduledTask';
import PushHistory from '../models/PushHistory';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { getIO } from '../socket';
import aiService from './aiService';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const connection = {
    host: REDIS_HOST,
    port: REDIS_PORT,
};

// Create the task queue
export const taskQueue = new Queue('scheduled-tasks', {
    connection,
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
    },
});

// Task type to display name mapping (for preset tasks)
const PRESET_TASK_NAMES: Record<string, string> = {
    github_trending: 'GitHub 热点',
    daily_poem: '每日诗句',
    daily_english: '每日英文',
};

// Get exclude list for deduplication
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

// Generate content based on task type using aiService
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

// Process a single task
const processTask = async (job: Job) => {
    const { taskId, userId, taskType } = job.data as {
        taskId: string;
        userId: string;
        taskType: TaskType;
    };

    console.log(`Processing task: ${taskType} for user ${userId}`);

    try {
        // Get the task to retrieve prompt for custom tasks
        const scheduledTask = await ScheduledTask.findById(taskId);
        if (!scheduledTask) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Get or create conversation for this task
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

            // Update ScheduledTask with conversationId
            await ScheduledTask.findByIdAndUpdate(taskId, {
                conversationId: conversation._id,
            });
        }

        // Generate AI content using geminiService
        const customPrompt = taskType === 'custom' ? scheduledTask.prompt : undefined;
        const content = await generateTaskContent(taskType, userId, customPrompt);

        // Create content hash for deduplication
        const contentHash = createHash('md5').update(content).digest('hex');

        // Check if this exact content was already pushed
        const existingPush = await PushHistory.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            taskType,
            contentHash,
        });

        if (existingPush) {
            console.log(`Duplicate content detected for ${taskType}, skipping`);
            return;
        }

        // Save push history
        await PushHistory.create({
            userId: new mongoose.Types.ObjectId(userId),
            taskType,
            contentHash,
            content: content.substring(0, 500), // Store truncated for history
        });

        // Create message in conversation
        // Use a system user ID for scheduled task messages
        const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');
        
        const message = await Message.create({
            sender: systemUserId,
            receiver: new mongoose.Types.ObjectId(userId),
            conversationId: conversation._id,
            content,
            type: 'system',
        });

        // Update conversation last message time
        await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessageAt: new Date(),
        });

        // Push to user via WebSocket if online
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

// Create worker to process tasks
export const createTaskWorker = () => {
    console.log('[Worker] Creating task worker with Redis connection:', REDIS_HOST, REDIS_PORT);
    
    const worker = new Worker('scheduled-tasks', processTask, {
        connection,
        limiter: {
            max: 10,
            duration: 60000, // 10 jobs per minute
        },
        concurrency: 1,
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

// Add task to queue with retry configuration
export const addTaskToQueue = async (taskId: string, userId: string, taskType: TaskType) => {
    await taskQueue.add(
        `task-${taskType}-${userId}`,
        { taskId, userId, taskType },
        {
            jobId: `${taskType}-${userId}-${Date.now()}`,
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 60000, // 首次重试等待1分钟，之后指数增长
            },
        }
    );
};
