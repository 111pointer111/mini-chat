import { Request, Response } from 'express';
import mongoose from 'mongoose';
import aiService from '../services/aiService';
import ScheduledTask from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';

interface PendingTask {
    taskName: string;
    pushTime: string;
    prompt: string;
    summary: string;
    expiresAt: number;
}

const pendingTasks = new Map<string, PendingTask>();
const AI_ASSISTANT_ID = new mongoose.Types.ObjectId('000000000000000000000001');

// Helper: Get or create AI conversation for user
const getOrCreateAIConversation = async (userId: string) => {
    let conversation = await Conversation.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'ai',
    });

    if (!conversation) {
        conversation = await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
            name: 'AI 助手',
        });
    }

    return conversation;
};

// Helper: Save message to database
const saveMessage = async (conversationId: mongoose.Types.ObjectId, senderId: mongoose.Types.ObjectId, receiverId: mongoose.Types.ObjectId, content: string) => {
    const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        conversationId,
        content,
        type: 'text',
    });

    await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageAt: new Date(),
    });

    return message;
};

export const chat = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const { message, timezone } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // Get or create AI conversation
        const aiConversation = await getOrCreateAIConversation(userId);

        // Save user message
        await saveMessage(aiConversation._id as mongoose.Types.ObjectId, userObjectId, AI_ASSISTANT_ID, message);

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

                const replyContent = `✅ 定时任务创建成功！

📌 **任务名称**：${pendingTask.taskName}
⏰ **推送时间**：每天 ${pendingTask.pushTime}
📝 **推送内容**：${pendingTask.summary}

任务已启用，你可以在「定时任务设置」页面管理所有任务。`;

                // Save AI reply
                await saveMessage(aiConversation._id as mongoose.Types.ObjectId, AI_ASSISTANT_ID, userObjectId, replyContent);

                return res.json({
                    reply: replyContent,
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
                const cancelReply = '好的，已取消创建定时任务。有其他需要帮助的吗？';
                await saveMessage(aiConversation._id as mongoose.Types.ObjectId, AI_ASSISTANT_ID, userObjectId, cancelReply);
                return res.json({
                    reply: cancelReply,
                    taskCreated: false,
                });
            }
            // If not confirming/canceling, continue to process as normal message
            // but clear the pending task
            pendingTasks.delete(userId);
        }

        // Parse user intent
        const parseResult = await aiService.parseTaskIntent(message, userId);

        if (parseResult.isTaskCreation && parseResult.task) {
            // Store pending task for confirmation
            pendingTasks.set(userId, {
                ...parseResult.task,
                expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
            });

            const confirmReply = `我理解你想创建以下定时任务：

📌 **任务名称**：${parseResult.task.taskName}
⏰ **推送时间**：每天 ${parseResult.task.pushTime}
📝 **推送内容**：${parseResult.task.summary}

确认创建吗？回复「**确认**」创建任务，或「**取消**」放弃。
你也可以告诉我需要修改的地方。`;

            await saveMessage(aiConversation._id as mongoose.Types.ObjectId, AI_ASSISTANT_ID, userObjectId, confirmReply);

            return res.json({
                reply: confirmReply,
                pendingTask: true,
                taskPreview: parseResult.task,
            });
        }

        // Normal chat response
        const normalReply = parseResult.reply || '抱歉，我没有理解你的意思。';
        await saveMessage(aiConversation._id as mongoose.Types.ObjectId, AI_ASSISTANT_ID, userObjectId, normalReply);

        return res.json({
            reply: normalReply,
            taskCreated: false,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get AI chat history
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { page = 1, limit = 50 } = req.query;

        const conversation = await Conversation.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
        });

        if (!conversation) {
            return res.json({ messages: [], total: 0 });
        }

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
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
