import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Friendship from '../models/Friendship';
import User from '../models/User';

export const sendFriendRequest = async (req: Request, res: Response) => {
    try {
        const { recipientId } = req.body;
        const requesterId = req.user!.id;

        if (requesterId === recipientId) {
            return res.status(400).json({ message: 'Cannot send friend request to yourself' });
        }

        // Check if friendship already exists
        const existingFriendship = await Friendship.findOne({
            $or: [
                { requester: requesterId, recipient: recipientId },
                { requester: recipientId, recipient: requesterId }
            ]
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'accepted') {
                return res.status(400).json({ message: 'Already friends' });
            } else if (existingFriendship.status === 'pending') {
                return res.status(400).json({ message: 'Friend request already sent' });
            }
            // If rejected, allow resending (or maybe not, depends on policy. Here we allow)
        }

        const newFriendship = await Friendship.create({
            requester: requesterId,
            recipient: recipientId,
            status: 'pending'
        });

        res.status(201).json(newFriendship);
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
    try {
        const { requestId } = req.params;
        const userId = req.user!.id;

        const friendship = await Friendship.findById(requestId);

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        // Verify recipient matches current user
        if (friendship.recipient.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to accept this request' });
        }

        friendship.status = 'accepted';
        await friendship.save();

        res.json({ message: 'Friend request accepted', friendship });
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getFriends = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const friendships = await Friendship.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        }).populate('requester', 'username email avatar')
            .populate('recipient', 'username email avatar');

        // Format the response to return a list of friend users
        const friends = friendships.map(f => {
            if (f.requester._id.toString() === userId) {
                return f.recipient;
            } else {
                return f.requester;
            }
        });

        res.json(friends);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getPendingRequests = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        // Incoming requests
        const requests = await Friendship.find({
            recipient: userId,
            status: 'pending'
        }).populate('requester', 'username email avatar');

        res.json(requests);
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
