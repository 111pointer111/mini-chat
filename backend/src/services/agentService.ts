/**
 * Agent 服务
 * 管理工具注册表，执行 ReAct 循环
 * 支持图片消息
 */

import { getWeather, weatherToolDefinition, ToolResult } from './getWeather';
import { createScheduledTask, scheduledTaskToolDefinition } from './createScheduledTaskTool';
import { ChatMessage, getUserAIConfig, getClient } from './aiService';
import { retrieveRelevantChunks, buildSourcesFromChunks, type Source } from './kbEmbeddingService';
import { executeMcpTool, getMcpToolDefinitions } from './mcpService';
import OpenAI from 'openai';

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
    handler: (args: Record<string, unknown>, userId?: string) => Promise<string>;
}

// 工具注册表
const toolRegistry: Record<string, Tool> = {
    get_weather: {
        definition: weatherToolDefinition,
        handler: async (args) => {
            const city = args.city as string;
            const date = args.date as string | undefined;
            const result: ToolResult = await getWeather(city, date);

            // 返回格式化结果给大模型
            if (result.success) {
                return result.data || '查询成功';
            } else {
                // 包含 suggestion，让大模型知道怎么解释
                return `查询失败：${result.error}\n建议：${result.suggestion || '请稍后重试'}`;
            }
        },
    },
    create_scheduled_task: {
        definition: scheduledTaskToolDefinition,
        handler: async (args, userId) => {
            if (!userId) {
                return '错误：需要用户登录才能创建定时任务';
            }

            const taskName = args.taskName as string;
            const prompt = args.prompt as string;
            const pushTime = (args.pushTime as string) || '09:00';
            const timezone = (args.timezone as string) || 'Asia/Shanghai';

            const result = await createScheduledTask(userId, taskName, prompt, pushTime, timezone);

            if (result.success) {
                return result.data || '创建成功';
            } else {
                return `创建失败：${result.error}\n建议：${result.suggestion || '请稍后重试'}`;
            }
        },
    },
};

// 获取工具描述列表
export async function getTools(userId?: string) {
    const localTools = Object.values(toolRegistry).map((t) => t.definition);
    const mcpTools = userId ? await getMcpToolDefinitions(userId) : [];
    return [...localTools, ...mcpTools];
}

// 执行工具
export async function executeTool(name: string, args: Record<string, unknown>, userId?: string): Promise<string> {
    const tool = toolRegistry[name];
    if (tool) {
        try {
            return await tool.handler(args, userId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `工具执行失败: ${msg}`;
        }
    }

    if (name.startsWith('mcp_') && userId) {
        try {
            return await executeMcpTool(userId, name, args);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `MCP 工具执行失败: ${msg}`;
        }
    }

    return `错误：未找到工具 "${name}"`;
}

interface RunAgentOptions {
    userId?: string;
    knowledgeScope?: { type?: 'user' | 'group'; id?: string };
}

const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `你是一个友好、专业的 AI 助手。你可以帮助用户：
1. 回答各种问题，包括图片内容理解和分析
2. 查询天气（当用户询问天气时，必须使用 get_weather 工具获取真实数据，不要编造天气信息）
3. 创建定时推送任务（当用户说"每天XX点推送/提醒我..."时，使用 create_scheduled_task 工具）
4. 进行日常对话

请用中文回复，保持友好和专业。
重要提醒：当用户询问任何地点的天气时，必须调用 get_weather 工具获取实时数据。
重要提醒：当用户要求创建定时任务时，必须调用 create_scheduled_task 工具。
重要提醒：工具调用后会返回结果，请根据结果如实回答用户，不要添加虚假信息。
重要提醒：如果用户发送了图片，请仔细分析图片内容并给出准确的回答。`;

const getMessageText = (message: UserMessageInput | string): string => {
    return typeof message === 'string' ? message : message.text;
};

async function buildSystemPrompt(
    userId: string | undefined,
    query: string,
    knowledgeScope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<{ systemPrompt: string; sources: Source[] }> {
    if (!userId || !query.trim()) {
        return { systemPrompt: SYSTEM_PROMPT, sources: [] };
    }

    try {
        const chunks = await retrieveRelevantChunks(query, userId, 5, knowledgeScope);
        if (chunks.length === 0) {
            return { systemPrompt: SYSTEM_PROMPT, sources: [] };
        }

        const sources = buildSourcesFromChunks(chunks);

        const context = chunks
            .map((chunk, index) => {
                const metadata = typeof chunk.metadata === 'object' && chunk.metadata !== null
                    ? chunk.metadata as Record<string, unknown>
                    : {};
                const source = metadata.fileName || metadata.url || `文档 ${chunk.document_id}`;
                return `[来源 ${index + 1}: ${String(source)}]\n${chunk.content}`;
            })
            .join('\n\n');

        const systemPrompt = `${SYSTEM_PROMPT}

以下是从用户知识库中检索到的相关文档片段。回答时优先参考这些内容；如果片段与问题无关，请忽略片段并正常回答。不要编造知识库中不存在的信息。

${context}`;

        return { systemPrompt, sources };
    } catch (err) {
        console.warn('Knowledge retrieval skipped:', err instanceof Error ? err.message : err);
        return { systemPrompt: SYSTEM_PROMPT, sources: [] };
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
    const { systemPrompt } = await buildSystemPrompt(userId, getMessageText(newMessage), options.knowledgeScope);

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
            tools: await getTools(userId),
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

                const result = await executeTool(toolName, args, userId);

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
 * 流式运行 Agent（全流式 ReAct 循环）
 * 内容实时输出给用户，同时检测 tool_calls 增量拼装
 */
export async function runAgentStream(
    history: ChatMessage[],
    newMessage: UserMessageInput | string,
    options: RunAgentOptions & {
        onChunk?: (chunk: string) => void;
        onDone?: (sources?: Source[]) => void;
        onError?: (err: string) => void;
    } = {}
) {
    const { userId, onChunk, onDone, onError } = options;

    try {
        const config = await getUserAIConfig(userId);
        const client = getClient(config);
        const { systemPrompt, sources } = await buildSystemPrompt(userId, getMessageText(newMessage), options.knowledgeScope);

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

            const stream = await client.chat.completions.create({
                model: config.model,
                messages,
                tools: await getTools(userId),
                stream: true,
            });

            let content = '';
            const toolCalls: { index: number; id: string; type: string; function: { name: string; arguments: string } }[] = [];
            let finishReason: string | null = null;

            for await (const chunk of stream) {
                const choice = chunk.choices[0];
                if (!choice) continue;

                finishReason = choice.finish_reason;

                if (choice.delta?.content) {
                    content += choice.delta.content;
                    if (onChunk) onChunk(choice.delta.content);
                }

                if (choice.delta?.tool_calls) {
                    for (const tc of choice.delta.tool_calls) {
                        const idx = tc.index;
                        if (!toolCalls[idx]) {
                            toolCalls[idx] = { index: idx, id: '', type: 'function', function: { name: '', arguments: '' } };
                        }
                        if (tc.id) toolCalls[idx].id = tc.id;
                        if (tc.type) toolCalls[idx].type = tc.type;
                        if (tc.function) {
                            if (tc.function.name) toolCalls[idx].function.name += tc.function.name;
                            if (tc.function.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                        }
                    }
                }
            }

            const validToolCalls = finishReason === 'tool_calls'
                ? toolCalls.filter(tc => tc.id && tc.function.name)
                : [];

            if (validToolCalls.length > 0) {
                const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
                    role: 'assistant',
                    content: content || null,
                    tool_calls: validToolCalls.map(tc => ({
                        id: tc.id,
                        type: 'function',
                        function: { name: tc.function.name, arguments: tc.function.arguments },
                    })),
                };
                messages.push(assistantMsg);

                for (const tc of validToolCalls) {
                    let args: Record<string, unknown> = {};
                    try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
                    const result = await executeTool(tc.function.name, args, userId);
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: result,
                    });
                }
            } else {
                if (onDone) onDone(sources);
                return;
            }
        }

        if (onError) onError('Agent 执行超时');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (onError) onError(msg);
    }
}
