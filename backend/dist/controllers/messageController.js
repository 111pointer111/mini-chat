"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = void 0;
const Message_1 = __importDefault(require("../models/Message"));
const getMessages = async (req, res) => {
    try {
        const { userId: otherUserId } = req.params;
        const myId = req.user.id;
        const messages = await Message_1.default.find({
            $or: [
                { sender: myId, receiver: otherUserId },
                { sender: otherUserId, receiver: myId }
            ]
        }).sort({ createdAt: 1 }).limit(50); // Simple limit for now, pagination can be added later
        res.json(messages);
    }
    catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getMessages = getMessages;
