import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from '../models/Message';

interface DecodedToken {
    id: string;
    role: string;
}

let ioInstance: Server | null = null;

export const getIO = (): Server => {
    if (!ioInstance) {
        throw new Error('Socket.IO not initialized');
    }
    return ioInstance;
};

export const setupSocket = (io: Server) => {
    ioInstance = io;
    // Middleware for authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
            socket.data.user = decoded;
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: Socket) => {
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
        socket.on('send_message', async (data, callback) => {
            const { receiverId, content, type = 'text' } = data;

            if (!receiverId || !content) {
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Invalid message data' });
                }
                return;
            }

            try {
                // Save to database
                const newMessage = await Message.create({
                    sender: userId,
                    receiver: receiverId,
                    content,
                    type
                });

                // Emit to receiver's personal room
                io.to(receiverId).emit('receive_message', newMessage);

                // Acknowledge to sender with the real message ID
                if (typeof callback === 'function') {
                    callback({ success: true, messageId: newMessage._id.toString() });
                }

            } catch (error) {
                console.error('Socket message error:', error);
                if (typeof callback === 'function') {
                    callback({ success: false, error: 'Failed to send message' });
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', userId);
        });
    });
};
