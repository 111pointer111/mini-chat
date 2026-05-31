import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/Message';
import mongoose from 'mongoose';
import { ChatMessage } from '../services/aiService';
import { GROUP_AI_TOOL_POLICY, runAgentStream, UserMessageInput } from '../services/agentService';
import { AI_ASSISTANT_ID } from '../scripts/initAdmin';
import GroupMember from '../models/GroupMember';
import Group from '../models/Group';
import { metrics } from '../monitoring/metrics';
import { AI_ASSISTANT_SENDER, normalizeMessageSender } from '../utils/messageSender';

interface DecodedToken {
    id: string;
    role: string;
}

let ioInstance: Server | null = null;

const ASSISTANT_MENTION_RE = /@(?:小助手|AI|ai|助手)\b/;

const isGroupMember = async (groupId: string, userId: string) => {
    return GroupMember.findOne({
        groupId: new mongoose.Types.ObjectId(groupId),
        userId: new mongoose.Types.ObjectId(userId),
    });
};

const populateMessageSender = async (messageId: mongoose.Types.ObjectId) => {
    const rawMessage = await Message.findById(messageId).lean();
    if (!rawMessage) return null;

    const message = await Message.findById(messageId).populate('sender', 'username avatar').lean();
    return normalizeMessageSender((message || rawMessage) as any, rawMessage.sender as any);
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

        // 记录 Socket.IO 连接数
        metrics.recordSocketConnections(io.engine.clientsCount);

        // Join a room based on user ID for personal notifications
        socket.join(userId);

        // Admin 加入 alerts room（接收告警推送）
        socket.on('join_alerts', () => {
            if (socket.data.user?.role === 'admin') {
                socket.join('alerts');
                console.log(`Admin ${userId} joined alerts room`);
            }
        });

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
                    callback({ success: true, messageId: newMessage._id.toString(), message: populated || newMessage });
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
                    const tempAssistantMessageId = `group-ai-${newMessage._id.toString()}`;
                    const streamStartedAt = new Date().toISOString();

                    io.to(`group:${groupId}`).emit('group_ai_stream_start', {
                        groupId,
                        tempMessageId: tempAssistantMessageId,
                        userMessageId: newMessage._id.toString(),
                        message: {
                            _id: tempAssistantMessageId,
                            sender: AI_ASSISTANT_SENDER,
                            groupId,
                            content: '',
                            type: 'text',
                            createdAt: streamStartedAt,
                        },
                    });

                    await runAgentStream(history, userInput, {
                        userId,
                        knowledgeScope: { type: 'group', id: groupId },
                        toolPolicy: GROUP_AI_TOOL_POLICY,
                        onChunk: (chunk) => {
                            fullContent += chunk;
                            io.to(`group:${groupId}`).emit('group_ai_stream_chunk', {
                                groupId,
                                tempMessageId: tempAssistantMessageId,
                                content: chunk,
                            });
                        },
                        onDone: async (sources) => {
                            const assistantMessage = await Message.create({
                                sender: AI_ASSISTANT_ID,
                                groupId: new mongoose.Types.ObjectId(groupId),
                                content: fullContent || '（无回复）',
                                type: 'text',
                            });
                            const populatedAssistant = await populateMessageSender(assistantMessage._id as mongoose.Types.ObjectId);
                            io.to(`group:${groupId}`).emit('group_ai_stream_done', {
                                groupId,
                                tempMessageId: tempAssistantMessageId,
                                message: populatedAssistant || assistantMessage,
                                sources: sources || [],
                            });
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
                            io.to(`group:${groupId}`).emit('group_ai_stream_error', {
                                groupId,
                                tempMessageId: tempAssistantMessageId,
                                error: err,
                                message: populatedError || errorMessage,
                            });
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

        socket.on('disconnect', () => {
            metrics.recordSocketConnections(io.engine.clientsCount);
            console.log('User disconnected:', userId);
        });
    });
};
