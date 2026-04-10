/**
 * Agent 服务
 * 管理工具注册表，执行 ReAct 循环
 * 策略：先非流式跑通工具调用，再流式输出最终回复
 */

import { getWeather, weatherToolDefinition } from './getWeather';
import { ChatMessage, getUserAIConfig, getClient } from './aiService';
import OpenAI from 'openai';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
}

const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `你是一个友好、专业的 AI 助手。你可以帮助用户：
1. 回答各种问题
2. 查询天气（当用户询问天气时，必须使用 get_weather 工具获取真实数据，不要编造天气信息）
3. 创建定时推送任务（当用户说"每天XX点推送/提醒我..."时）
4. 进行日常对话

请用中文回复，保持友好和专业。
重要提醒：当用户询问任何地点的天气时，必须调用 get_weather 工具获取实时数据。
重要提醒：工具调用后会返回结果，请根据结果如实回答用户，不要添加虚假信息。`;

/**
 * 运行 Agent
 * 返回最终回复内容（不含工具调用过程）
 */
export async function runAgent(
    history: ChatMessage[],
    newMessage: string,
    options: RunAgentOptions = {}
): Promise<string> {
    const { userId } = options;
    const config = await getUserAIConfig(userId);
    const client = getClient(config);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
    ];

    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: newMessage });

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
    newMessage: string,
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

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
        ];

        for (const msg of history) {
            messages.push({ role: msg.role, content: msg.content });
        }

        messages.push({ role: 'user', content: newMessage });

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
