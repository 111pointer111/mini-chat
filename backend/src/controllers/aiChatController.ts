import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { AiTurnError, normalizeAiImages, runAiChatTurn, streamAiChatTurn } from '../services/aiTurnService';
import { invalidateMessageCache } from '../utils/messageCache';

function writeSse(res: Response, payload: Record<string, unknown>) {
    if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
}

export const chat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const {
            message = '',
            timezone,
            conversationId,
            modelImages,
            displayImages,
            images,
        } = req.body as {
            message?: string;
            timezone?: string;
            conversationId?: string;
            modelImages?: string[];
            displayImages?: string[];
            images?: string[];
        };

        const { modelImages: normalizedModelImages, displayImages: normalizedDisplayImages } = normalizeAiImages({
            modelImages,
            displayImages,
            legacyImages: images,
        });

        const result = await runAiChatTurn({
            userId,
            message,
            timezone,
            conversationId,
            modelImages: normalizedModelImages,
            displayImages: normalizedDisplayImages,
        });

        return res.json({
            reply: result.reply,
            conversationId: result.conversationId,
            conversationName: result.conversationName,
            taskCreated: result.taskCreated ?? false,
            pendingTask: result.pendingTask,
            task: result.task,
            taskPreview: result.taskPreview,
            sources: result.sources,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        if (error instanceof AiTurnError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        return res.status(500).json({ message: 'Server error' });
    }
};

// 流式聊天端点
export const chatStream = async (req: Request, res: Response) => {
    let headersSent = false;
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
        if (keepaliveTimer) {
            clearInterval(keepaliveTimer);
            keepaliveTimer = null;
        }
    };

    try {
        const userId = req.user!.id;
        const {
            message = '',
            timezone,
            conversationId,
            modelImages,
            images = [],
            displayImages = [],
        } = req.body as {
            message?: string;
            timezone?: string;
            conversationId?: string;
            modelImages?: string[];
            images?: string[];
            displayImages?: string[];
        };

        const { modelImages: normalizedModelImages, displayImages: normalizedDisplayImages } = normalizeAiImages({
            modelImages,
            displayImages,
            legacyImages: images,
        });

        if (!message.trim() && normalizedModelImages.length === 0) {
            return res.status(400).json({ message: 'Message is required' });
        }

        // 设置 SSE 头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲
        res.flushHeaders();
        headersSent = true;

        // 心跳：每 15 秒发送 SSE 注释防止移动网络断开空闲连接
        keepaliveTimer = setInterval(() => {
            if (!res.writableEnded) {
                res.write(': keepalive\n\n');
            }
        }, 15_000);

        // 客户端断开时清理
        req.on('close', cleanup);

        await streamAiChatTurn({
            userId,
            message,
            timezone,
            conversationId,
            modelImages: normalizedModelImages,
            displayImages: normalizedDisplayImages,
        }, (event) => {
            writeSse(res, event);
        });

        cleanup();
        if (!res.writableEnded) {
            res.end();
        }
    } catch (error) {
        cleanup();
        console.error('AI chat stream error:', error);
        if (headersSent || res.headersSent) {
            const message = error instanceof AiTurnError ? error.message : 'Server error';
            writeSse(res, { type: 'error', message });
            if (!res.writableEnded) res.end();
        } else {
            const status = error instanceof AiTurnError ? error.statusCode : 500;
            const message = error instanceof AiTurnError ? error.message : 'Server error';
            res.status(status).json({ message });
        }
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
        await invalidateMessageCache(conversation._id as mongoose.Types.ObjectId);
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
