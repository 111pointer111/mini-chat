import { Request, Response } from 'express';
import Message from '../models/Message';

export const getMessages = async (req: Request, res: Response) => {
    try {
        const { userId: otherUserId } = req.params;
        const myId = req.user!.id;
        const { before, limit: limitStr } = req.query;
        const limit = Math.min(parseInt(limitStr as string) || 50, 100);

        const query: any = {
            $or: [
                { sender: myId, receiver: otherUserId },
                { sender: otherUserId, receiver: myId }
            ]
        };

        // Cursor 分页：传入 before (ISO 时间戳)，返回该时间之前的消息
        if (before) {
            query.createdAt = { $lt: new Date(before as string) };
        }

        const messages = await Message.find(query)
        .populate('sender', 'username avatar')
        .sort({ createdAt: -1 }) // 倒序取最新的
        .limit(limit)
        .lean();

        // 返回时按时间正序，方便前端直接追加
        messages.reverse();

        res.json({
            messages,
            hasMore: messages.length === limit,
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
