import { Request, Response } from 'express';
import User from '../models/User';

export const searchUsers = async (req: Request, res: Response) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const keyword = query.toString();

        // Search by username or email, excluding current user
        const users = await User.find({
            $and: [
                { _id: { $ne: (req as any).user.id } },
                {
                    $or: [
                        { username: { $regex: keyword, $options: 'i' } },
                        { email: { $regex: keyword, $options: 'i' } }
                    ]
                }
            ]
        }).select('username email avatar');

        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
