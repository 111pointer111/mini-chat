import express from 'express';
import {
    getDocuments,
    getDocumentById,
    removeDocument,
    searchKb,
    uploadDocument,
    importFromUrl,
    ragChat,
} from '../controllers/kbController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// 所有路由都需要登录
router.use(protect);

// ---- 文档管理 ----

// GET /api/kb/documents — 文档列表（分页）
router.get('/documents', getDocuments);

// POST /api/kb/documents/upload — 上传本地文件
router.post('/documents/upload', uploadDocument);

// POST /api/kb/documents/url — 从 URL 导入
router.post('/documents/url', importFromUrl);

// GET /api/kb/documents/:id — 文档详情
router.get('/documents/:id', getDocumentById);

// DELETE /api/kb/documents/:id — 删除文档
router.delete('/documents/:id', removeDocument);

// GET /api/kb/search?q= — 关键词搜索
router.get('/search', searchKb);

// ---- AI 对话 ----

// POST /api/kb/chat — RAG 对话
router.post('/chat', ragChat);

export default router;
