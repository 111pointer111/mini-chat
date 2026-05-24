import { Request, Response } from 'express';
import ScheduledTask, { TaskType } from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import mongoose from 'mongoose';
import { removeTaskScheduler, syncTaskScheduler, updateTaskNextRunAt } from '../services/taskScheduleService';

const PRESET_TASK_NAMES: Record<string, string> = {
    github_trending: 'GitHub 热点',
    daily_poem: '每日诗句',
    daily_english: '每日英文',
};

const PRESET_TASK_TYPES = ['github_trending', 'daily_poem', 'daily_english'] as const;

// Get all scheduled tasks for current user
export const getScheduledTasks = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get existing tasks
        const tasks = await ScheduledTask.find({ userId });

        // Preset tasks
        const presetTasks = PRESET_TASK_TYPES.map((taskType) => {
            const existingTask = tasks.find((t) => t.taskType === taskType);
            return {
                _id: existingTask?._id,
                taskType,
                taskName: PRESET_TASK_NAMES[taskType],
                enabled: existingTask?.enabled || false,
                pushTime: existingTask?.pushTime || '09:00',
                conversationId: existingTask?.conversationId,
                isCustom: false,
            };
        });

        // Custom tasks
        const customTasks = tasks
            .filter((t) => t.taskType === 'custom')
            .map((t) => ({
                _id: t._id,
                taskType: t.taskType,
                taskName: t.taskName,
                prompt: t.prompt,
                enabled: t.enabled,
                pushTime: t.pushTime,
                conversationId: t.conversationId,
                isCustom: true,
            }));

        res.json({
            presetTasks,
            customTasks,
        });
    } catch (error) {
        console.error('Get scheduled tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a preset scheduled task
export const updateScheduledTask = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const taskType = req.params.taskType as TaskType;
        const { enabled, pushTime, timezone } = req.body;

        // Validate taskType (only preset types)
        if (!PRESET_TASK_TYPES.includes(taskType as any)) {
            return res.status(400).json({ message: 'Invalid task type' });
        }

        // Find or create task
        let task = await ScheduledTask.findOne({ userId, taskType });

        if (!task) {
            // Create new task
            task = new ScheduledTask({
                userId,
                taskType,
                taskName: PRESET_TASK_NAMES[taskType],
                enabled: enabled ?? false,
                pushTime: pushTime || '09:00',
                timezone: timezone || 'Asia/Shanghai',
            });
        } else {
            // Update existing task
            if (enabled !== undefined) task.enabled = enabled;
            if (pushTime) task.pushTime = pushTime;
            if (timezone) task.timezone = timezone;
            // Ensure taskName is set for legacy tasks
            if (!task.taskName) {
                task.taskName = PRESET_TASK_NAMES[taskType];
            }
        }

        // If enabling task, create conversation if not exists
        if (task.enabled && !task.conversationId) {
            const conversation = await Conversation.create({
                userId: new mongoose.Types.ObjectId(userId),
                type: 'scheduled_task',
                name: PRESET_TASK_NAMES[taskType],
                taskType,
            });
            task.conversationId = conversation._id;
        }

        updateTaskNextRunAt(task);
        await task.save();
        await syncTaskScheduler(task);

        res.json({
            _id: task._id,
            taskType: task.taskType,
            taskName: task.taskName,
            enabled: task.enabled,
            pushTime: task.pushTime,
            conversationId: task.conversationId,
            isCustom: false,
        });
    } catch (error) {
        console.error('Update scheduled task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a custom scheduled task
export const createCustomTask = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { taskName, prompt, pushTime, timezone } = req.body;

        if (!taskName || !prompt) {
            return res.status(400).json({ message: 'taskName and prompt are required' });
        }

        // Create conversation for this task
        const conversation = await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'scheduled_task',
            name: taskName,
            taskType: 'custom',
        });

        // Create the task
        const task = new ScheduledTask({
            userId,
            taskType: 'custom',
            taskName,
            prompt,
            enabled: true,
            pushTime: pushTime || '09:00',
            timezone: timezone || 'Asia/Shanghai',
            conversationId: conversation._id,
        });
        updateTaskNextRunAt(task);

        await task.save();
        await syncTaskScheduler(task);

        res.json({
            _id: task._id,
            taskType: task.taskType,
            taskName: task.taskName,
            prompt: task.prompt,
            enabled: task.enabled,
            pushTime: task.pushTime,
            conversationId: task.conversationId,
            isCustom: true,
        });
    } catch (error) {
        console.error('Create custom task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update a custom scheduled task
export const updateCustomTask = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const taskId = String(req.params.taskId);
        const { enabled, pushTime, timezone } = req.body;

        const task = await ScheduledTask.findOne({ 
            _id: taskId, 
            userId, 
            taskType: 'custom' 
        });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (enabled !== undefined) task.enabled = enabled;
        if (pushTime) task.pushTime = pushTime;
        if (timezone) task.timezone = timezone;

        updateTaskNextRunAt(task);
        await task.save();
        await syncTaskScheduler(task);

        res.json({
            _id: task._id,
            taskType: task.taskType,
            taskName: task.taskName,
            prompt: task.prompt,
            enabled: task.enabled,
            pushTime: task.pushTime,
            conversationId: task.conversationId,
            isCustom: true,
        });
    } catch (error) {
        console.error('Update custom task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a custom scheduled task
export const deleteCustomTask = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const taskId = String(req.params.taskId);

        const task = await ScheduledTask.findOne({ 
            _id: taskId, 
            userId, 
            taskType: 'custom' 
        });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Delete associated conversation and messages
        if (task.conversationId) {
            await Message.deleteMany({ conversationId: task.conversationId });
            await Conversation.findByIdAndDelete(task.conversationId);
        }

        await ScheduledTask.findByIdAndDelete(taskId);
        await removeTaskScheduler(taskId).catch((error) => {
            console.warn(`[ScheduledTask] Failed to remove scheduler for ${taskId}:`, error);
        });

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete custom task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get messages for a scheduled task conversation
export const getTaskMessages = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { taskType } = req.params;
        const { page = 1, limit = 20 } = req.query;

        let conversation;

        // Check if taskType is a MongoDB ObjectId (custom task ID)
        const taskTypeStr = Array.isArray(taskType) ? taskType[0] : taskType;
        if (mongoose.Types.ObjectId.isValid(taskTypeStr) && taskTypeStr.length === 24) {
            // Find custom task by ID and get its conversation
            const customTask = await ScheduledTask.findOne({
                _id: taskType,
                userId,
                taskType: 'custom',
            });
            if (customTask?.conversationId) {
                conversation = await Conversation.findById(customTask.conversationId);
            }
        } else {
            // Find preset task conversation by taskType
            conversation = await Conversation.findOne({
                userId,
                type: 'scheduled_task',
                taskType,
            });
        }

        if (!conversation) {
            return res.json({ messages: [], total: 0 });
        }

        // Get messages for this conversation
        const messages = await Message.find({
            conversationId: conversation._id,
        })
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await Message.countDocuments({
            conversationId: conversation._id,
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
        const userId = req.user!.id;

        const conversations = await Conversation.find({ userId })
            .sort({ lastMessageAt: -1, createdAt: -1 });

        res.json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
