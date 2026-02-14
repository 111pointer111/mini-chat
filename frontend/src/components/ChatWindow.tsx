import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, IconButton, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';

const ChatWindow: React.FC = () => {
    const { selectedFriend, messages, addMessage } = useChatStore();
    const { user } = useAuthStore();
    const { socket } = useSocketStore();
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Listen for incoming messages socket event
    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (newMessage: any) => {
            addMessage(newMessage); // Update store
        };

        socket.on('receive_message', handleReceiveMessage);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [socket, addMessage]);


    const handleSend = () => {
        if (!inputText.trim() || !selectedFriend || !socket) return;

        // Optimistic UI update (optional, but good for UX)
        // Actually, we'll wait for server ack or just emit and assume success for now
        // socket.emit is void, so we rely on receive_message or we just append it locally if we trust connection

        // Let's emit
        const friendId = selectedFriend._id || selectedFriend.id;
        socket.emit('send_message', {
            receiverId: friendId,
            content: inputText,
            type: 'text'
        });

        // In a real app, we might want to append locally immediately
        // But since our server broadcasts back to sender too (based on room logic), we might get duplicate
        // Let's see our backend implementation: io.to(roomId).emit
        // roomId includes both users. So sender WILL receive it. 
        // So we DON'T append locally here to avoid duplicate.

        setInputText('');
    };

    if (!selectedFriend) {
        return (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
                <Typography variant="h6" color="text.secondary">
                    Select a friend to start chatting
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Paper square elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={selectedFriend.avatar}>{selectedFriend.username[0]}</Avatar>
                <Typography variant="h6">{selectedFriend.username}</Typography>
            </Paper>

            {/* Messages Area */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {messages.map((msg, index) => {
                    const isMe = msg.sender === (user?.id || user?._id);
                    return (
                        <Box
                            key={index}
                            sx={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: { xs: '85%', sm: '70%' }
                            }}
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 1.5,
                                    bgcolor: isMe ? 'primary.main' : 'white',
                                    color: isMe ? 'white' : 'text.primary',
                                    borderRadius: 2,
                                    borderTopRightRadius: isMe ? 0 : 2,
                                    borderTopLeftRadius: isMe ? 2 : 0
                                }}
                            >
                                <Typography variant="body1">{msg.content}</Typography>
                            </Paper>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: isMe ? 'right' : 'left', mt: 0.5 }}>
                                {new Date(msg.createdAt).toLocaleTimeString()}
                            </Typography>
                        </Box>
                    );
                })}
                <div ref={messagesEndRef} />
            </Box>

            {/* Input Area */}
            <Paper square elevation={3} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        placeholder="Type a message..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        size="small"
                    />
                    <IconButton color="primary" onClick={handleSend}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Paper>
        </Box>
    );
};

export default ChatWindow;
