/**
 * 知识库核心业务服务
 * 编排：上传 → 提取文本 → 分块 → 生成向量 → RAG 对话
 */
import path from 'path';
import fs from 'fs';
import {
    createDocument,
    clearDocumentExistsCache,
    updateDocumentStatus,
    type KBDocument,
} from '../utils/kbDb';
import {
    extractText,
    chunkText,
    type TextChunk,
} from './kbFileService';
import {
    processAndStoreChunks,
    retrieveRelevantChunks,
    buildSourcesFromChunks,
    type Source,
} from './kbEmbeddingService';
import { getUserAIConfig } from './aiService';
import OpenAI from 'openai';

function clearScopeDocumentCache(userId: string, scope: { type?: 'user' | 'group'; id?: string } = {}) {
    clearDocumentExistsCache(scope.type || 'user', scope.id || userId);
}

/**
 * 处理本地文件上传
 * 完整流程：存文件 → 提取文本 → 分块 → 生成向量 → 更新文档状态
 */
export async function processUploadedFile(
    userId: string,
    file: Express.Multer.File,
    title?: string,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<KBDocument> {
    const docTitle = title || file.originalname;
    const fileType = path.extname(file.originalname).replace('.', '').toLowerCase();

    // 1. 创建文档记录（状态：处理中）
    const docId = await createDocument({
        userId,
        scopeType: scope.type || 'user',
        scopeId: scope.id || userId,
        title: docTitle,
        source: 'local',
        fileType,
        filePath: file.path,
    });

    try {
        // 2. 提取纯文本
        const { text } = await extractText('local', file.path, file.mimetype);
        console.log(`📄 提取文本 ${text.length} 字符`);

        // 3. 分块
        const chunks: TextChunk[] = await chunkText(text);
        console.log(`✂️ 切成 ${chunks.length} 个块`);

        // 4. 生成向量 + 存入数据库
        await processAndStoreChunks(docId, userId, chunks, {
            fileName: file.originalname,
            source: 'local',
        }, scope);

        // 5. 更新文档状态为"就绪"
        await updateDocumentStatus(docId, userId, 'ready', chunks.length);
        clearScopeDocumentCache(userId, scope);

        // 6. 返回更新后的文档
        const doc = await import('../utils/kbDb').then(m => m.getDocument(docId, userId));
        return doc!;
    } catch (err) {
        // 处理失败，更新状态
        const errorMsg = err instanceof Error ? err.message : '处理失败';
        await updateDocumentStatus(docId, userId, 'failed', undefined, errorMsg);
        clearScopeDocumentCache(userId, scope);
        throw err;
    }
}

/**
 * 处理 URL 导入
 */
export async function processUrlImport(
    userId: string,
    url: string,
    title?: string,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<KBDocument> {
    // 从 URL 中提取域名作为默认标题
    const defaultTitle = title || new URL(url).hostname;

    // 1. 创建文档记录
    const docId = await createDocument({
        userId,
        scopeType: scope.type || 'user',
        scopeId: scope.id || userId,
        title: defaultTitle,
        source: 'url',
        url,
    });

    try {
        // 2. 抓取网页文本
        const { text } = await extractText('url', url, 'text/html');
        console.log(`🌐 抓取文本 ${text.length} 字符`);

        // 3. 分块
        const chunks: TextChunk[] = await chunkText(text);
        console.log(`✂️ 切成 ${chunks.length} 个块`);

        // 4. 生成向量 + 存入数据库
        await processAndStoreChunks(docId, userId, chunks, {
            url,
            source: 'url',
        }, scope);

        // 5. 更新文档状态
        await updateDocumentStatus(docId, userId, 'ready', chunks.length);
        clearScopeDocumentCache(userId, scope);

        const doc = await import('../utils/kbDb').then(m => m.getDocument(docId, userId));
        return doc!;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '处理失败';
        await updateDocumentStatus(docId, userId, 'failed', undefined, errorMsg);
        clearScopeDocumentCache(userId, scope);
        throw err;
    }
}

/**
 * RAG 对话：用知识库增强 AI 回答
 */
export async function chatWithKnowledge(
    userId: string,
    query: string,
    history: Array<{ role: string; content: string }> = [],
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<{ answer: string; sources: Source[] }> {
    // 1. 向量搜索，找到最相关的文档块
    const relevantChunks = await retrieveRelevantChunks(query, userId, 5, scope);

    let context = '';
    const sources: Source[] = [];

    if (relevantChunks.length > 0) {
        // 构建引用数据
        sources.push(...buildSourcesFromChunks(relevantChunks));

        // 把检索到的块拼接成上下文
        context = relevantChunks
            .map((chunk, i) => `[来源 ${i + 1}] ${chunk.content}`)
            .join('\n\n');
    }

    // 2. 获取用户配置的 AI
    const config = await getUserAIConfig(userId);

    const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
    });

    // 3. 构建 prompt
    const systemPrompt = context
        ? `你是用户的知识库助手。以下是从用户知识库中检索到的相关文档片段：\n\n${context}\n\n请基于以上文档片段回答用户的问题。如果文档中有相关内容，尽量引用原文。如果找不到相关信息，诚实地告诉用户知识库中没有相关内容，不要编造答案。`
        : `你是一个知识库助手。知识库中暂无相关文档，请直接回答用户的问题。`;

    // 4. 调用 AI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: query },
    ];

    const response = await client.chat.completions.create({
        model: config.model,
        messages,
        temperature: 0.3,
    });

    const answer = response.choices[0]?.message?.content || '';

    return { answer, sources };
}

