import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    TextField,
    IconButton,
    CircularProgress,
    Alert,
    alpha,
    Chip,
} from '@mui/material';
import { ArrowBack, Send, SmartToy, Person, AutoAwesome } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import AIProviderSelector from '../components/AIProviderSelector';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    pendingTask?: boolean;
    taskCreated?: boolean;
}

const AI_ASSISTANT_ID = '000000000000000000000001';
const WELCOME_MESSAGE: Message = {
    id: '0',
    role: 'assistant',
    content: '你好！我是 AI 助手。你可以和我聊天，或者说「**创建定时任务**」来创建个性化的定时推送任务。',
};

const AIChat: React.FC = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [, setHistoryLoading] = useState(true);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load chat history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const res = await api.get('/ai-chat/history');
                if (res.data.messages && res.data.messages.length > 0) {
                    const historyMessages: Message[] = res.data.messages.map((msg: any) => ({
                        id: msg._id,
                        role: msg.sender === AI_ASSISTANT_ID ? 'assistant' : 'user',
                        content: msg.content,
                    }));
                    setMessages(historyMessages);
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            } finally {
                setHistoryLoading(false);
            }
        };
        loadHistory();
    }, []);

    const getUserTimezone = () => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError('');

        try {
            const res = await api.post('/ai-chat', {
                message: userMessage.content,
                timezone: getUserTimezone(),
            });

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.data.reply,
                pendingTask: res.data.pendingTask,
                taskCreated: res.data.taskCreated,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            if (res.data.taskCreated) {
                // Task was created, show success notification
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: (Date.now() + 2).toString(),
                            role: 'assistant',
                            content: '💡 你可以在「定时任务设置」页面查看和管理所有任务。',
                        },
                    ]);
                }, 1000);
            }
        } catch (err) {
            setError('发送失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Box
            sx={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#f8f9fa',
            }}
        >
            {/* Header */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    borderRadius: 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'white',
                }}
            >
                <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <SmartToy sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" fontWeight={600}>
                        AI 助手
                    </Typography>
                    <Chip
                        icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                        label="可创建定时任务"
                        size="small"
                        sx={{ ml: 2 }}
                        color="primary"
                        variant="outlined"
                    />
                    <Box sx={{ ml: 'auto' }}>
                        <AIProviderSelector />
                    </Box>
                </Box>
            </Paper>

            {/* Messages */}
            <Box
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 2,
                }}
            >
                <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    <AnimatePresence>
                        {messages.map((message) => (
                            <motion.div
                                key={message.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                                        mb: 2,
                                    }}
                                >
                                    {message.role === 'assistant' && (
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                bgcolor: 'primary.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mr: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <SmartToy sx={{ color: 'white', fontSize: 20 }} />
                                        </Box>
                                    )}
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: 2,
                                            maxWidth: '70%',
                                            borderRadius: 2,
                                            bgcolor: message.role === 'user' ? 'primary.main' : 'white',
                                            color: message.role === 'user' ? 'white' : 'text.primary',
                                            border: message.role === 'assistant' ? '1px solid' : 'none',
                                            borderColor: message.pendingTask
                                                ? alpha('#722ed1', 0.3)
                                                : message.taskCreated
                                                ? alpha('#52c41a', 0.3)
                                                : 'divider',
                                            '& p': { m: 0 },
                                            '& p:not(:last-child)': { mb: 1 },
                                            '& ul, & ol': { pl: 2, my: 1 },
                                            '& code': {
                                                bgcolor: message.role === 'user' ? 'rgba(255,255,255,0.2)' : alpha('#000', 0.05),
                                                px: 0.5,
                                                borderRadius: 0.5,
                                                fontFamily: 'monospace',
                                            },
                                            '& strong': {
                                                fontWeight: 600,
                                            },
                                        }}
                                    >
                                        {message.pendingTask && (
                                            <Chip
                                                icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                                label="待确认任务"
                                                size="small"
                                                sx={{ mb: 1 }}
                                                color="secondary"
                                            />
                                        )}
                                        {message.taskCreated && (
                                            <Chip
                                                label="✅ 任务已创建"
                                                size="small"
                                                sx={{ mb: 1, bgcolor: alpha('#52c41a', 0.1), color: '#52c41a' }}
                                            />
                                        )}
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
                                    </Paper>
                                    {message.role === 'user' && (
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                bgcolor: 'grey.300',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                ml: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Person sx={{ color: 'grey.600', fontSize: 20 }} />
                                        </Box>
                                    )}
                                </Box>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {loading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <SmartToy sx={{ color: 'white', fontSize: 20 }} />
                            </Box>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    bgcolor: 'white',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <CircularProgress size={20} />
                            </Paper>
                        </Box>
                    )}

                    <div ref={messagesEndRef} />
                </Box>
            </Box>

            {/* Input */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    borderRadius: 0,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'white',
                }}
            >
                <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        placeholder="输入消息... (说「创建定时任务」可以创建个性化任务)"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        multiline
                        maxRows={4}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            },
                        }}
                    />
                    <IconButton
                        color="primary"
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' },
                            '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
                        }}
                    >
                        <Send />
                    </IconButton>
                </Box>
            </Paper>
        </Box>
    );
};

export default AIChat;
