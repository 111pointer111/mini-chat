/**
 * 向量索引迁移脚本
 * 运行一次即可，为知识库创建 pgvector 索引
 *
 * 用法: npx ts-node src/scripts/createVectorIndex.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'minichat',
});

async function createVectorIndex() {
    const client = await pool.connect();

    try {
        console.log('📦 连接到 PostgreSQL...');

        // 1. 启用 pgvector 扩展
        await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
        console.log('✅ pgvector 扩展已启用');

        // 2. 创建文档元数据表
        await client.query(`
            CREATE TABLE IF NOT EXISTS kb_documents (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                title VARCHAR(500) NOT NULL,
                source VARCHAR(20) NOT NULL,          -- 'local' 或 'url'
                file_type VARCHAR(50),                  -- pdf/docx/pptx/image/url/text
                file_path TEXT,                         -- 本地文件路径
                url TEXT,                                -- URL 来源时填
                chunk_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'processing',  -- processing / ready / failed
                error_msg TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ kb_documents 表已创建');

        // 3. 创建分块表（存文本 + 向量）
        await client.query(`
            CREATE TABLE IF NOT EXISTS kb_chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER REFERENCES kb_documents(id) ON DELETE CASCADE,
                user_id VARCHAR(255) NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding VECTOR(1536),                -- 1536 维向量
                metadata JSONB,                          -- 存储文档名、来源等
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ kb_chunks 表已创建');

        // 4. 创建向量索引（HNSW 索引，向量搜索用）
        await client.query(`
            CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
            ON kb_chunks USING hnsw (embedding vector_cosine_ops);
        `);
        console.log('✅ 向量索引（HNSW）已创建');

        // 5. 创建普通索引（加速按用户查询）
        await client.query(`
            CREATE INDEX IF NOT EXISTS kb_chunks_user_id_idx ON kb_chunks(user_id);
            CREATE INDEX IF NOT EXISTS kb_documents_user_id_idx ON kb_documents(user_id);
        `);
        console.log('✅ 普通索引已创建');

        console.log('');
        console.log('🎉 全部完成！数据库结构:');
        console.log('  kb_documents  — 文档元数据表');
        console.log('  kb_chunks     — 分块 + 向量表（HNSW 索引）');
    } finally {
        client.release();
        await pool.end();
    }
}

createVectorIndex().catch(err => {
    console.error('❌ 失败:', err);
    process.exit(1);
});
