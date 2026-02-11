"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Message_1 = __importDefault(require("../models/Message"));
const setupSocket = (io) => {
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded;
            next();
        }
        catch (err) {
            next(new Error('Authentication error'));
        }
    });
    io.on('connection', (socket) => {
        const userId = socket.data.user.id;
        console.log(`User connected: ${userId}`);
        // Join a room based on user ID for personal notifications
        socket.join(userId);
        // Join a chat room
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`User ${userId} joined room: ${room}`);
        });
        // Handle sending messages
        socket.on('send_message', async (data) => {
            const { receiverId, content, type = 'text' } = data;
            try {
                // Save to database
                const newMessage = await Message_1.default.create({
                    sender: userId,
                    receiver: receiverId,
                    content,
                    type
                });
                // Emit to receiver's personal room
                io.to(receiverId).emit('receive_message', newMessage);
                // Emit to sender's personal room (so they see it too via socket, or we can rely on optimistic UI)
                // Ideally sender should get ack, but emitting back is fine for consistency
                io.to(userId).emit('receive_message', newMessage);
            }
            catch (error) {
                console.error('Socket message error:', error);
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', userId);
        });
    });
};
exports.setupSocket = setupSocket;
