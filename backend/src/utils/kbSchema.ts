import { Pool } from 'pg';
import 'dotenv/config';

let initialized = false;

function createPool() {
    return new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'minichat',
    });
}

export async function ensureKnowledgeBaseSchema(): Promise<void> {
    if (initialized) {
        return;
    }

    const pool = createPool();
    const client = await pool.connect();

    try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS kb_documents (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                scope_type VARCHAR(20) NOT NULL DEFAULT 'user',
                scope_id VARCHAR(255),
                title VARCHAR(500) NOT NULL,
                source VARCHAR(20) NOT NULL,
                file_type VARCHAR(50),
                file_path TEXT,
                url TEXT,
                chunk_count INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'processing',
                error_msg TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS kb_chunks (
                id SERIAL PRIMARY KEY,
                document_id INTEGER REFERENCES kb_documents(id) ON DELETE CASCADE,
                user_id VARCHAR(255) NOT NULL,
                scope_type VARCHAR(20) NOT NULL DEFAULT 'user',
                scope_id VARCHAR(255),
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding VECTOR(1536),
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            ALTER TABLE kb_documents
            ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'user';
            ALTER TABLE kb_documents
            ADD COLUMN IF NOT EXISTS scope_id VARCHAR(255);
            UPDATE kb_documents SET scope_id = user_id WHERE scope_id IS NULL;

            ALTER TABLE kb_chunks
            ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) NOT NULL DEFAULT 'user';
            ALTER TABLE kb_chunks
            ADD COLUMN IF NOT EXISTS scope_id VARCHAR(255);
            UPDATE kb_chunks SET scope_id = user_id WHERE scope_id IS NULL;
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx
            ON kb_chunks USING hnsw (embedding vector_cosine_ops);
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS kb_chunks_user_id_idx ON kb_chunks(user_id);
            CREATE INDEX IF NOT EXISTS kb_chunks_scope_idx ON kb_chunks(scope_type, scope_id);
            CREATE INDEX IF NOT EXISTS kb_documents_user_id_idx ON kb_documents(user_id);
            CREATE INDEX IF NOT EXISTS kb_documents_scope_idx ON kb_documents(scope_type, scope_id);
        `);

        initialized = true;
    } finally {
        client.release();
        await pool.end();
    }
}
