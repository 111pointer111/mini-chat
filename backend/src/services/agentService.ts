/**
 * Agent 服务
 * 管理工具注册表，执行 ReAct 循环
 * 支持图片消息
 */

import { getWeather, weatherToolDefinition } from './getWeather';
import { ChatMessage, getUserAIConfig, getClient } from './aiService';
import { retrieveRelevantChunks } from './kbEmbeddingService';
import OpenAI from 'openai';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 用户消息输入：支持纯文本或文本+多张图片
export interface UserMessageInput {
    text: string;
    images?: string[]; // 图片 URL 列表
}

// 将用户消息转为 OpenAI 消息格式
function buildUserMessage(input: UserMessageInput): OpenAI.Chat.ChatCompletionUserMessageParam {
    if (!input.images || input.images.length === 0) {
        return { role: 'user', content: input.text };
    }

    // 文本 + 图片的消息格式
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [
        { type: 'text', text: input.text },
    ];

    for (const imageUrl of input.images) {
        content.push({
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'auto' },
        });
    }

    return { role: 'user', content };
}

// 将历史消息转为 OpenAI 格式（支持图片）
function buildHistoryMessages(history: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return history.map((msg) => {
        if (msg.role === 'user' && 'images' in msg && Array.isArray(msg.images)) {
            // 带图片的历史消息
            const content: OpenAI.Chat.ChatCompletionContentPart[] = [
                { type: 'text', text: msg.content },
            ];
            for (const imageUrl of msg.images as string[]) {
                content.push({ type: 'image_url', image_url: { url: imageUrl } });
            }
            return { role: 'user' as const, content };
        }
        return { role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam;
    });
}

export interface Tool {
    definition: {
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    };
    handler: (args: Record<string, unknown>) => Promise<string>;
}

// 工具注册表
const toolRegistry: Record<string, Tool> = {
    get_weather: {
        definition: weatherToolDefinition,
        handler: async (args) => {
            const city = args.city as string;
            const date = args.date as string | undefined;
            return await getWeather(city, date);
        },
    },
};

// 获取工具描述列表
export function getTools() {
    return Object.values(toolRegistry).map((t) => t.definition);
}

// 执行工具
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = toolRegistry[name];
    if (!tool) {
        return `错误：未找到工具 "${name}"`;
    }
    try {
        return await tool.handler(args);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `工具执行失败: ${msg}`;
    }
}

interface RunAgentOptions {
    userId?: string;
    knowledgeScope?: { type?: 'user' | 'group'; id?: string };
}

const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `你是一个友好、专业的 AI 助手。你可以帮助用户：
1. 回答各种问题，包括图片内容理解和分析
2. 查询天气（当用户询问天气时，必须使用 get_weather 工具获取真实数据，不要编造天气信息）
3. 创建定时推送任务（当用户说"每天XX点推送/提醒我..."时）
4. 进行日常对话

请用中文回复，保持友好和专业。
重要提醒：当用户询问任何地点的天气时，必须调用 get_weather 工具获取实时数据。
重要提醒：工具调用后会返回结果，请根据结果如实回答用户，不要添加虚假信息。
重要提醒：如果用户发送了图片，请仔细分析图片内容并给出准确的回答。`;

const getMessageText = (message: UserMessageInput | string): string => {
    return typeof message === 'string' ? message : message.text;
};

async function buildSystemPrompt(
    userId: string | undefined,
    query: string,
    knowledgeScope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<string> {
    if (!userId || !query.trim()) {
        return SYSTEM_PROMPT;
    }

    try {
        const chunks = await retrieveRelevantChunks(query, userId, 5, knowledgeScope);
        if (chunks.length === 0) {
            return SYSTEM_PROMPT;
        }

        const context = chunks
            .map((chunk, index) => {
                const metadata = typeof chunk.metadata === 'object' && chunk.metadata !== null
                    ? chunk.metadata as Record<string, unknown>
                    : {};
                const source = metadata.fileName || metadata.url || `文档 ${chunk.document_id}`;
                return `[来源 ${index + 1}: ${String(source)}]\n${chunk.content}`;
            })
            .join('\n\n');

        return `${SYSTEM_PROMPT}

以下是从用户知识库中检索到的相关文档片段。回答时优先参考这些内容；如果片段与问题无关，请忽略片段并正常回答。不要编造知识库中不存在的信息。

${context}`;
    } catch (err) {
        console.warn('Knowledge retrieval skipped:', err instanceof Error ? err.message : err);
        return SYSTEM_PROMPT;
    }
}

/**
 * 运行 Agent
 * 返回最终回复内容（不含工具调用过程）
 */
export async function runAgent(
    history: ChatMessage[],
    newMessage: UserMessageInput | string,
    options: RunAgentOptions = {}
): Promise<string> {
    const { userId } = options;
    const config = await getUserAIConfig(userId);
    const client = getClient(config);
    const systemPrompt = await buildSystemPrompt(userId, getMessageText(newMessage), options.knowledgeScope);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
    ];

    messages.push(...buildHistoryMessages(history));

    // 处理新消息：可能是纯文本或文本+图片
    if (typeof newMessage === 'string') {
        messages.push({ role: 'user', content: newMessage });
    } else {
        messages.push(buildUserMessage(newMessage));
    }

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // 非流式调用，检查是否要调工具
        const response = await client.chat.completions.create({
            model: config.model,
            messages,
            tools: getTools(),
        });

        const message = response.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
            // AI 想调工具 → 把调用加入历史
            messages.push(message as OpenAI.Chat.ChatCompletionMessageParam);

            // 执行每个工具，把结果加入历史
            for (const toolCall of message.tool_calls) {
                // 只处理 function 类型工具调用
                if (toolCall.type !== 'function') continue;
                const fn = toolCall.function;
                const toolName = fn.name;
                let args: Record<string, unknown> = {};
                try {
                    args = JSON.parse(fn.arguments);
                } catch {
                    args = {};
                }

                const result = await executeTool(toolName, args);

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: result,
                });
            }
            // 继续循环，AI 看结果决定下一步
        } else {
            // 不需要工具 → 直接回复
            return message.content || '';
        }
    }

    throw new Error('Agent 执行超时（超过最大迭代次数），请重试');
}

/**
 * 流式运行 Agent
 * 工具调用过程不展示给用户，只流式输出最终回复
 */
export async function runAgentStream(
    history: ChatMessage[],
    newMessage: UserMessageInput | string,
    options: RunAgentOptions & {
        onChunk?: (chunk: string) => void;
        onDone?: () => void;
        onError?: (err: string) => void;
    } = {}
) {
    const { userId, onChunk, onDone, onError } = options;

    try {
        const config = await getUserAIConfig(userId);
        const client = getClient(config);
        const systemPrompt = await buildSystemPrompt(userId, getMessageText(newMessage), options.knowledgeScope);

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
        ];

        messages.push(...buildHistoryMessages(history));

        if (typeof newMessage === 'string') {
            messages.push({ role: 'user', content: newMessage });
        } else {
            messages.push(buildUserMessage(newMessage));
        }

        let iterations = 0;

        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const response = await client.chat.completions.create({
                model: config.model,
                messages,
                tools: getTools(),
            });

            const message = response.choices[0].message;

            if (message.tool_calls && message.tool_calls.length > 0) {
                messages.push(message as OpenAI.Chat.ChatCompletionMessageParam);

                for (const toolCall of message.tool_calls) {
                    if (toolCall.type !== 'function') continue;
                    const fn = toolCall.function;
                    const toolName = fn.name;
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(fn.arguments);
                    } catch {
                        args = {};
                    }

                    const result = await executeTool(toolName, args);

                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result,
                    });
                }
            } else {
                // 最终回复 → 逐字符流式输出（模拟打字效果）
                const finalContent = message.content || '';

                if (finalContent && onChunk) {
                    // 按句子分块，模拟自然流速
                    const sentences = finalContent.split(/(?<=[\.!?。！？\n])/);
                    for (const sentence of sentences) {
                        if (!sentence) continue;
                        // 每3-6个字符推送一次，模拟打字
                        for (let i = 0; i < sentence.length; i += 4) {
                            onChunk(sentence.slice(i, i + 4));
                            await sleep(15);
                        }
                    }
                }

                if (onDone) onDone();
                return;
            }
        }

        if (onError) onError('Agent 执行超时');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (onError) onError(msg);
    }
}
