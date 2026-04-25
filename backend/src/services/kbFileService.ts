/**
 * 知识库文件处理服务
 * 负责：文件存储、文本提取、文本分块
 */
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import textract from 'textract';
import cheerio from 'cheerio';
import Tesseract from 'tesseract.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import 'dotenv/config';

// ==================== 文件存储 ====================

const DIRECT_TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.markdown',
    '.json',
    '.csv',
    '.tsv',
    '.log',
]);

const ALLOWED_KB_EXTENSIONS = new Set([
    ...DIRECT_TEXT_EXTENSIONS,
    '.pdf',
    '.doc',
    '.docx',
    '.ppt',
    '.pptx',
    '.xls',
    '.xlsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.bmp',
]);

// 存储目录：backend/uploads/kb/
const KB_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'kb');
if (!fs.existsSync(KB_UPLOAD_DIR)) {
    fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KB_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`;
        cb(null, name);
    },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_KB_EXTENSIONS.has(ext) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('text/')) {
        cb(null, true);
        return;
    }

    cb(new Error(`暂不支持上传 ${ext || '该类型'} 文件`));
};

export const uploadKbFile = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).single('file');

// ==================== 文本提取 ====================

export interface ExtractResult {
    text: string;
    fileType: string;
}

/**
 * 从本地文件提取纯文本
 */
function extractFromFile(filePath: string, mimeType: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    return new Promise((resolve, reject) => {
        // 图片文件用 OCR
        if (mimeType.startsWith('image/')) {
            Tesseract.recognize(filePath, 'chi_sim+eng', {
                logger: () => {}, // 静默日志
            })
                .then(({ data: { text } }) => resolve(text.trim()))
                .catch(reject);
            return;
        }

        // 纯文本类文件优先直接读取，避免依赖外部 textract 二进制
        if (DIRECT_TEXT_EXTENSIONS.has(ext) || mimeType.startsWith('text/')) {
            fs.promises.readFile(filePath, 'utf-8')
                .then((text) => resolve(text.trim()))
                .catch(reject);
            return;
        }

        // 其他文件用 textract
        textract.fromFileWithPath(filePath, (err: Error | null, text: string) => {
            if (err) {
                const rawMessage = err.message || String(err);
                if (/spawn .*enoent|not found|command failed|could not find|missing/i.test(rawMessage)) {
                    reject(new Error('当前服务器缺少文档解析依赖，暂时无法解析该文件类型，请优先上传 txt、md、csv 等文本文件，或为部署环境安装文档解析组件'));
                    return;
                }
                reject(err);
            } else {
                resolve((text || '').trim());
            }
        });
    });
}

/**
 * 从 URL 抓取网页文本
 */
async function extractFromUrl(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBaseBot/1.0)',
        },
        signal: AbortSignal.timeout(15000), // 15秒超时
    });
    if (!response.ok) {
        throw new Error(`URL 请求失败: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // 移除脚本、样式等无关标签
    $('script, style, nav, footer, header, aside').remove();

    // 提取正文（优先 article/main，否则取 body）
    const article = $('article').text() || $('main').text() || $('body').text();
    return article.trim().replace(/\s+/g, ' ');
}

/**
 * 根据来源提取文本
 */
export async function extractText(
    source: 'local' | 'url',
    filePathOrUrl: string,
    mimeType: string
): Promise<ExtractResult> {
    let text: string;

    if (source === 'url') {
        text = await extractFromUrl(filePathOrUrl);
    } else {
        text = await extractFromFile(filePathOrUrl, mimeType);
    }

    if (!text || text.length < 20) {
        throw new Error('未能提取到有效文本内容');
    }

    return { text, fileType: mimeType };
}

// ==================== 文本分块 ====================

export interface TextChunk {
    index: number;
    content: string;
}

/**
 * 将长文本切分成小块
 * chunkSize: 每块最大字符数
 * chunkOverlap: 块之间的重叠字符数（保持上下文连贯）
 */
export async function chunkText(
    text: string,
    chunkSize = 1000,
    chunkOverlap = 200
): Promise<TextChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        separators: ['\n\n', '\n', '。', '！', '？', '. ', ' ', ''],
    });

    const docs = await splitter.createDocuments([text]);

    return docs.map((doc: Document, i: number) => ({
        index: i,
        content: doc.pageContent.trim(),
    }));
}
