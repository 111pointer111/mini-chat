import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/Message';
import mongoose from 'mongoose';
import { ChatMessage, autoTitleConversation } from '../services/aiService';
import { runAgentStream, UserMessageInput } from '../services/agentService';
import { AI_ASSISTANT_ID } from '../scripts/initAdmin';
import GroupMember from '../models/GroupMember';
import Group from '../models/Group';

interface DecodedToken {
    id: string;
    role: string;
}

let ioInstance: Server | null = null;

// 追踪用户正在进行的流式响应内容
const streamContentMap = new Map<string, string>();

const getOrCreateAIConversation = async (userId: string) => {
    const Conversation = (await import('../models/Conversation')).default;
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

const saveStreamMessage = async (userId: string, conversationId: mongoose.Types.ObjectId, content: string) => {
    const MessageModel = (await import('../models/Message')).default;
    const Conversation = (await import('../models/Conversation')).default;
    await MessageModel.create({
        sender: AI_ASSISTANT_ID,
        receiver: new mongoose.Types.ObjectId(userId),
        conversationId,
        content,
        type: 'text',
    });
    await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
};

const ASSISTANT_MENTION_RE = /@(?:小助手|AI|ai|助手)\b/;

const isGroupMember = async (groupId: string, userId: string) => {
    return GroupMember.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        userId: new mongoose.Types.ObjectId(userId),
    });
};

const populateMessageSender = async (messageId: mongoose.Types.ObjectId) => {
    return Message.findById(messageId).populate('sender', 'username avatar').lean();
};

export const getIO = (): Server => {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized');
    }
    return ioInstance;
};

export const setupSocket = (io: Server) => {
    ioInstance = io;
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
            socket.data.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = socket.data.user.id;
        console.log(`User connected: ${userId}`);

        // Join a room based on user ID for personal notifications
        socket.join(userId);

        GroupMember.find({ userId: new mongoose.Types.ObjectId(userId) })
            .select('groupId')
            .lean()
            .then((memberships) => {
                memberships.forEach((membership) => {
                    socket.join(`group:${membership.groupId.toString()}`);
                });
            })
            .catch((err) => console.error('Join group rooms error:', err));

        // Join a chat room
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`User ${userId} joined room: ${room}`);
        });

        socket.on('join_group_room', async (groupId, callback) => {
            const membership = await isGroupMember(groupId, userId);
            if (!membership) {
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Not a group member' });
                }
                return;
            }
            socket.join(`group:${groupId}`);
            if (typeof callback === 'function') {
                callback({ success: true });
            }
        });

        // Handle sending messages
        socket.on('send_message', async (data, callback) => {
            const { receiverId, content, type = 'text' } = data;

            if (!receiverId || !content) {
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Invalid message data' });
                }
                return;
            }

            try {
                // Save to database
                const newMessage = await Message.create({
                    sender: userId,
                    receiver: receiverId,
                    content,
                    type
                });

                // Emit to receiver's personal room
                io.to(receiverId).emit('receive_message', newMessage);

                // Acknowledge to sender with the real message ID
                if (typeof callback === 'function') {
                    callback({ success: true, messageId: newMessage._id.toString() });
                }

            } catch (error) {
                console.error('Socket message error:', error);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Failed to send message' });
                }
            }
        });

        socket.on('send_group_message', async (data, callback) => {
            const { groupId, content, type = 'text' } = data;
            if (!groupId || !content) {
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Invalid group message data' });
                }
                return;
            }

            try {
                const membership = await isGroupMember(groupId, userId);
                if (!membership) {
                    if (typeof callback === 'function') {
                        callback({ success: false, error: 'Not a group member' });
                    }
                    return;
                }

                const group = await Group.findById(groupId);
                const mentionAssistant = Boolean(group?.assistantEnabled && ASSISTANT_MENTION_RE.test(content));
                const newMessage = await Message.create({
                    sender: new mongoose.Types.ObjectId(userId),
                    groupId: new mongoose.Types.ObjectId(groupId),
                    content,
                    type,
                    mentionAssistant,
                });

                const populated = await populateMessageSender(newMessage._id as mongoose.Types.ObjectId);
                socket.to(`group:${groupId}`).emit('receive_group_message', populated || newMessage);

                if (typeof callback === 'function') {
                    callback({ success: true, messageId: newMessage._id.toString() });
                }

                if (mentionAssistant) {
                    const historyMessages = await Message.find({
                        groupId: new mongoose.Types.ObjectId(groupId),
                    })
                        .sort({ createdAt: -1 })
                        .limit(12)
                        .populate('sender', 'username')
                        .lean();

                    const history: ChatMessage[] = historyMessages
                        .reverse()
                        .slice(0, -1)
                        .map((msg: any) => ({
                            role: msg.sender?._id?.toString() === AI_ASSISTANT_ID.toString() ? 'assistant' as const : 'user' as const,
                            content: `${msg.sender?.username || '用户'}：${msg.content}`,
                        }));

                    const cleanContent = content.replace(ASSISTANT_MENTION_RE, '').trim() || content;
                    const userInput: UserMessageInput = { text: cleanContent };
                    let fullContent = '';

                    await runAgentStream(history, userInput, {
                        userId,
                        knowledgeScope: { type: 'group', id: groupId },
                        onChunk: (chunk) => {
                            fullContent += chunk;
                        },
                        onDone: async () => {
                            if (!fullContent.trim()) return;
                            const assistantMessage = await Message.create({
                                sender: AI_ASSISTANT_ID,
                                groupId: new mongoose.Types.ObjectId(groupId),
                                content: fullContent,
                                type: 'text',
                            });
                            const populatedAssistant = await populateMessageSender(assistantMessage._id as mongoose.Types.ObjectId);
                            io.to(`group:${groupId}`).emit('receive_group_message', populatedAssistant || assistantMessage);
                        },
                        onError: async (err) => {
                            const errorMessage = await Message.create({
                                sender: AI_ASSISTANT_ID,
                                groupId: new mongoose.Types.ObjectId(groupId),
                                content: `小助手响应失败：${err}`,
                                type: 'system',
                            });
                            const populatedError = await populateMessageSender(errorMessage._id as mongoose.Types.ObjectId);
                            io.to(`group:${groupId}`).emit('receive_group_message', populatedError || errorMessage);
                        },
                    });
                }
            } catch (error) {
                console.error('Socket group message error:', error);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Failed to send group message' });
                }
            }
        });

        // AI 流式对话
        socket.on('ai_chat_stream', async (data, callback) => {
            const { message, images, timezone, conversationId } = data;

            if (!message) {
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Message is required' });
                }
                return;
            }

            try {
                // 取消该用户之前的流（如果有）
                streamContentMap.delete(userId);

                // 获取或创建会话
                const Conversation = (await import('../models/Conversation')).default;
                let aiConversation;
                if (conversationId) {
                    aiConversation = await Conversation.findOne({
                        _id: conversationId,
                        userId: new mongoose.Types.ObjectId(userId),
                        type: 'ai',
                    });
                }
                if (!aiConversation) {
                    aiConversation = await getOrCreateAIConversation(userId);
                }

                // 保存用户消息（支持图片）
                const userObjectId = new mongoose.Types.ObjectId(userId);
                await Message.create({
                    sender: userObjectId,
                    receiver: AI_ASSISTANT_ID,
                    conversationId: aiConversation._id,
                    content: message,
                    type: 'text',
                    images: images || [],
                });
                await Conversation.findByIdAndUpdate(aiConversation._id, { lastMessageAt: new Date() });

                // 获取历史（最近10条，不含刚发的用户消息）
                const MessageModel = (await import('../models/Message')).default;
                const historyMessages = await MessageModel.find({
                    conversationId: aiConversation._id,
                })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean();

                const history: ChatMessage[] = historyMessages
                    .reverse()
                    .slice(0, -1)
                    .map((msg: any) => ({
                        role: msg.sender.toString() === AI_ASSISTANT_ID.toString() ? 'assistant' as const : 'user' as const,
                        content: msg.content,
                        images: msg.images,
                    }));

                // 先发送会话信息
                if (typeof callback === 'function') {
                    callback({ success: true, conversationId: aiConversation._id.toString() });
                }

                // 发送 "思考中" 状态
                socket.emit('ai_stream_status', { status: 'thinking' });

                // 构建消息输入（文本 + 可选图片）
                const userInput: UserMessageInput = { text: message, images: images || [] };

                // 使用 Agent 运行（支持工具调用 + 图片理解）
                let fullContent = '';
                await runAgentStream(history, userInput, {
                    userId,
                    onChunk: (chunk) => {
                        fullContent += chunk;
                        socket.emit('ai_stream', { content: chunk, done: false });
                    },
                    onDone: async () => {
                        socket.emit('ai_stream', { content: '', done: true });
                        if (fullContent) {
                            await saveStreamMessage(userId, aiConversation._id as mongoose.Types.ObjectId, fullContent);
                            const convId = aiConversation._id.toString();
                            const newTitle = await autoTitleConversation(convId, userId, message, fullContent);
                            if (newTitle) {
                                socket.emit('conversation_renamed', { conversationId: convId, name: newTitle });
                            }
                        }
                    },
                    onError: (err) => {
                        socket.emit('ai_stream_error', { error: err });
                    },
                });

            } catch (error) {
                console.error('AI stream error:', error);
                socket.emit('ai_stream_error', { error: 'AI 响应失败，请重试' });
            }
        });

        socket.on('ai_cancel_stream', () => {
            streamContentMap.delete(userId);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', userId);
        });
    });
};
