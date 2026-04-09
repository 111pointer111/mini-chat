import OpenAI from 'openai';
import AIProvider, { IAIProvider } from '../models/AIProvider';
import User from '../models/User';

// 支持的 AI 提供商配置
interface AIConfig {
    baseURL: string;
    apiKey: string;
    model: string;
}

// 获取用户的 AI 配置
const getUserAIConfig = async (userId?: string): Promise<AIConfig> => {
    // 如果有 userId，尝试获取用户选择的 provider
    if (userId) {
        const user = await User.findById(userId).populate('selectedAIProvider');
        if (user?.selectedAIProvider) {
            const provider = user.selectedAIProvider as unknown as IAIProvider;
            if (provider.enabled) {
                return {
                    baseURL: provider.baseURL,
                    apiKey: provider.apiKey,
                    model: provider.modelName,
                };
            }
        }
    }

    // 尝试获取默认 provider
    const defaultProvider = await AIProvider.findOne({ isDefault: true, enabled: true });
    if (defaultProvider) {
        return {
            baseURL: defaultProvider.baseURL,
            apiKey: defaultProvider.apiKey,
            model: defaultProvider.modelName,
        };
    }

    // 回退到环境变量配置
    const baseURL = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!baseURL || !apiKey || !model) {
        throw new Error('No AI provider configured. Please add an AI provider or set AI_BASE_URL, AI_API_KEY, and AI_MODEL environment variables.');
    }

    return { baseURL, apiKey, model };
};

// 创建 OpenAI 兼容客户端
const getClient = (config: AIConfig) => {
    return new OpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
    });
};

// 通用内容生成
export const generateContent = async (prompt: string, systemInstruction?: string, userId?: string): Promise<string> => {
    const config = await getUserAIConfig(userId);
    const client = getClient(config);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await client.chat.completions.create({
        model: config.model,
        messages,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No response content from AI');
    }

    return content;
};

// GitHub 热门项目推荐
export const generateGitHubTrending = async (excludeList: string[] = [], userId?: string): Promise<string> => {
    const systemInstruction = `你是一位资深的技术资讯分析师，专注于开源社区动态和技术趋势。
你的任务是为开发者提供有价值的 GitHub 热门项目推荐，帮助他们发现值得关注的开源项目。
请用专业但易懂的语言，突出项目的技术亮点和实用价值。`;

    const excludeText = excludeList.length > 0
        ? `\n\n注意：以下项目最近已推荐过，请避免重复：\n- ${excludeList.join('\n- ')}`
        : '';

    const prompt = `请分析今天 GitHub 上的热门开源项目趋势，推荐 3-5 个值得关注的项目。

要求：
1. 包含项目名称、简要描述、Star 数量（可估算）
2. 说明为什么值得关注（技术亮点、应用场景）
3. 用中文回复
4. 格式清晰，使用 Markdown${excludeText}`;

    return generateContent(prompt, systemInstruction, userId);
};

// 每日诗词推荐
export const generateDailyPoem = async (excludeList: string[] = [], userId?: string): Promise<string> => {
    const systemInstruction = `你是一位学识渊博的古典文学教授，精通中国古诗词鉴赏。
你热爱诗词之美，善于用通俗易懂的语言解读诗词的意境和情感。
你的目标是让读者感受到诗词的魅力，激发他们对传统文化的兴趣。`;

    const excludeText = excludeList.length > 0
        ? `\n\n注意：以下诗词最近已推荐过，请选择不同的作品：\n- ${excludeList.join('\n- ')}`
        : '';

    const prompt = `请推荐一首优美的中国古诗词。

要求：
1. 包含诗词全文、作者、朝代
2. 简要赏析（100-150字），解读诗词的意境和情感
3. 解释难懂的字词
4. 格式清晰，使用 Markdown${excludeText}`;

    return generateContent(prompt, systemInstruction, userId);
};

// 每日英语推荐
export const generateDailyEnglish = async (excludeList: string[] = [], userId?: string): Promise<string> => {
    const systemInstruction = `你是一位经验丰富的英语教师，专注于英语学习和语言文化。
你善于挑选富有哲理和美感的英文句子，并用清晰的方式解析其语法和用法。
你的目标是帮助学习者在欣赏美句的同时提升英语水平。`;

    const excludeText = excludeList.length > 0
        ? `\n\n注意：以下句子最近已推荐过，请选择不同的内容：\n- ${excludeList.join('\n- ')}`
        : '';

    const prompt = `请推荐一句优美的英文名言或好句。

要求：
1. 英文原文
2. 中文翻译
3. 出处（作者/来源）
4. 简要解析（50-100字），说明句子的含义和应用场景
5. 列出 2-3 个重点词汇及其用法
6. 格式清晰，使用 Markdown${excludeText}`;

    return generateContent(prompt, systemInstruction, userId);
};

// 带历史记录的聊天（流式）
export const chatWithHistoryStream = async function* (
    history: ChatMessage[],
    newMessage: string,
    userId?: string,
    systemPrompt?: string
): AsyncGenerator<string, string, void> {
    const config = await getUserAIConfig(userId);
    const client = getClient(config);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    const defaultSystemPrompt = `你是一个友好、专业的 AI 助手。你可以帮助用户：
1. 回答各种问题
2. 创建定时推送任务（当用户说"每天XX点推送/提醒我..."时）
3. 进行日常对话

请用中文回复，保持友好和专业。`;

    messages.push({ role: 'system', content: systemPrompt || defaultSystemPrompt });

    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: newMessage });

    const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
            fullContent += content;
            yield content;
        }
    }

    return fullContent;
};

// 普通聊天
export const chat = async (message: string, systemPrompt?: string): Promise<string> => {
    return generateContent(message, systemPrompt);
};

// 带历史记录的聊天
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const chatWithHistory = async (
    history: ChatMessage[],
    newMessage: string,
    userId?: string,
    systemPrompt?: string
): Promise<string> => {
    const config = await getUserAIConfig(userId);
    const client = getClient(config);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    // 添加系统提示
    const defaultSystemPrompt = `你是一个友好、专业的 AI 助手。你可以帮助用户：
1. 回答各种问题
2. 创建定时推送任务（当用户说"每天XX点推送/提醒我..."时）
3. 进行日常对话

请用中文回复，保持友好和专业。`;

    messages.push({ role: 'system', content: systemPrompt || defaultSystemPrompt });

    // 添加历史消息
    for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
    }

    // 添加新消息
    messages.push({ role: 'user', content: newMessage });

    const response = await client.chat.completions.create({
        model: config.model,
        messages,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error('No response content from AI');
    }

    return content;
};

// 自定义任务内容生成
export const generateCustomContent = async (userPrompt: string, excludeList: string[] = [], userId?: string): Promise<string> => {
    const systemInstruction = `你是一个智能助手，负责根据用户的定时任务需求生成相关内容。
请根据用户的提示词要求，生成高质量、有价值的信息内容。

重要限制：
- 只使用纯文本和 Markdown 格式
- 禁止使用任何 HTML 标签
- 禁止插入图片、视频、音频等媒体内容
- 禁止使用 iframe、img、video、audio 等标签
- 用精美的文字和排版来呈现内容`;

    const excludeText = excludeList.length > 0
        ? `\n\n注意：以下内容最近已推送过，请避免重复：\n- ${excludeList.join('\n- ')}`
        : '';

    const prompt = `${userPrompt}

要求：
1. 内容要有价值、实用
2. 格式清晰，使用纯 Markdown（不要用 HTML）
3. 用中文回复
4. 排版优美，善用标题、列表、引用等格式${excludeText}`;

    return generateContent(prompt, systemInstruction, userId);
};

// 解析用户创建任务的意图
export const parseTaskIntent = async (message: string, userId?: string): Promise<{
    isTaskCreation: boolean;
    task?: {
        taskName: string;
        pushTime: string;
        prompt: string;
        summary: string;
    };
    reply?: string;
}> => {
    const systemInstruction = `你是一个任务解析助手。判断用户是否想创建定时推送任务。

定时任务的关键词包括：创建定时任务、设置定时推送、每天XX点提醒我、定时发送、定时推送等。

如果用户想创建定时任务，请：
1. 提取任务名称（简短描述）
2. 提取推送时间（HH:mm格式，如果用户没说就用 09:00）
3. 生成优化后的提示词（详细、专业，能让AI每次生成高质量内容）
4. 生成一句话总结

返回 JSON 格式（不要包含 markdown 代码块）：
{"isTaskCreation": true, "task": {"taskName": "名称", "pushTime": "HH:mm", "prompt": "优化后的完整提示词", "summary": "一句话描述"}}

如果用户不是想创建定时任务，返回：
{"isTaskCreation": false, "reply": "正常的聊天回复"}`;

    const response = await generateContent(message, systemInstruction, userId);

    try {
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }
        const parsed = JSON.parse(jsonStr);

        // Validate structure
        if (typeof parsed.isTaskCreation !== 'boolean') {
            throw new Error('Invalid JSON structure: isTaskCreation must be boolean');
        }

        return parsed;
    } catch (err) {
        console.error('Failed to parse AI intent response as JSON:', err, 'Raw response:', response.substring(0, 200));
        return { isTaskCreation: false, reply: response };
    }
};

export default {
    generateContent,
    generateGitHubTrending,
    generateDailyPoem,
    generateDailyEnglish,
    chat,
    chatWithHistory,
    chatWithHistoryStream,
    generateCustomContent,
    parseTaskIntent,
};
