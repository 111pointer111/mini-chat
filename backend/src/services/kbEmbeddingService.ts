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

const DEFAULT_EMBEDDING_BATCH_SIZE = 2;

function resolveEmbeddingDimensions(config: Awaited<ReturnType<typeof getUserAIConfig>>): number | undefined {
    if (config.embeddingDimensions && config.embeddingDimensions > 0) {
        return config.embeddingDimensions;
    }

    const embeddingBaseURL = config.embeddingBaseURL || '';
    if (config.embeddingModel === 'text-embedding-v4' && /dashscope\.aliyuncs\.com/i.test(embeddingBaseURL)) {
        return 1536;
    }

    return undefined;
}

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
    const dimensions = resolveEmbeddingDimensions(config);
    const payload: Record<string, unknown> = { model, input: text };
    if (dimensions) {
        payload.dimensions = dimensions;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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

    const batchSize = Math.max(
        1,
        Number.parseInt(process.env.KB_EMBEDDING_BATCH_SIZE || `${DEFAULT_EMBEDDING_BATCH_SIZE}`, 10) || DEFAULT_EMBEDDING_BATCH_SIZE
    );
    const chunksWithEmbedding: Array<{
        documentId: number;
        userId: string;
        chunkIndex: number;
        content: string;
        embedding: number[];
        metadata: {
            fileName?: string;
            url?: string;
            source: string;
        };
    }> = [];

    // 小批量生成向量，降低大文档上传时被 provider 限流的概率
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchWithEmbedding = await Promise.all(
            batch.map(async (chunk) => {
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
        chunksWithEmbedding.push(...batchWithEmbedding);
    }

    console.log(`💾 存入数据库...`);
    try {
        await insertChunks(chunksWithEmbedding);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const embeddingDimension = chunksWithEmbedding[0]?.embedding.length;
        if (/different vector dimensions|expected \d+ dimensions|vector dimensions/i.test(msg)) {
            throw new Error(
                `Embedding 维度与数据库不匹配，当前模型返回 ${embeddingDimension || '未知'} 维向量。请检查 embedding 模型，或重新初始化 kb_chunks 的向量列维度。`
            );
        }
        throw err;
    }
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
