import { GoogleGenAI } from '@google/genai';

const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    return new GoogleGenAI({ apiKey });
};

export const generateContent = async (prompt: string, systemInstruction?: string): Promise<string> => {
    const ai = getAI();
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
    });

    if (!response.text) {
        throw new Error('No response text from AI');
    }

    return response.text;
};

export const generateGitHubTrending = async (excludeList: string[] = []): Promise<string> => {
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

    return generateContent(prompt, systemInstruction);
};

export const generateDailyPoem = async (excludeList: string[] = []): Promise<string> => {
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

    return generateContent(prompt, systemInstruction);
};

export const generateDailyEnglish = async (excludeList: string[] = []): Promise<string> => {
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

    return generateContent(prompt, systemInstruction);
};

export const chat = async (message: string, systemPrompt?: string): Promise<string> => {
    return generateContent(message, systemPrompt);
};

export const generateCustomContent = async (userPrompt: string, excludeList: string[] = []): Promise<string> => {
    const systemInstruction = `你是一个智能助手，负责根据用户的定时任务需求生成相关内容。
请根据用户的提示词要求，生成高质量、有价值的信息内容。
内容应该简洁、实用、格式清晰。`;

    const excludeText = excludeList.length > 0
        ? `\n\n注意：以下内容最近已推送过，请避免重复：\n- ${excludeList.join('\n- ')}`
        : '';

    const prompt = `${userPrompt}

要求：
1. 内容要有价值、实用
2. 格式清晰，使用 Markdown
3. 用中文回复${excludeText}`;

    return generateContent(prompt, systemInstruction);
};

export const parseTaskIntent = async (message: string): Promise<{
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

    const response = await generateContent(message, systemInstruction);
    
    try {
        // 尝试解析 JSON，处理可能的 markdown 代码块
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }
        return JSON.parse(jsonStr);
    } catch {
        // 解析失败，当作普通聊天
        return { isTaskCreation: false, reply: response };
    }
};

export default {
    generateContent,
    generateGitHubTrending,
    generateDailyPoem,
    generateDailyEnglish,
    chat,
    generateCustomContent,
    parseTaskIntent,
};
