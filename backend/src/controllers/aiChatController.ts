import { Request, Response } from 'express';
import mongoose from 'mongoose';
import geminiService from '../services/geminiService';
import ScheduledTask from '../models/ScheduledTask';
import Conversation from '../models/Conversation';

interface PendingTask {
    taskName: string;
    pushTime: string;
    prompt: string;
    summary: string;
    expiresAt: number;
}

const pendingTasks = new Map<string, PendingTask>();

export const chat = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { message, timezone } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // Check if user is confirming a pending task
        const pendingTask = pendingTasks.get(userId);
        if (pendingTask && pendingTask.expiresAt > Date.now()) {
            const lowerMessage = message.toLowerCase().trim();
            
            if (lowerMessage === '确认' || lowerMessage === '确定' || lowerMessage === 'yes' || lowerMessage === 'ok') {
                // Create the task
                const conversation = await Conversation.create({
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'scheduled_task',
                    name: pendingTask.taskName,
                    taskType: 'custom',
                });

                const task = new ScheduledTask({
                    userId,
                    taskType: 'custom',
                    taskName: pendingTask.taskName,
                    prompt: pendingTask.prompt,
                    enabled: true,
                    pushTime: pendingTask.pushTime,
                    timezone: timezone || 'Asia/Shanghai',
                    conversationId: conversation._id,
                });

                await task.save();
                pendingTasks.delete(userId);

                return res.json({
                    reply: `✅ 定时任务创建成功！

📌 **任务名称**：${pendingTask.taskName}
⏰ **推送时间**：每天 ${pendingTask.pushTime}
📝 **推送内容**：${pendingTask.summary}

任务已启用，你可以在「定时任务设置」页面管理所有任务。`,
                    taskCreated: true,
                    task: {
                        _id: task._id,
                        taskName: task.taskName,
                        pushTime: task.pushTime,
                        enabled: task.enabled,
                    },
                });
            } else if (lowerMessage === '取消' || lowerMessage === 'cancel' || lowerMessage === 'no') {
                pendingTasks.delete(userId);
                return res.json({
                    reply: '好的，已取消创建定时任务。有其他需要帮助的吗？',
                    taskCreated: false,
                });
            }
            // If not confirming/canceling, continue to process as normal message
            // but clear the pending task
            pendingTasks.delete(userId);
        }

        // Parse user intent
        const parseResult = await geminiService.parseTaskIntent(message);

        if (parseResult.isTaskCreation && parseResult.task) {
            // Store pending task for confirmation
            pendingTasks.set(userId, {
                ...parseResult.task,
                expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
            });

            return res.json({
                reply: `我理解你想创建以下定时任务：

📌 **任务名称**：${parseResult.task.taskName}
⏰ **推送时间**：每天 ${parseResult.task.pushTime}
📝 **推送内容**：${parseResult.task.summary}

确认创建吗？回复「**确认**」创建任务，或「**取消**」放弃。
你也可以告诉我需要修改的地方。`,
                pendingTask: true,
                taskPreview: parseResult.task,
            });
        }

        // Normal chat response
        return res.json({
            reply: parseResult.reply || '抱歉，我没有理解你的意思。',
            taskCreated: false,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
