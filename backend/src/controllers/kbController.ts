import { Request, Response } from 'express';
import {
    listDocuments,
    getDocument,
    deleteDocument,
    searchDocuments,
    getChunksByDocument,
    textSearch,
} from '../utils/kbDb';
import {
    processUploadedFile,
    processUrlImport,
    chatWithKnowledge,
} from '../services/kbService';
import { uploadKbFile } from '../services/kbFileService';

// GET /api/kb/documents — 获取文档列表
export const getDocuments = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;

        const { documents, total } = await listDocuments(userId, { page, pageSize });

        res.json({
            documents,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (err) {
        console.error('getDocuments error:', err);
        res.status(500).json({ message: '获取文档列表失败' });
    }
};

// GET /api/kb/documents/:id — 获取单个文档详情
export const getDocumentById = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const id = parseInt(req.params.id as string);

        const doc = await getDocument(id, userId);
        if (!doc) {
            return res.status(404).json({ message: '文档不存在' });
        }

        // 同时返回关联的 chunks 预览（前5个）
        const chunks = await getChunksByDocument(id, userId);
        const previewChunks = chunks.slice(0, 5).map(c => ({
            index: c.chunk_index,
            content: c.content.substring(0, 200) + (c.content.length > 200 ? '...' : ''),
        }));

        res.json({ ...doc, previewChunks, totalChunks: chunks.length });
    } catch (err) {
        console.error('getDocumentById error:', err);
        res.status(500).json({ message: '获取文档详情失败' });
    }
};

// DELETE /api/kb/documents/:id — 删除文档
export const removeDocument = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const id = parseInt(req.params.id as string);

        const deleted = await deleteDocument(id, userId);
        if (!deleted) {
            return res.status(404).json({ message: '文档不存在' });
        }

        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('removeDocument error:', err);
        res.status(500).json({ message: '删除文档失败' });
    }
};

// GET /api/kb/search?q=keyword — 关键词搜索文档
export const searchKb = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const keyword = (req.query.q as string) || '';

        if (!keyword.trim()) {
            return res.json({ documents: [], chunks: [] });
        }

        // 并行搜索文档和 chunks
        const [documents, chunks] = await Promise.all([
            searchDocuments(userId, keyword),
            textSearch(userId, keyword),
        ]);

        res.json({ documents, chunks });
    } catch (err) {
        console.error('searchKb error:', err);
        res.status(500).json({ message: '搜索失败' });
    }
};

// POST /api/kb/documents/upload — 上传本地文件
export const uploadDocument = (req: Request, res: Response) => {
    uploadKbFile(req, res, async (err) => {
        if (err) {
            console.error('文件上传失败:', err);
            return res.status(400).json({ message: '文件上传失败: ' + err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: '未检测到文件' });
        }

        try {
            const userId = req.user!.id;
            const title = req.body.title;
            const doc = await processUploadedFile(userId, req.file, title);
            res.status(201).json({ document: doc });
        } catch (err) {
            const msg = err instanceof Error ? err.message : '处理失败';
            res.status(500).json({ message: msg });
        }
    });
};

// POST /api/kb/documents/url — 从 URL 导入
export const importFromUrl = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { url, title } = req.body;

        if (!url) {
            return res.status(400).json({ message: '缺少 url 参数' });
        }

        // 验证 URL 格式
        try { new URL(url); } catch {
            return res.status(400).json({ message: '无效的 URL 格式' });
        }

        const doc = await processUrlImport(userId, url, title);
        res.status(201).json({ document: doc });
    } catch (err) {
        const msg = err instanceof Error ? err.message : '导入失败';
        console.error('importFromUrl error:', err);
        res.status(500).json({ message: msg });
    }
};

// POST /api/kb/chat — RAG 对话
export const ragChat = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { query, history } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ message: '缺少 query 参数' });
        }

        const { answer, sources } = await chatWithKnowledge(userId, query, history || []);
        res.json({ answer, sources });
    } catch (err) {
        console.error('ragChat error:', err);
        res.status(500).json({ message: '对话失败' });
    }
};
