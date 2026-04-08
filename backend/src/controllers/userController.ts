import { Request, Response } from 'express';
import User from '../models/User';

// Escape regex special characters to prevent injection
const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const searchUsers = async (req: Request, res: Response) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const keyword = escapeRegex(query.toString().trim());

        if (keyword.length < 1 || keyword.length > 100) {
            return res.status(400).json({ message: 'Search query must be between 1 and 100 characters' });
        }

        // Search by username or email, excluding current user
        const users = await User.find({
            $and: [
                { _id: { $ne: req.user!.id } },
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
