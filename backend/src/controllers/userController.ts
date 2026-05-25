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

export const updateMe = async (req: Request, res: Response) => {
    try {
        const { username, avatar } = req.body as {
            username?: unknown;
            avatar?: unknown;
        };

        const updates: { username?: string; avatar?: string } = {};

        if (username !== undefined) {
            if (typeof username !== 'string') {
                return res.status(400).json({ message: '姓名格式不正确' });
            }

            const trimmedUsername = username.trim();
            if (trimmedUsername.length < 2 || trimmedUsername.length > 30) {
                return res.status(400).json({ message: '姓名长度必须在 2 到 30 个字符之间' });
            }

            const existingUser = await User.findOne({
                _id: { $ne: req.user!.id },
                username: trimmedUsername
            });

            if (existingUser) {
                return res.status(400).json({ message: '该姓名已被使用' });
            }

            updates.username = trimmedUsername;
        }

        if (avatar !== undefined) {
            if (typeof avatar !== 'string') {
                return res.status(400).json({ message: '头像格式不正确' });
            }

            const trimmedAvatar = avatar.trim();
            if (trimmedAvatar.length > 1000) {
                return res.status(400).json({ message: '头像地址过长' });
            }

            updates.avatar = trimmedAvatar;
        }

        const user = await User.findByIdAndUpdate(
            req.user!.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('_id username email phone role avatar');

        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Update me error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
