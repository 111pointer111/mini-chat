/**
 * 知识库数据库工具
 * 封装对 PostgreSQL（kb_documents、kb_chunks 表）的所有查询操作
 */
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'minichat',
});

// ==================== 文档元数据（kb_documents）====================

export interface KBDocument {
    id: number;
    user_id: string;
    scope_type: 'user' | 'group';
    scope_id: string;
    title: string;
    source: 'local' | 'url';
    file_type: string | null;
    file_path: string | null;
    url: string | null;
    chunk_count: number;
    status: 'processing' | 'ready' | 'failed';
    error_msg: string | null;
    created_at: Date;
    updated_at: Date;
}

export async function createDocument(params: {
    userId: string;
    scopeType?: 'user' | 'group';
    scopeId?: string;
    title: string;
    source: 'local' | 'url';
    fileType?: string;
    filePath?: string;
    url?: string;
}): Promise<number> {
    const { userId, scopeType = 'user', scopeId = userId, title, source, fileType, filePath, url } = params;
    const result = await pool.query<{ id: number }>(
        `INSERT INTO kb_documents (user_id, scope_type, scope_id, title, source, file_type, file_path, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [userId, scopeType, scopeId, title, source, fileType || null, filePath || null, url || null]
    );
    return result.rows[0].id;
}

export async function getDocument(id: number, userId: string): Promise<KBDocument | null> {
    const result = await pool.query<KBDocument>(
        `SELECT * FROM kb_documents WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
    return result.rows[0] || null;
}

export async function listDocuments(
    userId: string,
    options: { page?: number; pageSize?: number; scopeType?: 'user' | 'group'; scopeId?: string } = {}
): Promise<{ documents: KBDocument[]; total: number }> {
    const { page = 1, pageSize = 20, scopeType = 'user', scopeId = userId } = options;
    const offset = (page - 1) * pageSize;

    const listWhere = scopeType === 'group'
        ? `scope_type = $1 AND scope_id = $2`
        : `user_id = $3 AND scope_type = $1 AND scope_id = $2`;

    const [docsResult, countResult] = await Promise.all([
        pool.query<KBDocument>(
            `SELECT * FROM kb_documents WHERE ${listWhere}
             ORDER BY created_at DESC LIMIT $4 OFFSET $5`,
            [scopeType, scopeId, userId, pageSize, offset]
        ),
        pool.query<{ count: string }>(
            `SELECT COUNT(*) FROM kb_documents WHERE ${listWhere}`,
            [scopeType, scopeId, userId]
        ),
    ]);

    return {
        documents: docsResult.rows,
        total: parseInt(countResult.rows[0].count),
    };
}

export async function updateDocumentStatus(
    id: number,
    userId: string,
    status: 'processing' | 'ready' | 'failed',
    chunkCount?: number,
    errorMsg?: string
): Promise<void> {
    await pool.query(
        `UPDATE kb_documents
         SET status = $1, chunk_count = COALESCE($2, chunk_count),
             error_msg = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5`,
        [status, chunkCount, errorMsg || null, id, userId]
    );
}

export async function deleteDocument(id: number, userId: string): Promise<boolean> {
    // ON DELETE CASCADE 会自动删除关联的 chunks
    const result = await pool.query(
        `DELETE FROM kb_documents WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
}

export async function deleteDocumentInScope(
    id: number,
    scopeType: 'user' | 'group',
    scopeId: string
): Promise<boolean> {
    const result = await pool.query(
        `DELETE FROM kb_documents WHERE id = $1 AND scope_type = $2 AND scope_id = $3`,
        [id, scopeType, scopeId]
    );
    return (result.rowCount ?? 0) > 0;
}

export async function searchDocuments(userId: string, keyword: string): Promise<KBDocument[]> {
    const result = await pool.query<KBDocument>(
        `SELECT * FROM kb_documents
         WHERE user_id = $1 AND (
             title ILIKE $2 OR
             COALESCE(error_msg, '') ILIKE $2
         )
         ORDER BY created_at DESC`,
        [userId, `%${keyword}%`]
    );
    return result.rows;
}

// ==================== 分块 + 向量（kb_chunks）====================

export interface KBChunk {
    id: number;
    document_id: number;
    user_id: string;
    chunk_index: number;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
    created_at: Date;
}

export interface SearchResult extends KBChunk {
    similarity: number; // 余弦相似度分数
}

export async function insertChunks(chunks: Array<{
    documentId: number;
    userId: string;
    scopeType?: 'user' | 'group';
    scopeId?: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
}>): Promise<void> {
    if (chunks.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const chunk of chunks) {
        placeholders.push(
            `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::vector, $${idx++})`
        );
        values.push(
            chunk.documentId,
            chunk.userId,
            chunk.scopeType || 'user',
            chunk.scopeId || chunk.userId,
            chunk.chunkIndex,
            chunk.content,
            `[${chunk.embedding.join(',')}]`,
            JSON.stringify(chunk.metadata || {})
        );
    }

    await pool.query(
        `INSERT INTO kb_chunks (document_id, user_id, scope_type, scope_id, chunk_index, content, embedding, metadata)
         VALUES ${placeholders.join(', ')}`,
        values
    );
}

/**
 * 向量搜索：给定查询向量，找出最相似的 N 个 chunk
 * @param queryEmbedding 1536 维向量
 * @param userId 用户 ID（只搜索该用户的 chunk）
 * @param topK 返回多少个结果
 */
export async function vectorSearch(
    queryEmbedding: number[],
    userId: string,
    topK = 5,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<SearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const scopeType = scope.type || 'user';
    const scopeId = scope.id || userId;
    const result = await pool.query<SearchResult & { similarity: number }>(
        `SELECT id, document_id, user_id, chunk_index, content, metadata, created_at,
                (embedding <=> $1::vector) AS similarity
         FROM kb_chunks
         WHERE scope_type = $2 AND scope_id = $3
         ORDER BY embedding <=> $1::vector
         LIMIT $4`,
        [embeddingStr, scopeType, scopeId, topK]
    );
    return result.rows;
}

/**
 * 删除某个文档关联的所有 chunk
 */
export async function deleteChunksByDocument(documentId: number): Promise<void> {
    await pool.query(`DELETE FROM kb_chunks WHERE document_id = $1`, [documentId]);
}

/**
 * 获取某个文档的所有 chunk
 */
export async function getChunksByDocument(
    documentId: number,
    userId: string
): Promise<KBChunk[]> {
    const result = await pool.query<KBChunk>(
        `SELECT * FROM kb_chunks
         WHERE document_id = $1 AND user_id = $2
         ORDER BY chunk_index`,
        [documentId, userId]
    );
    return result.rows;
}

/**
 * 关键词全文搜索（不依赖向量）
 */
export async function textSearch(
    userId: string,
    keyword: string,
    topK = 10,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<KBChunk[]> {
    const scopeType = scope.type || 'user';
    const scopeId = scope.id || userId;
    const result = await pool.query<KBChunk>(
        `SELECT * FROM kb_chunks
         WHERE scope_type = $1 AND scope_id = $2 AND content ILIKE $3
         ORDER BY created_at DESC
         LIMIT $4`,
        [scopeType, scopeId, `%${keyword}%`, topK]
    );
    return result.rows;
}

// ==================== 连接池管理 ====================

export async function closePool(): Promise<void> {
    await pool.end();
}

// ==================== 缓存优化 ====================

/**
 * 检查用户是否有知识库文档（用于优化 RAG 流程）
 * 避免对没有文档的用户执行向量搜索
 */
export async function userHasDocuments(
    userId: string,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<boolean> {
    const scopeType = scope.type || 'user';
    const scopeId = scope.id || userId;

    const result = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS(
            SELECT 1 FROM kb_documents
            WHERE scope_type = $1 AND scope_id = $2 AND status = 'ready'
        ) AS exists`,
        [scopeType, scopeId]
    );

    return result.rows[0]?.exists ?? false;
}

// 文档存在性缓存（避免频繁查询）
const documentExistsCache = new Map<string, { exists: boolean; expiresAt: number }>();
const DOC_EXISTS_CACHE_TTL = 60 * 1000; // 1 分钟

/**
 * 带缓存的文档存在性检查
 */
export async function userHasDocumentsCached(
    userId: string,
    scope: { type?: 'user' | 'group'; id?: string } = {}
): Promise<boolean> {
    const scopeType = scope.type || 'user';
    const scopeId = scope.id || userId;
    const cacheKey = `${scopeType}:${scopeId}`;

    const cached = documentExistsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.exists;
    }

    const exists = await userHasDocuments(userId, scope);
    documentExistsCache.set(cacheKey, { exists, expiresAt: Date.now() + DOC_EXISTS_CACHE_TTL });

    return exists;
}

/**
 * 清除文档存在性缓存
 */
export function clearDocumentExistsCache(scopeType?: string, scopeId?: string): void {
    if (scopeType && scopeId) {
        const cacheKey = `${scopeType}:${scopeId}`;
        documentExistsCache.delete(cacheKey);
    } else {
        documentExistsCache.clear();
    }
}
