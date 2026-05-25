import mongoose from 'mongoose';
import aiService, { ChatMessage, autoTitleConversation } from './aiService';
import { AI_DIRECT_TOOL_POLICY, runAgent, runAgentStream, type UserMessageInput } from './agentService';
import type { Source } from './kbEmbeddingService';
import ScheduledTask from '../models/ScheduledTask';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import redis from '../utils/redis';
import { AI_ASSISTANT_ID } from '../scripts/initAdmin';
import { syncTaskScheduler, updateTaskNextRunAt } from './taskScheduleService';
import { appendMessageToCache, getRecentMessages, type CachedMessage } from '../utils/messageCache';

const PENDING_TASK_TTL = 300;
const HISTORY_LIMIT = 10;

const CONFIRM_WORDS = new Set(['确认', '确定', 'yes', 'ok']);
const CANCEL_WORDS = new Set(['取消', 'cancel', 'no']);

export interface PendingTask {
    taskName: string;
    pushTime: string;
    prompt: string;
    summary: string;
}

export interface AiChatTurnInput {
    userId: string;
    message: string;
    timezone?: string;
    conversationId?: string;
    modelImages?: string[];
    displayImages?: string[];
    legacyImages?: string[];
}

export interface AiChatTurnResult {
    conversationId: string;
    conversationName?: string;
    reply: string;
    sources?: Source[];
    pendingTask?: boolean;
    taskCreated?: boolean;
    task?: {
        _id: unknown;
        taskName: string;
        pushTime: string;
        enabled: boolean;
    };
    taskPreview?: PendingTask;
}

export type AiChatStreamEvent =
    | { type: 'status'; stage: 'preparing' | 'retrieving' | 'generating' | 'tool'; message: string }
    | { type: 'ready'; conversationId: string; conversationName?: string }
    | { type: 'chunk'; content: string }
    | {
        type: 'done';
        conversationId?: string;
        sources?: Source[];
        pendingTask?: boolean;
        taskCreated?: boolean;
        task?: AiChatTurnResult['task'];
        taskPreview?: PendingTask;
    }
    | { type: 'error'; message: string };

export class AiTurnError extends Error {
    constructor(
        message: string,
        public readonly statusCode = 500
    ) {
        super(message);
    }
}

function mightBeTaskCreation(message: string): boolean {
    const text = message.trim().toLowerCase();
    if (!text) return false;

    const explicitTaskIntent = /(定时任务|创建任务|设置任务|定时推送|定时发送|任务提醒)/i.test(text);
    const reminderIntent = /(提醒|推送|通知|叫我|发给我|发一下|发送)/i.test(text);
    const timeExpression = /(每天|每日|每周|每月|明天|后天|今晚|早上|上午|中午|下午|晚上|凌晨|[0-2]?\d\s*[:：点时])/i.test(text);

    return explicitTaskIntent || (reminderIntent && timeExpression);
}

function normalizeStringList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

function isDisplayableImage(imageUrl: string): boolean {
    return /^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('/uploads/');
}

export function normalizeAiImages(input: {
    modelImages?: unknown;
    displayImages?: unknown;
    legacyImages?: unknown;
}): { modelImages: string[]; displayImages: string[] } {
    const legacyImages = normalizeStringList(input.legacyImages);
    const explicitModelImages = normalizeStringList(input.modelImages);
    const explicitDisplayImages = normalizeStringList(input.displayImages);

    const modelImages = explicitModelImages.length > 0 ? explicitModelImages : legacyImages;
    const displayImages = explicitDisplayImages.length > 0
        ? explicitDisplayImages
        : legacyImages.filter(isDisplayableImage);

    return { modelImages, displayImages };
}

function getSenderId(sender: unknown): string {
    if (typeof sender === 'string') return sender;
    if (sender && typeof sender === 'object' && '_id' in sender) {
        const id = (sender as { _id?: unknown })._id;
        return id?.toString() || '';
    }
    return sender?.toString() || '';
}

function isAssistantSender(sender: unknown): boolean {
    return getSenderId(sender) === AI_ASSISTANT_ID.toString();
}

function toChatHistory(messages: CachedMessage[]): ChatMessage[] {
    return messages
        .slice(0, -1)
        .map((msg) => ({
            role: isAssistantSender(msg.sender) ? 'assistant' as const : 'user' as const,
            content: msg.content,
            images: msg.images || [],
        }));
}

const pendingTaskKey = (userId: string) => `pending_task:${userId}`;

async function getPendingTask(userId: string): Promise<PendingTask | null> {
    const data = await redis.get(pendingTaskKey(userId));
    if (!data) return null;
    try {
        return JSON.parse(data) as PendingTask;
    } catch {
        return null;
    }
}

async function setPendingTask(userId: string, task: PendingTask): Promise<void> {
    await redis.setex(pendingTaskKey(userId), PENDING_TASK_TTL, JSON.stringify(task));
}

async function clearPendingTask(userId: string): Promise<void> {
    await redis.del(pendingTaskKey(userId));
}

async function getOrCreateAIConversation(userId: string) {
    let conversation = await Conversation.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        type: 'ai',
    }).sort({ lastMessageAt: -1, createdAt: -1 });

    if (!conversation) {
        conversation = await Conversation.create({
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
            name: 'AI 助手',
        });
    }

    return conversation;
}

async function resolveAIConversation(userId: string, conversationId?: string) {
    if (conversationId) {
        const conversation = await Conversation.findOne({
            _id: conversationId,
            userId: new mongoose.Types.ObjectId(userId),
            type: 'ai',
        });
        if (!conversation) {
            throw new AiTurnError('Conversation not found', 404);
        }
        return conversation;
    }

    return getOrCreateAIConversation(userId);
}

async function saveDirectMessage(
    conversationId: mongoose.Types.ObjectId,
    senderId: mongoose.Types.ObjectId,
    receiverId: mongoose.Types.ObjectId,
    content: string,
    images: string[] = []
) {
    const message = await Message.create({
        sender: senderId,
        receiver: receiverId,
        conversationId,
        content,
        type: 'text',
        images,
    });

    await Promise.all([
        Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() }),
        appendMessageToCache(
            conversationId,
            JSON.parse(JSON.stringify(message.toObject())) as Record<string, unknown>
        ),
    ]);

    return message;
}

async function createConfirmedTask(
    userId: string,
    timezone: string | undefined,
    pendingTask: PendingTask
) {
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

    return task;
}

function buildTaskCreatedReply(pendingTask: PendingTask): string {
    return `✅ 定时任务创建成功！

📌 **任务名称**：${pendingTask.taskName}
⏰ **推送时间**：每天 ${pendingTask.pushTime}
📝 **推送内容**：${pendingTask.summary}

任务已启用，你可以在「定时任务设置」页面管理所有任务。`;
}

function buildTaskConfirmReply(task: PendingTask): string {
    return `我理解你想创建以下定时任务：

📌 **任务名称**：${task.taskName}
⏰ **推送时间**：每天 ${task.pushTime}
📝 **推送内容**：${task.summary}

确认创建吗？回复「**确认**」创建任务，或「**取消**」放弃。
你也可以告诉我需要修改的地方。`;
}

interface PreparedTurn {
    userObjectId: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    conversationName?: string;
    messageText: string;
    modelImages: string[];
    displayImages: string[];
    history: ChatMessage[];
    pendingTask: PendingTask | null;
}

async function prepareTurn(input: AiChatTurnInput): Promise<PreparedTurn> {
    const messageText = input.message.trim();
    const { modelImages, displayImages } = normalizeAiImages({
        modelImages: input.modelImages,
        displayImages: input.displayImages,
        legacyImages: input.legacyImages,
    });

    if (!messageText && modelImages.length === 0) {
        throw new AiTurnError('Message is required', 400);
    }

    const userObjectId = new mongoose.Types.ObjectId(input.userId);
    const aiConversation = await resolveAIConversation(input.userId, input.conversationId);
    const conversationId = aiConversation._id as mongoose.Types.ObjectId;
    const pendingTaskPromise = getPendingTask(input.userId);
    const storedContent = messageText || '[图片]';

    await saveDirectMessage(conversationId, userObjectId, AI_ASSISTANT_ID, storedContent, displayImages);

    const [historyMessages, pendingTask] = await Promise.all([
        getRecentMessages(conversationId, HISTORY_LIMIT),
        pendingTaskPromise,
    ]);

    return {
        userObjectId,
        conversationId,
        conversationName: aiConversation.name,
        messageText,
        modelImages,
        displayImages,
        history: toChatHistory(historyMessages),
        pendingTask,
    };
}

async function handlePendingTask(
    input: AiChatTurnInput,
    turn: PreparedTurn,
    emitChunk?: (content: string) => void
): Promise<AiChatTurnResult | null> {
    if (!turn.pendingTask) return null;

    const lowerMessage = turn.messageText.toLowerCase();

    if (CONFIRM_WORDS.has(lowerMessage)) {
        const task = await createConfirmedTask(input.userId, input.timezone, turn.pendingTask);
        const reply = buildTaskCreatedReply(turn.pendingTask);
        await saveDirectMessage(turn.conversationId, AI_ASSISTANT_ID, turn.userObjectId, reply);
        emitChunk?.(reply);

        return {
            conversationId: turn.conversationId.toString(),
            conversationName: turn.conversationName,
            reply,
            taskCreated: true,
            task: {
                _id: task._id,
                taskName: task.taskName,
                pushTime: task.pushTime,
                enabled: task.enabled,
            },
        };
    }

    if (CANCEL_WORDS.has(lowerMessage)) {
        await clearPendingTask(input.userId);
        const reply = '好的，已取消创建定时任务。有其他需要帮助的吗？';
        await saveDirectMessage(turn.conversationId, AI_ASSISTANT_ID, turn.userObjectId, reply);
        emitChunk?.(reply);

        return {
            conversationId: turn.conversationId.toString(),
            conversationName: turn.conversationName,
            reply,
            taskCreated: false,
        };
    }

    await clearPendingTask(input.userId);
    return null;
}

async function handleTaskIntent(
    input: AiChatTurnInput,
    turn: PreparedTurn,
    emitChunk?: (content: string) => void
): Promise<AiChatTurnResult | null> {
    if (!mightBeTaskCreation(turn.messageText)) return null;

    const parseResult = await aiService.parseTaskIntent(turn.messageText, input.userId);
    if (!parseResult.isTaskCreation || !parseResult.task) return null;

    await setPendingTask(input.userId, parseResult.task);
    const reply = buildTaskConfirmReply(parseResult.task);
    await saveDirectMessage(turn.conversationId, AI_ASSISTANT_ID, turn.userObjectId, reply);
    emitChunk?.(reply);

    return {
        conversationId: turn.conversationId.toString(),
        conversationName: turn.conversationName,
        reply,
        pendingTask: true,
        taskPreview: parseResult.task,
    };
}

function buildUserInput(turn: PreparedTurn): UserMessageInput {
    return {
        text: turn.messageText || '请分析这张图片。',
        images: turn.modelImages,
    };
}

export async function runAiChatTurn(input: AiChatTurnInput): Promise<AiChatTurnResult> {
    const turn = await prepareTurn(input);
    const pendingResult = await handlePendingTask(input, turn);
    if (pendingResult) return pendingResult;

    const taskIntentResult = await handleTaskIntent(input, turn);
    if (taskIntentResult) return taskIntentResult;

    const agentResult = await runAgent(turn.history, buildUserInput(turn), {
        userId: input.userId,
        toolPolicy: AI_DIRECT_TOOL_POLICY,
    });
    const reply = agentResult.content || '（无回复）';
    await saveDirectMessage(turn.conversationId, AI_ASSISTANT_ID, turn.userObjectId, reply);

    autoTitleConversation(turn.conversationId.toString(), input.userId, turn.messageText, reply)
        .catch(err => console.error('Auto-title failed:', err));

    return {
        conversationId: turn.conversationId.toString(),
        conversationName: turn.conversationName,
        reply,
        taskCreated: false,
        sources: agentResult.sources,
    };
}

export async function streamAiChatTurn(
    input: AiChatTurnInput,
    emit: (event: AiChatStreamEvent) => void
): Promise<void> {
    emit({ type: 'status', stage: 'preparing', message: '正在准备对话...' });
    const turn = await prepareTurn(input);

    emit({
        type: 'ready',
        conversationId: turn.conversationId.toString(),
        conversationName: turn.conversationName,
    });

    const pendingResult = await handlePendingTask(input, turn, (content) => emit({ type: 'chunk', content }));
    if (pendingResult) {
        emit({
            type: 'done',
            conversationId: pendingResult.conversationId,
            taskCreated: pendingResult.taskCreated,
            task: pendingResult.task,
        });
        return;
    }

    const taskIntentResult = await handleTaskIntent(input, turn, (content) => emit({ type: 'chunk', content }));
    if (taskIntentResult) {
        emit({
            type: 'done',
            conversationId: taskIntentResult.conversationId,
            pendingTask: true,
            taskPreview: taskIntentResult.taskPreview,
        });
        return;
    }

    let fullContent = '';
    let finished = false;

    await runAgentStream(turn.history, buildUserInput(turn), {
        userId: input.userId,
        toolPolicy: AI_DIRECT_TOOL_POLICY,
        onStatus: (status) => {
            emit({ type: 'status', ...status });
        },
        onChunk: (chunk) => {
            if (finished) return;
            fullContent += chunk;
            emit({ type: 'chunk', content: chunk });
        },
        onDone: async (sources) => {
            if (finished) return;
            finished = true;
            const reply = fullContent || '（无回复）';
            await saveDirectMessage(turn.conversationId, AI_ASSISTANT_ID, turn.userObjectId, reply);
            autoTitleConversation(turn.conversationId.toString(), input.userId, turn.messageText, reply)
                .catch(err => console.error('Auto-title failed:', err));

            emit({
                type: 'done',
                conversationId: turn.conversationId.toString(),
                sources: sources || [],
            });
        },
        onError: (err) => {
            if (finished) return;
            finished = true;
            emit({ type: 'error', message: err });
        },
    });
}
