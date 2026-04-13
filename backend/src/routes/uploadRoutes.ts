/**
 * 文件上传路由
 */

import { Router } from 'express';
import { upload, getFileUrl, getFileBase64 } from '../services/fileService';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// 上传单张图片
router.post('/image', protect, upload.single('image'), (req, res) => {
    try {
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
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: '上传失败' });
    }
});

// 上传多张图片
router.post('/images', protect, upload.array('images', 9), (req, res) => {
    try {
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
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: '上传失败' });
    }
});

export default router;
