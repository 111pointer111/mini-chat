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
    title: string;
    source: 'local' | 'url';
    fileType?: string;
    filePath?: string;
    url?: string;
}): Promise<number> {
    const { userId, title, source, fileType, filePath, url } = params;
    const result = await pool.query<{ id: number }>(
        `INSERT INTO kb_documents (user_id, title, source, file_type, file_path, url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, title, source, fileType || null, filePath || null, url || null]
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
    options: { page?: number; pageSize?: number } = {}
): Promise<{ documents: KBDocument[]; total: number }> {
    const { page = 1, pageSize = 20 } = options;
    const offset = (page - 1) * pageSize;

    const [docsResult, countResult] = await Promise.all([
        pool.query<KBDocument>(
            `SELECT * FROM kb_documents WHERE user_id = $1
             ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [userId, pageSize, offset]
        ),
        pool.query<{ count: string }>(
            `SELECT COUNT(*) FROM kb_documents WHERE user_id = $1`,
            [userId]
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
            `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::vector, $${idx++})`
        );
        values.push(
            chunk.documentId,
            chunk.userId,
            chunk.chunkIndex,
            chunk.content,
            `[${chunk.embedding.join(',')}]`,
            JSON.stringify(chunk.metadata || {})
        );
    }

    await pool.query(
        `INSERT INTO kb_chunks (document_id, user_id, chunk_index, content, embedding, metadata)
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
    topK = 5
): Promise<SearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const result = await pool.query<SearchResult & { similarity: number }>(
        `SELECT id, document_id, user_id, chunk_index, content, metadata, created_at,
                (embedding <=> $1::vector) AS similarity
         FROM kb_chunks
         WHERE user_id = $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [embeddingStr, userId, topK]
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
    topK = 10
): Promise<KBChunk[]> {
    const result = await pool.query<KBChunk>(
        `SELECT * FROM kb_chunks
         WHERE user_id = $1 AND content ILIKE $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, `%${keyword}%`, topK]
    );
    return result.rows;
}

// ==================== 连接池管理 ====================

export async function closePool(): Promise<void> {
    await pool.end();
}
