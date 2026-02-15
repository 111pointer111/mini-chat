import { Request, Response } from 'express';
import ScheduledTask, { TaskType } from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import mongoose from 'mongoose';

const TASK_NAMES: Record<TaskType, string> = {
    github_trending: 'GitHub 热点',
    daily_poem: '每日诗句',
    daily_english: '每日英文',
};

// Get all scheduled tasks for current user
export const getScheduledTasks = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Get existing tasks
        const tasks = await ScheduledTask.find({ userId });

        // Return all task types with their status
        const allTaskTypes: TaskType[] = ['github_trending', 'daily_poem', 'daily_english'];
        const result = allTaskTypes.map((taskType) => {
            const existingTask = tasks.find((t) => t.taskType === taskType);
            return {
                taskType,
                name: TASK_NAMES[taskType],
                enabled: existingTask?.enabled || false,
                pushTime: existingTask?.pushTime || '09:00',
                conversationId: existingTask?.conversationId,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Get scheduled tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a scheduled task
export const updateScheduledTask = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const taskType = req.params.taskType as TaskType;
        const { enabled, pushTime } = req.body;

        // Validate taskType
        if (!['github_trending', 'daily_poem', 'daily_english'].includes(taskType)) {
            return res.status(400).json({ message: 'Invalid task type' });
        }

        // Find or create task
        let task = await ScheduledTask.findOne({ userId, taskType });

        if (!task) {
            // Create new task
            task = new ScheduledTask({
                userId,
                taskType,
                enabled: enabled ?? false,
                pushTime: pushTime || '09:00',
            });
        } else {
            // Update existing task
            if (enabled !== undefined) task.enabled = enabled;
            if (pushTime) task.pushTime = pushTime;
        }

        // If enabling task, create conversation if not exists
        if (task.enabled && !task.conversationId) {
            const conversation = await Conversation.create({
                userId: new mongoose.Types.ObjectId(userId),
                type: 'scheduled_task',
                name: TASK_NAMES[taskType],
                taskType,
            });
            task.conversationId = conversation._id;
        }

        await task.save();

        res.json({
            taskType: task.taskType,
            name: TASK_NAMES[task.taskType],
            enabled: task.enabled,
            pushTime: task.pushTime,
            conversationId: task.conversationId,
        });
    } catch (error) {
        console.error('Update scheduled task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get messages for a scheduled task conversation
export const getTaskMessages = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { taskType } = req.params;
        const { page = 1, limit = 20 } = req.query;

        // Find conversation
        const conversation = await Conversation.findOne({
            userId,
            type: 'scheduled_task',
            taskType,
        });

        if (!conversation) {
            return res.json({ messages: [], total: 0 });
        }

        // Get messages for this user from system
        const systemUserId = new mongoose.Types.ObjectId('000000000000000000000000');
        const messages = await Message.find({
            sender: systemUserId,
            receiver: new mongoose.Types.ObjectId(userId),
            type: 'system',
        })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await Message.countDocuments({
            sender: systemUserId,
            receiver: new mongoose.Types.ObjectId(userId),
            type: 'system',
        });

        res.json({
            messages: messages.reverse(),
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
        });
    } catch (error) {
        console.error('Get task messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all conversations for current user (including scheduled tasks)
export const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const conversations = await Conversation.find({ userId })
            .sort({ lastMessageAt: -1, createdAt: -1 });

        res.json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
