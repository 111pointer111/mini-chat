import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to inject the token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ==================== 知识库 API ====================

/** 获取文档列表（分页） */
export const getKBDocuments = (page = 1, pageSize = 20) =>
    api.get('/kb/documents', { params: { page, pageSize } });

/** 获取单个文档详情 */
export const getKBDocument = (id: number) =>
    api.get(`/kb/documents/${id}`);

/** 删除文档 */
export const deleteKBDocument = (id: number) =>
    api.delete(`/kb/documents/${id}`);

/** 上传本地文件 */
export const uploadKBDocument = (formData: FormData) =>
    api.post('/kb/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

/** 从 URL 导入 */
export const importKBFromUrl = (url: string, title?: string) =>
    api.post('/kb/documents/url', { url, title });

/** RAG 对话 */
export const chatWithKnowledge = (query: string, history: Array<{ role: string; content: string }> = []) =>
    api.post('/kb/chat', { query, history });

/** 关键词搜索 */
export const searchKB = (q: string) =>
    api.get('/kb/search', { params: { q } });

export default api;
