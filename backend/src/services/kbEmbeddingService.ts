/**
 * 知识库 Embedding 和向量检索服务
 * 负责：生成向量、存入数据库、向量搜索
 *
 * 注意：不使用 langchain 的 OpenAIEmbeddings，
 * 因为不同 provider（Minimax 等）的 embedding 接口可能有差异，
 * 直接发 HTTP 请求更灵活可控。
 */
import { getUserAIConfig } from './aiService';
import { insertChunks, vectorSearch, type SearchResult } from '../utils/kbDb';
import type { TextChunk } from './kbFileService';

/**
 * 调用 Embedding 接口生成向量
 * 兼容所有 OpenAI-compatible API（包括 Minimax）
 */
async function generateEmbedding(text: string, userId: string): Promise<number[]> {
    const config = await getUserAIConfig(userId);

    // Embedding 接口地址
    let url: string;
    if (config.embeddingBaseURL) {
        url = config.embeddingBaseURL.endsWith('/embeddings')
            ? config.embeddingBaseURL
            : `${config.embeddingBaseURL}/embeddings`;
    } else if (config.baseURL) {
        // 从 baseURL 推断 embedding 地址（去掉末尾的 /chat/completions 等）
        const base = config.baseURL.replace(/\/(chat\/completions|v1\/chat.*)$/i, '');
        url = `${base}/embeddings`;
    } else {
        throw new Error('Embedding 接口地址未配置');
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
    };

    const model = config.embeddingModel || 'text-embedding-ada-002';

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, input: text }),
        signal: AbortSignal.timeout(30000), // 30秒超时
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Embedding API 请求失败 (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
        embedding?: number[];
    };

    // 兼容不同返回格式
    const embedding = data.data?.[0]?.embedding || data.embedding;

    if (!embedding || !Array.isArray(embedding)) {
        throw new Error(`Embedding API 返回格式异常: ${JSON.stringify(data)}`);
    }

    return embedding;
}

/**
 * 将文档的分块批量生成向量并存入数据库
 */
export async function processAndStoreChunks(
    documentId: number,
    userId: string,
    chunks: TextChunk[],
    metadata: {
        fileName?: string;
        url?: string;
        source: string;
    }
): Promise<void> {
    console.log(`🔢 开始生成 ${chunks.length} 个 chunk 的向量...`);

    // 逐个生成向量（避免 API 并发限制导致限流）
    const chunksWithEmbedding = await Promise.all(
        chunks.map(async (chunk) => {
            const embedding = await generateEmbedding(chunk.content, userId);
            return {
                documentId,
                userId,
                chunkIndex: chunk.index,
                content: chunk.content,
                embedding,
                metadata,
            };
        })
    );

    console.log(`💾 存入数据库...`);
    await insertChunks(chunksWithEmbedding);
    console.log(`✅ 完成！共 ${chunks.length} 个 chunk 已存储`);
}

/**
 * RAG 搜索：给定用户问题，检索最相关的文档块
 */
export async function retrieveRelevantChunks(
    query: string,
    userId: string,
    topK = 5
): Promise<SearchResult[]> {
    // 1. 把问题本身变成向量
    const queryEmbedding = await generateEmbedding(query, userId);

    // 2. 向量搜索，找到最相似的 chunk
    const results = await vectorSearch(queryEmbedding, userId, topK);

    return results;
}
