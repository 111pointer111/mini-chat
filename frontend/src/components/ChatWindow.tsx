import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, TextField, IconButton, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { GitHub, MenuBook, Translate, AutoAwesome, ChatBubbleOutline, Groups } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';

interface ScheduledTaskMessageData {
    conversationId: string;
    taskType: string;
    message: Pick<Message, '_id' | 'content' | 'type' | 'createdAt'>;
}

const PRESET_TASK_NAMES: Record<string, string> = {
    github_trending: 'GitHub 热点',
    daily_poem: '每日诗句',
    daily_english: '每日英文',
};

const TASK_ICONS: Record<string, React.ReactNode> = {
    github_trending: <GitHub />,
    daily_poem: <MenuBook />,
    daily_english: <Translate />,
    custom: <AutoAwesome />,
};

const ChatWindow: React.FC = () => {
    const { selectedFriend, selectedGroup, selectedTaskType, selectedTaskName, messages, addMessage } = useChatStore();
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

        const handleReceiveMessage = (newMessage: Message) => {
            addMessage(newMessage); // Update store
        };

        socket.on('receive_message', handleReceiveMessage);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [socket, addMessage]);

    useEffect(() => {
        if (!socket || !selectedGroup) return;

        socket.emit('join_group_room', selectedGroup._id);
        const handleReceiveGroupMessage = (newMessage: Message) => {
            addMessage(newMessage);
        };

        socket.on('receive_group_message', handleReceiveGroupMessage);

        return () => {
            socket.off('receive_group_message', handleReceiveGroupMessage);
        };
    }, [socket, selectedGroup, addMessage]);

    // Listen for scheduled task messages
    useEffect(() => {
        if (!socket || !selectedTaskType) return;

        const handleScheduledTaskMessage = (data: ScheduledTaskMessageData) => {
            // Check if this message is for the currently selected task
            // For preset tasks, compare taskType; for custom tasks, compare task ID
            if (data.taskType === selectedTaskType || data.conversationId === selectedTaskType) {
                // Add message to the list
                const newMessage = {
                    _id: data.message._id,
                    content: data.message.content,
                    type: data.message.type,
                    createdAt: data.message.createdAt,
                    sender: 'system',
                    receiver: '',
                };
                // Directly update messages state
                useChatStore.setState((state) => ({
                    messages: [...state.messages, newMessage],
                }));
            }
        };

        socket.on('scheduled_task_message', handleScheduledTaskMessage);

        return () => {
            socket.off('scheduled_task_message', handleScheduledTaskMessage);
        };
    }, [socket, selectedTaskType]);


    const handleSend = () => {
        if (!inputText.trim() || !socket || !user) return;

        if (selectedGroup) {
            const groupId = selectedGroup._id;
            const content = inputText;
            const tempId = `temp-${Date.now()}`;
            const optimisticMessage: Message = {
                _id: tempId,
                sender: user,
                groupId,
                content,
                type: 'text',
                createdAt: new Date().toISOString(),
            };

            useChatStore.setState((state) => ({
                messages: [...state.messages, optimisticMessage],
            }));
            setInputText('');

            socket.emit('send_group_message', {
                groupId,
                content,
                type: 'text',
            }, (ack: { success: boolean; error?: string; messageId?: string }) => {
                if (!ack?.success) {
                    useChatStore.setState((state) => ({
                        messages: state.messages.filter((m) => m._id !== tempId),
                    }));
                    console.error('Failed to send group message:', ack?.error);
                } else if (ack?.messageId) {
                    useChatStore.setState((state) => ({
                        messages: state.messages.map((m) =>
                            m._id === tempId ? { ...m, _id: ack.messageId! } : m
                        ),
                    }));
                }
            });
            return;
        }

        if (!selectedFriend) return;

        const friendId = selectedFriend._id;
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
            _id: tempId,
            sender: user!._id,
            receiver: friendId,
            content: inputText,
            type: 'text',
            createdAt: new Date().toISOString(),
        };

        // Optimistic UI: append immediately
        useChatStore.setState((state) => ({
            messages: [...state.messages, optimisticMessage],
        }));
        setInputText('');

        // Send with ack callback
        socket.emit('send_message', {
            receiverId: friendId,
            content: inputText,
            type: 'text'
        }, (ack: { success: boolean; error?: string; messageId?: string }) => {
            if (!ack?.success) {
                // Remove optimistic message on failure
                useChatStore.setState((state) => ({
                    messages: state.messages.filter((m) => m._id !== tempId),
                }));
                console.error('Failed to send message:', ack?.error);
            } else if (ack?.messageId) {
                // Replace optimistic message with real one
                useChatStore.setState((state) => ({
                    messages: state.messages.map((m) =>
                        m._id === tempId ? { ...m, _id: ack.messageId! } : m
                    ),
                }));
            }
        });
    };

    if (!selectedFriend && !selectedGroup && !selectedTaskType) {
        return (
            <Box sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 2,
            }}>
                <Box sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <ChatBubbleOutline sx={{ fontSize: 40, color: 'primary.main' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" fontWeight={500}>
                    选择一个会话开始聊天
                </Typography>
                <Typography variant="body2" color="text.disabled">
                    从左侧列表选择好友、群组或定时任务
                </Typography>
            </Box>
        );
    }

    if (selectedGroup) {
        return (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Paper square elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={selectedGroup.avatar} sx={{ bgcolor: 'secondary.main' }}>
                        <Groups />
                    </Avatar>
                    <Box>
                        <Typography variant="h6">{selectedGroup.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            输入 @小助手 可让群聊小助手基于群知识库回答
                        </Typography>
                    </Box>
                </Paper>

                <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {messages.map((msg, index) => {
                        const sender = typeof msg.sender === 'string' ? null : msg.sender;
                        const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;
                        const isMe = senderId === user?._id;
                        const isAssistant = senderId === '000000000000000000000001';
                        return (
                            <Box
                                key={index}
                                sx={{
                                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                                    maxWidth: { xs: '88%', sm: '72%' },
                                }}
                            >
                                {!isMe && (
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                        {isAssistant ? '群聊小助手' : sender?.username || '成员'}
                                    </Typography>
                                )}
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 1.5,
                                        bgcolor: isMe ? 'primary.main' : isAssistant ? '#EEF2FF' : 'white',
                                        color: isMe ? 'white' : 'text.primary',
                                        borderRadius: 2,
                                        borderTopRightRadius: isMe ? 0 : 2,
                                        borderTopLeftRadius: isMe ? 2 : 0,
                                    }}
                                >
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </Paper>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: isMe ? 'right' : 'left', mt: 0.5 }}>
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </Typography>
                            </Box>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </Box>

                <Paper square elevation={3} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            fullWidth
                            placeholder="输入消息，@小助手 可提问..."
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
    }

    // Scheduled task view (read-only)
    if (selectedTaskType) {
        return (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Paper square elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: TASK_ICONS[selectedTaskType] ? 'primary.main' : 'secondary.main' }}>
                        {TASK_ICONS[selectedTaskType] || TASK_ICONS.custom}
                    </Avatar>
                    <Typography variant="h6">{selectedTaskName || PRESET_TASK_NAMES[selectedTaskType] || '定时任务'}</Typography>
                </Paper>

                {/* Messages Area */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    {messages.length === 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography color="text.secondary">
                                暂无推送消息，请等待定时任务执行
                            </Typography>
                        </Box>
                    ) : (
                        messages.map((msg, index) => (
                            <Paper
                                key={index}
                                elevation={0}
                                sx={{
                                    p: 2.5,
                                    width: '100%',
                                    maxWidth: 680,
                                    bgcolor: 'white',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.1)',
                                    },
                                    '& p': { margin: 0, lineHeight: 1.7, color: '#1E293B' },
                                    '& ul, & ol': { pl: 2.5, my: 1 },
                                    '& li': { mb: 0.5 },
                                    '& h1, & h2, & h3': { 
                                        color: '#1E293B',
                                        fontWeight: 600,
                                        mt: 1.5,
                                        mb: 0.75,
                                    },
                                    '& h1': { fontSize: '1.25rem' },
                                    '& h2': { fontSize: '1.1rem' },
                                    '& h3': { fontSize: '1rem' },
                                    '& blockquote': {
                                        borderLeft: '3px solid #2563EB',
                                        pl: 1.5,
                                        ml: 0,
                                        color: '#475569',
                                    },
                                    '& code': {
                                        bgcolor: '#F1F5F9',
                                        px: 0.5,
                                        py: 0.25,
                                        borderRadius: 0.5,
                                        fontSize: '0.875em',
                                        fontFamily: 'monospace',
                                    },
                                    '& a': {
                                        color: '#2563EB',
                                        textDecoration: 'none',
                                        '&:hover': { textDecoration: 'underline' },
                                    },
                                }}
                            >
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                <Typography 
                                    variant="caption" 
                                    sx={{ 
                                        display: 'block', 
                                        mt: 1.5, 
                                        color: '#94A3B8',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    {new Date(msg.createdAt).toLocaleString('zh-CN')}
                                </Typography>
                            </Paper>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </Box>
            </Box>
        );
    }

    // At this point, selectedFriend is guaranteed to be non-null
    const friend = selectedFriend!;

    return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Paper square elevation={1} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={friend.avatar}>{friend.username[0]}</Avatar>
                <Typography variant="h6">{friend.username}</Typography>
            </Paper>

            {/* Messages Area */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {messages.map((msg, index) => {
                    const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender._id;
                    const isMe = senderId === user?._id;
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
                        placeholder="输入消息..."
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
