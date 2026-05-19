import { Request, Response } from 'express';
import Message from '../models/Message';

export const getMessages = async (req: Request, res: Response) => {
    try {
        const { userId: otherUserId } = req.params;
        const myId = req.user!.id;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherUserId },
                { sender: otherUserId, receiver: myId }
            ]
        })
        .populate('sender', 'username avatar')
        .sort({ createdAt: 1 })
        .limit(50)
        .lean();

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
