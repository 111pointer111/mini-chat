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
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
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
        socket.on('send_message', async (data) => {
            const { receiverId, content, type = 'text' } = data;

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

                // Emit to sender's personal room (so they see it too via socket, or we can rely on optimistic UI)
                // Ideally sender should get ack, but emitting back is fine for consistency
                io.to(userId).emit('receive_message', newMessage);

            } catch (error) {
                console.error('Socket message error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', userId);
        });
    });
};
