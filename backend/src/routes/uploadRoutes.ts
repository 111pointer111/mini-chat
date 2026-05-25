/**
 * 文件上传路由
 */

import { Router } from 'express';
import type { Response } from 'express';
import multer from 'multer';
import { upload, getFileUrl, getFileBase64 } from '../services/fileService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

const handleUploadError = (err: unknown, res: Response) => {
    if (!err) return false;

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ message: '图片不能超过 10MB' });
            return true;
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            res.status(400).json({ message: '上传字段不正确，请重新选择图片' });
            return true;
        }

        res.status(400).json({ message: err.message || '图片上传失败' });
        return true;
    }

    if (err instanceof Error) {
        res.status(400).json({ message: err.message || '图片上传失败' });
        return true;
    }

    res.status(400).json({ message: '图片上传失败' });
    return true;
};

// 上传单张图片
router.post('/image', protect, (req, res) => {
    upload.single('image')(req, res, (err) => {
        try {
            if (handleUploadError(err, res)) return;

            if (!req.file) {
                res.status(400).json({ message: '请选择要上传的图片' });
                return;
            }

            const url = getFileUrl(req.file.filename);
            const base64 = getFileBase64(req.file.filename);
            res.json({
                url,
                base64,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ message: '上传失败' });
        }
    });
});

// 上传多张图片
router.post('/images', protect, (req, res) => {
    upload.array('images', 9)(req, res, (err) => {
        try {
            if (handleUploadError(err, res)) return;

            const files = req.files as Express.Multer.File[];
            if (!files || files.length === 0) {
                res.status(400).json({ message: '请选择要上传的图片' });
                return;
            }

            const urls = files.map((file) => ({
                url: getFileUrl(file.filename),
                base64: getFileBase64(file.filename),
                filename: file.filename,
                originalName: file.originalname,
                size: file.size,
            }));

            res.json({ images: urls });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ message: '上传失败' });
        }
    });
});

export default router;
