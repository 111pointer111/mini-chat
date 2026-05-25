import { Request, Response } from 'express';
import mongoose from 'mongoose';
import aiService, { ChatMessage, autoTitleConversation } from '../services/aiService';
import { chatWithKnowledge } from '../services/kbService';
import { runAgent, runAgentStream } from '../services/agentService';
import ScheduledTask from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import redis from '../utils/redis';
import { AI_ASSISTANT_ID } from '../scripts/initAdmin';
import { syncTaskScheduler, updateTaskNextRunAt } from '../services/taskScheduleService';
import { getRecentMessages, invalidateMessageCache } from '../utils/messageCache';

const PENDING_TASK_TTL = 300; // 5 minutes in seconds

interface PendingTask {
    taskName: string;
    pushTime: string;
    prompt: string;
    summary: string;
}

// 规则预筛选：只对疑似任务创建才调用 AI 解析
const TASK_KEYWORDS = ['定时', '每天', '推送', '提醒', '创建任务', '设置任务', '定时任务'];

function mightBeTaskCreation(message: string): boolean {
    return TASK_KEYWORDS.some(kw => message.includes(kw));
}

const pendingTaskKey = (userId: string) => `pending_task:${userId}`;

const getPendingTask = async (userId: string): Promise<PendingTask | null> => {
    const data = await redis.get(pendingTaskKey(userId));
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
};

const setPendingTask = async (userId: string, task: PendingTask): Promise<void> => {
    await redis.setex(pendingTaskKey(userId), PENDING_TASK_TTL, JSON.stringify(task));
};

const clearPendingTask = async (userId: string): Promise<void> => {
    await redis.del(pendingTaskKey(userId));
};

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
        const userId = req.user!.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const { message, timezone, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // Get specific conversation or create default one
        let aiConversation;
        if (conversationId) {
            aiConversation = await Conversation.findOne({
                _id: conversationId,
                userId: new mongoose.Types.ObjectId(userId),
                type: 'ai',
            });
            if (!aiConversation) {
                return res.status(404).json({ message: 'Conversation not found' });
            }
        } else {
            aiConversation = await getOrCreateAIConversation(userId);
        }

        const convId = aiConversation._id as mongoose.Types.ObjectId;

        // 并发执行：保存用户消息 + 获取历史 + 检查待处理任务
        const [_, historyMessages, pendingTask] = await Promise.all([
            saveMessage(convId, userObjectId, AI_ASSISTANT_ID, message),
            getRecentMessages(convId, 10),
            getPendingTask(userId),
        ]);

        // Check if user is confirming a pending task
        if (pendingTask) {
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
                updateTaskNextRunAt(task);

                await task.save();
                await syncTaskScheduler(task);
                await clearPendingTask(userId);

                const replyContent = `✅ 定时任务创建成功！

📌 **任务名称**：${pendingTask.taskName}
⏰ **推送时间**：每天 ${pendingTask.pushTime}
📝 **推送内容**：${pendingTask.summary}

任务已启用，你可以在「定时任务设置」页面管理所有任务。`;

                // Save AI reply
                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, replyContent);

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
                await clearPendingTask(userId);
                const cancelReply = '好的，已取消创建定时任务。有其他需要帮助的吗？';
                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, cancelReply);
                return res.json({
                    reply: cancelReply,
                    taskCreated: false,
                });
            }
            // If not confirming/canceling, continue to process as normal message
            // but clear the pending task
            await clearPendingTask(userId);
        }

        // Convert to ChatMessage format (reverse to chronological order, exclude current message)
        const history: ChatMessage[] = historyMessages
            .slice(0, -1) // Exclude the message we just saved
            .map((msg: any) => ({
                role: msg.sender.equals(AI_ASSISTANT_ID) ? 'assistant' as const : 'user' as const,
                content: msg.content,
            }));

        // 规则预筛选：只对疑似任务创建才调用 AI 解析
        if (mightBeTaskCreation(message)) {
            const parseResult = await aiService.parseTaskIntent(message, userId);

            if (parseResult.isTaskCreation && parseResult.task) {
                // Store pending task for confirmation (TTL handled by Redis)
                await setPendingTask(userId, parseResult.task);

                const confirmReply = `我理解你想创建以下定时任务：

📌 **任务名称**：${parseResult.task.taskName}
⏰ **推送时间**：每天 ${parseResult.task.pushTime}
📝 **推送内容**：${parseResult.task.summary}

确认创建吗？回复「**确认**」创建任务，或「**取消**」放弃。
你也可以告诉我需要修改的地方。`;

                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, confirmReply);

                return res.json({
                    reply: confirmReply,
                    pendingTask: true,
                    taskPreview: parseResult.task,
                });
            }
        }

        // Normal chat response using Agent (supports tools + MCP)
        const normalReply = await runAgent(history, message, { userId });
        await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, normalReply);

        // 自动生成标题（异步，不阻塞响应）
        autoTitleConversation(convId.toString(), userId, message, normalReply)
            .catch(err => console.error('Auto-title failed:', err));

        return res.json({
            reply: normalReply,
            taskCreated: false,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 流式聊天端点
export const chatStream = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const { message, timezone, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // 设置 SSE 头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
        res.flushHeaders();

        // Get specific conversation or create default one
        let aiConversation;
        if (conversationId) {
            aiConversation = await Conversation.findOne({
                _id: conversationId,
                userId: new mongoose.Types.ObjectId(userId),
                type: 'ai',
            });
            if (!aiConversation) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Conversation not found' })}\n\n`);
                res.end();
                return;
            }
        } else {
            aiConversation = await getOrCreateAIConversation(userId);
        }

        const convId = aiConversation._id as mongoose.Types.ObjectId;

        // 并发执行：保存用户消息 + 获取历史 + 检查待处理任务
        const [_, historyMessages, pendingTask] = await Promise.all([
            saveMessage(convId, userObjectId, AI_ASSISTANT_ID, message),
            getRecentMessages(convId, 10),
            getPendingTask(userId),
        ]);

        // Check if user is confirming a pending task
        if (pendingTask) {
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
                updateTaskNextRunAt(task);

                await task.save();
                await syncTaskScheduler(task);
                await clearPendingTask(userId);

                const replyContent = `✅ 定时任务创建成功！

📌 **任务名称**：${pendingTask.taskName}
⏰ **推送时间**：每天 ${pendingTask.pushTime}
📝 **推送内容**：${pendingTask.summary}

任务已启用，你可以在「定时任务设置」页面管理所有任务。`;

                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, replyContent);

                res.write(`data: ${JSON.stringify({ type: 'chunk', content: replyContent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', taskCreated: true, task: { _id: task._id, taskName: task.taskName, pushTime: task.pushTime, enabled: task.enabled } })}\n\n`);
                res.end();
                return;
            } else if (lowerMessage === '取消' || lowerMessage === 'cancel' || lowerMessage === 'no') {
                await clearPendingTask(userId);
                const cancelReply = '好的，已取消创建定时任务。有其他需要帮助的吗？';
                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, cancelReply);

                res.write(`data: ${JSON.stringify({ type: 'chunk', content: cancelReply })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', taskCreated: false })}\n\n`);
                res.end();
                return;
            }
            // If not confirming/canceling, continue to process as normal message
            // but clear the pending task
            await clearPendingTask(userId);
        }

        // Convert to ChatMessage format
        const history: ChatMessage[] = historyMessages
            .slice(0, -1)
            .map((msg: any) => ({
                role: msg.sender.equals(AI_ASSISTANT_ID) ? 'assistant' as const : 'user' as const,
                content: msg.content,
            }));

        // 规则预筛选：只对疑似任务创建才调用 AI 解析
        if (mightBeTaskCreation(message)) {
            const parseResult = await aiService.parseTaskIntent(message, userId);

            if (parseResult.isTaskCreation && parseResult.task) {
                await setPendingTask(userId, parseResult.task);

                const confirmReply = `我理解你想创建以下定时任务：

📌 **任务名称**：${parseResult.task.taskName}
⏰ **推送时间**：每天 ${parseResult.task.pushTime}
📝 **推送内容**：${parseResult.task.summary}

确认创建吗？回复「**确认**」创建任务，或「**取消**」放弃。
你也可以告诉我需要修改的地方。`;

                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, confirmReply);

                res.write(`data: ${JSON.stringify({ type: 'chunk', content: confirmReply })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', pendingTask: true, taskPreview: parseResult.task })}\n\n`);
                res.end();
                return;
            }
        }

        // 流式调用 Agent
        let fullContent = '';
        await runAgentStream(history, message, {
            userId,
            onChunk: (chunk) => {
                fullContent += chunk;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            },
            onDone: async (sources) => {
                // 保存完整回复
                await saveMessage(convId, AI_ASSISTANT_ID, userObjectId, fullContent);

                // 自动生成标题（异步）
                autoTitleConversation(convId.toString(), userId, message, fullContent)
                    .catch(err => console.error('Auto-title failed:', err));

                res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
                res.end();
            },
            onError: (err) => {
                res.write(`data: ${JSON.stringify({ type: 'error', message: err })}\n\n`);
                res.end();
            },
        });
    } catch (error) {
        console.error('AI chat stream error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Server error' })}\n\n`);
        res.end();
    }
};

// Get all AI conversations for user
export const getConversations = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const conversations = await Conversation.find({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
        })
            .sort({ lastMessageAt: -1 })
            .lean();

        res.json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create new AI conversation
export const createConversation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name } = req.body;

        const conversation = await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
            name: name || `对话 ${new Date().toLocaleDateString('zh-CN')}`,
        });

        res.json(conversation);
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update AI conversation name
export const updateConversation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                userId: new mongoose.Types.ObjectId(userId),
                type: 'ai',
            },
            { name: name.trim() },
            { new: true }
        );

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        res.json(conversation);
    } catch (error) {
        console.error('Update conversation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete AI conversation
export const deleteConversation = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // Delete all messages in conversation
        await Message.deleteMany({ conversationId: conversation._id });
        // Delete conversation
        await Conversation.findByIdAndDelete(conversationId);

        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get AI chat history for specific conversation
export const getChatHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // If conversationId provided, use it; otherwise get default conversation
        let conversation;
        if (conversationId) {
            conversation = await Conversation.findOne({
                _id: conversationId,
                userId: new mongoose.Types.ObjectId(userId),
                type: 'ai',
            });
        } else {
            conversation = await Conversation.findOne({
                userId: new mongoose.Types.ObjectId(userId),
                type: 'ai',
            }).sort({ lastMessageAt: -1 });
        }

        if (!conversation) {
            return res.json({ messages: [], total: 0, conversationId: null });
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
            conversationId: conversation._id,
            conversationName: conversation.name,
        });
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
