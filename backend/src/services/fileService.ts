/**
 * 文件上传服务
 * 支持图片上传，提供可访问的 URL
 */

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// 确保上传目录存在
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 允许的图片类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// 存储配置
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        // 生成唯一文件名：时间戳-随机字符串-原始扩展名
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
        cb(null, uniqueName);
    },
});

// 文件过滤器
const fileFilter = (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('只支持 JPEG、PNG、GIF、WebP 格式的图片'));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

// 获取上传文件的访问 URL
export function getFileUrl(filename: string, baseUrl?: string): string {
    if (baseUrl) {
        return `${baseUrl}/uploads/${filename}`;
    }
    return `/uploads/${filename}`;
}

// 将上传的文件转为 base64（用于发送给 AI API）
export function getFileBase64(filename: string): string | null {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase().slice(1);
    const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
}
