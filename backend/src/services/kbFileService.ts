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

export const uploadKbFile = multer({
    storage,
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

        // 其他文件用 textract
        textract.fromFileWithPath(filePath, (err: Error | null, text: string) => {
            if (err) {
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
