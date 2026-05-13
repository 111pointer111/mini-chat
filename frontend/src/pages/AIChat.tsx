import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
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
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Drawer,
    Divider,
    useMediaQuery,
    useTheme,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Collapse,
} from '@mui/material';
import { ArrowBack, Send, SmartToy, Person, AutoAwesome, Add, Delete, Chat, Menu, Edit, ExpandMore, ExpandLess, Image as ImageIcon, Close } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import AIProviderSelector from '../components/AIProviderSelector';
import { useSocketStore } from '../store/socketStore';

interface MessageSource {
    documentName: string;
    chunkIndex: number;
    content: string;
    similarity: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    images?: string[];
    thinking?: string;
    pendingTask?: boolean;
    taskCreated?: boolean;
    sources?: MessageSource[];
    createdAt?: string;
}

interface BackendMessage {
    _id: string;
    sender: string;
    content: string;
    images?: string[];
    createdAt: string;
}

interface Conversation {
    _id: string;
    name: string;
    lastMessageAt: string;
}

const DRAWER_WIDTH = 280;

// Strip <think>...</think> tags and extract thinking content
const parseAIResponse = (content: string): { main: string; thinking?: string } => {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
        const thinking = thinkMatch[1].trim();
        const main = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
        return { main, thinking };
    }
    return { main: content };
};

const AI_ASSISTANT_ID = '000000000000000000000001';
const WELCOME_MESSAGE: Message = {
    id: '0',
    role: 'assistant',
    content: '你好！我是 AI 助手。你可以和我聊天，或者说「**创建定时任务**」来创建个性化的定时推送任务。',
};

const AIChat: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingConvId, setEditingConvId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [convToDelete, setConvToDelete] = useState<string | null>(null);
    const [expandedThink, setExpandedThink] = useState<Record<string, boolean>>({});
    const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
    const [isStreaming, setIsStreaming] = useState(false);
    const [pendingImages, setPendingImages] = useState<File[]>([]); // 待发送的图片
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const socketRef = useRef<ReturnType<typeof io> | null>(null);
    const streamingMessageIdRef = useRef<string | null>(null);
    const isStreamingRef = useRef(false);
    const streamingRawRef = useRef<string>(''); // 追踪流式接收的原始内容（含 <think> 标签）
    const pendingThinkingRef = useRef<string>(''); // 追踪尚未闭合的 thinking 内容

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load conversations and chat history on mount
    const loadConversations = async () => {
        try {
            const res = await api.get('/ai-chat/conversations');
            setConversations(res.data);
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    };

    const loadHistory = async (convId?: string) => {
        try {
            const url = convId ? `/ai-chat/history/${convId}` : '/ai-chat/history';
            const res = await api.get(url);
            if (res.data.messages && res.data.messages.length > 0) {
                const historyMessages: Message[] = res.data.messages.map((msg: BackendMessage) => {
                    const { main, thinking } = parseAIResponse(msg.content);
                    return {
                        id: msg._id,
                        role: msg.sender === AI_ASSISTANT_ID ? 'assistant' : 'user',
                        content: main,
                        thinking,
                        images: msg.images || [],
                        createdAt: msg.createdAt,
                    };
                });
                setMessages(historyMessages);
                setCurrentConversationId(res.data.conversationId);
            } else {
                setMessages([WELCOME_MESSAGE]);
                setCurrentConversationId(res.data.conversationId);
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
        }
    };

    useEffect(() => {
        loadConversations();
        loadHistory();
    }, []);

    // Socket 初始化和 AI 流式监听
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const { socket: authSocket } = useSocketStore.getState();
        let socket = authSocket;
        if (!socket) {
            socket = io('', { auth: { token }, reconnection: true });
            socketRef.current = socket;
        } else {
            socketRef.current = socket;
        }

                socket.on('ai_stream', (data: { content: string; done: boolean; sources?: MessageSource[] }) => {
            if (data.done) {
                // 流式结束：用完整原始内容更新 message，确保 thinking 正确解析
                if (streamingMessageIdRef.current && streamingRawRef.current) {
                    const { main, thinking } = parseAIResponse(streamingRawRef.current);
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== streamingMessageIdRef.current) return msg;
                            return { ...msg, content: main, thinking, sources: data.sources || msg.sources };
                        })
                    );
                }
                // 流式结束，折叠思考过程
                if (streamingMessageIdRef.current) {
                    setExpandedThink((prev) => ({ ...prev, [streamingMessageIdRef.current!]: false }));
                }
                streamingRawRef.current = '';
                pendingThinkingRef.current = '';
                isStreamingRef.current = false;
                setIsStreaming(false);
                setLoading(false);
                streamingMessageIdRef.current = null;
            } else {
                // 累积原始内容
                streamingRawRef.current += data.content;

                // 追加到 pending thinking（如果处于 thinking 块中）
                pendingThinkingRef.current += data.content;

                setMessages((prev) => {
                    if (!streamingMessageIdRef.current) return prev;
                    return prev.map((msg) => {
                        if (msg.id !== streamingMessageIdRef.current) return msg;

                        const newRaw = msg.content + data.content;
                        const { main, thinking } = parseAIResponse(newRaw);

                        // 如果当前没有 thinking，检查 pending 中是否已找到完整的 <think>...</think>
                        let finalThinking = thinking;
                        if (!finalThinking && pendingThinkingRef.current) {
                            const completeMatch = pendingThinkingRef.current.match(/<think>([\s\S]*?)<\/think>/);
                            if (completeMatch) {
                                finalThinking = completeMatch[1].trim();
                            }
                        }

                        // 如果本 chunk 包含 </think>，清空 pending 并折叠思考过程
                        if (data.content.includes('</think>')) {
                            pendingThinkingRef.current = '';
                            if (streamingMessageIdRef.current) {
                                setExpandedThink((prev) => ({ ...prev, [streamingMessageIdRef.current!]: false }));
                            }
                        }

                        return { ...msg, content: main, thinking: finalThinking };
                    });
                });
            }
        });

        socket.on('conversation_renamed', (data: { conversationId: string; name: string }) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c._id === data.conversationId ? { ...c, name: data.name } : c
                )
            );
        });

        socket.on('ai_stream_error', (data: { error: string }) => {
            setMessages((prev) => {
                const withoutStreaming = prev.filter((m) => m.id !== streamingMessageIdRef.current);
                return [
                    ...withoutStreaming,
                    {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant' as const,
                        content: data.error,
                    },
                ];
            });
            isStreamingRef.current = false;
            setIsStreaming(false);
            setLoading(false);

            streamingMessageIdRef.current = null;
        });

        return () => {
            socket!.off('ai_stream');
            socket!.off('conversation_renamed');
            socket!.off('ai_stream_error');
        };
    }, []);

    const getUserTimezone = () => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    };

    const handleCreateConversation = async () => {
        try {
            const res = await api.post('/ai-chat/conversations', {});
            setConversations((prev) => [res.data, ...prev]);
            setCurrentConversationId(res.data._id);
            setMessages([WELCOME_MESSAGE]);
            setDrawerOpen(false);
        } catch (err) {
            console.error('Failed to create conversation:', err);
        }
    };

    const handleSelectConversation = async (convId: string) => {
        setCurrentConversationId(convId);
        await loadHistory(convId);
        setDrawerOpen(false);
    };

    const handleDeleteClick = (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConvToDelete(convId);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!convToDelete) return;
        try {
            await api.delete(`/ai-chat/conversations/${convToDelete}`);
            setConversations((prev) => prev.filter((c) => c._id !== convToDelete));
            if (currentConversationId === convToDelete) {
                setCurrentConversationId(null);
                setMessages([WELCOME_MESSAGE]);
            }
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        } finally {
            setDeleteDialogOpen(false);
            setConvToDelete(null);
        }
    };

    const handleStartEdit = (conv: Conversation, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingConvId(conv._id);
        setEditingName(conv.name);
    };

    const handleSaveEdit = async (convId: string) => {
        if (!editingName.trim()) {
            setEditingConvId(null);
            return;
        }
        try {
            const res = await api.put(`/ai-chat/conversations/${convId}`, { name: editingName.trim() });
            setConversations((prev) => prev.map((c) => (c._id === convId ? res.data : c)));
            setEditingConvId(null);
        } catch (err) {
            console.error('Failed to update conversation:', err);
        }
    };

    const handleEditKeyPress = (e: React.KeyboardEvent, convId: string) => {
        if (e.key === 'Enter') {
            handleSaveEdit(convId);
        } else if (e.key === 'Escape') {
            setEditingConvId(null);
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && pendingImages.length === 0) || loading || isStreaming) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            createdAt: new Date().toISOString(),
        };

        const streamId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
            id: streamId,
            role: 'assistant',
            content: '',
            images: [],
            createdAt: new Date().toISOString(),
        };

        // 如果有图片，先上传
        let uploadedImageUrls: string[] = [];
        let uploadedImageBase64s: string[] = [];
        if (pendingImages.length > 0) {
            try {
                const formData = new FormData();
                pendingImages.forEach((file) => {
                    formData.append('images', file);
                });
                const uploadRes = await api.post('/upload/images', formData);
                uploadedImageUrls = uploadRes.data.images.map((img: { url: string }) => img.url);
                uploadedImageBase64s = uploadRes.data.images.map((img: { base64: string }) => img.base64);
            } catch {
                setError('图片上传失败');
                isStreamingRef.current = false;
                setIsStreaming(false);
                setLoading(false);
                return;
            }
        }

        // 更新用户消息为带图片版本
        const finalUserMessage: Message = {
            id: userMessage.id + '-full',
            role: 'user',
            content: input.trim(),
            images: uploadedImageUrls,
            createdAt: userMessage.createdAt,
        };

        setMessages((prev) => {
            // 替换占位消息为完整消息
            const filtered = prev.filter((m) => m.id !== userMessage.id);
            return [...filtered, finalUserMessage, assistantMessage];
        });
        setPendingImages([]);
        setInput('');
        setLoading(true);
        setIsStreaming(true);
        
        streamingMessageIdRef.current = streamId;
        isStreamingRef.current = true;
        setExpandedThink((prev) => ({ ...prev, [streamId]: true }));
        setError('');

        // 通过 Socket.IO 流式发送
        const socket = socketRef.current || useSocketStore.getState().socket;
        if (socket) {
            socket.emit('ai_chat_stream', {
                message: input.trim(),
                images: uploadedImageBase64s,
                timezone: getUserTimezone(),
                conversationId: currentConversationId,
            }, (response: { success: boolean; conversationId?: string; error?: string }) => {
                if (!response.success) {
                    setMessages((prev) => {
                        const filtered = prev.filter((m) => m.id !== streamId);
                        return [
                            ...filtered,
                            { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: response.error || '发送失败' },
                        ];
                    });
                    isStreamingRef.current = false;
                    setIsStreaming(false);

                    streamingMessageIdRef.current = null;
                } else if (response.conversationId && !currentConversationId) {
                    setCurrentConversationId(response.conversationId);
                }
                // 注意：socket 路径的 reply 通过 ai_stream 事件和 done: true 来更新消息
                // 这里只处理 conversationId 状态，消息内容由 done: true 处理
                // setLoading(false) 也由 done: true 处理
            });
        } else {
            // fallback 到 REST API
            try {
                const res = await api.post('/ai-chat', {
                    message: userMessage.content,
                    timezone: getUserTimezone(),
                    conversationId: currentConversationId,
                });
                const { main, thinking } = parseAIResponse(res.data.reply);
                setMessages((prev) => {
                    const filtered = prev.filter((m) => m.id === streamId);
                    return [
                        ...filtered,
                        {
                            id: streamId,
                            role: 'assistant',
                            content: main,
                            thinking,
                            pendingTask: res.data.pendingTask,
                            taskCreated: res.data.taskCreated,
                            sources: res.data.sources || [],
                            createdAt: new Date().toISOString(),
                        },
                    ];
                });
                if (res.data.taskCreated) {
                    setTimeout(() => {
                        setMessages((prev) => [
                            ...prev,
                            { id: (Date.now() + 2).toString(), role: 'assistant' as const, content: '💡 你可以在「定时任务设置」页面查看和管理所有任务。' },
                        ]);
                    }, 1000);
                }
            } catch {
                setMessages((prev) => {
                    const filtered = prev.filter((m) => m.id === streamId);
                    return [...filtered, { id: (Date.now() + 1).toString(), role: 'assistant' as const, content: '发送失败，请重试' }];
                });
            } finally {
                isStreamingRef.current = false;
                setIsStreaming(false);
                setLoading(false);

                streamingMessageIdRef.current = null;
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        setPendingImages((prev) => [...prev, ...newFiles]);
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    const removePendingImage = (index: number) => {
        setPendingImages((prev) => prev.filter((_, i) => i !== index));
    };

    const drawerContent = (
        <Box sx={{ width: DRAWER_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={600}>对话列表</Typography>
            </Box>
            <Box sx={{ p: 1 }}>
                <ListItemButton
                    onClick={handleCreateConversation}
                    sx={{ borderRadius: 1, bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                    <ListItemIcon sx={{ minWidth: 36, color: 'white' }}>
                        <Add />
                    </ListItemIcon>
                    <ListItemText primary="新建对话" />
                </ListItemButton>
            </Box>
            <Divider />
            <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                {conversations.map((conv) => (
                    <ListItemButton
                        key={conv._id}
                        selected={conv._id === currentConversationId}
                        onClick={() => editingConvId !== conv._id && handleSelectConversation(conv._id)}
                        sx={{ 
                            borderRadius: 1, 
                            mb: 0.5,
                            '& .action-buttons': { opacity: 0, transition: 'opacity 0.2s' },
                            '&:hover .action-buttons': { opacity: 1 },
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                            <Chat fontSize="small" />
                        </ListItemIcon>
                        {editingConvId === conv._id ? (
                            <TextField
                                size="small"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => handleEditKeyPress(e, conv._id)}
                                onBlur={() => handleSaveEdit(conv._id)}
                                autoFocus
                                fullWidth
                                sx={{ mr: 1 }}
                            />
                        ) : (
                            <Tooltip title={conv.name} arrow>
                                <ListItemText
                                    primary={conv.name}
                                    secondary={conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString('zh-CN') : ''}
                                    primaryTypographyProps={{ noWrap: true }}
                                />
                            </Tooltip>
                        )}
                        {editingConvId !== conv._id && (
                            <Box className="action-buttons" sx={{ display: 'flex' }}>
                                <Tooltip title="重命名">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleStartEdit(conv, e)}
                                    >
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="删除">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleDeleteClick(conv._id, e)}
                                        sx={{ '&:hover': { color: 'error.main' } }}
                                    >
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}
                    </ListItemButton>
                ))}
                {conversations.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                        暂无对话
                    </Typography>
                )}
            </List>
            </Box>
    );

    return (
        <Box sx={{ height: '100vh', display: 'flex' }}>
            {/* Sidebar Drawer */}
            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    ModalProps={{ keepMounted: true }}
                >
                    {drawerContent}
                </Drawer>
            ) : (
                <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, position: 'relative' } }}>
                    {drawerContent}
                </Drawer>
            )}

            {/* Main Content */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
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
                        {isMobile && (
                            <IconButton onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
                                <Menu />
                            </IconButton>
                        )}
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
                                        {message.thinking && (
                                            <Box sx={{ mb: message.content ? 1 : 0 }}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        cursor: 'pointer',
                                                        color: 'text.secondary',
                                                        '&:hover': { color: 'primary.main' },
                                                    }}
                                                    onClick={() =>
                                                        setExpandedThink((prev) => ({
                                                            ...prev,
                                                            [message.id]: !prev[message.id],
                                                        }))
                                                    }
                                                >
                                                    {expandedThink[message.id] ? (
                                                        <ExpandLess fontSize="small" />
                                                    ) : (
                                                        <ExpandMore fontSize="small" />
                                                    )}
                                                    <Typography variant="caption">
                                                        {expandedThink[message.id] ? '隐藏思考过程' : '查看思考过程'}
                                                    </Typography>
                                                </Box>
                                                <Collapse in={expandedThink[message.id]}>
                                                    <Box
                                                        sx={{
                                                            mt: 1,
                                                            p: 1.5,
                                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                                            border: '1px solid',
                                                            borderColor: alpha(theme.palette.primary.main, 0.15),
                                                            borderRadius: 1,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ fontWeight: 600, color: 'primary.main', mb: 0.5, display: 'block', fontSize: '0.75rem' }}
                                                        >
                                                            💭 思考过程
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                color: 'text.secondary',
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-word',
                                                                fontSize: '0.75rem',
                                                            }}
                                                        >
                                                            {message.thinking}
                                                        </Typography>
                                                    </Box>
                                                </Collapse>
                                            </Box>
                                        )}
                                        {message.content ? (
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        ) : message.thinking ? null : (
                                            <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                                ...
                                            </Typography>
                                        )}
                                        {/* Render images in user messages */}
                                        {message.role === 'user' && message.images && message.images.length > 0 && (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                                {message.images.map((imgUrl, idx) => (
                                                    <Box
                                                        key={idx}
                                                        component="img"
                                                        src={imgUrl}
                                                        alt=""
                                                        sx={{
                                                            width: 120,
                                                            height: 120,
                                                            objectFit: 'cover',
                                                            borderRadius: 1,
                                                            cursor: 'pointer',
                                                        }}
                                                        onClick={() => window.open(imgUrl, '_blank')}
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                        {/* 引用来源面板 */}
                                        {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                                            <Box sx={{ mt: 1.5 }}>
                                                <Box
                                                    onClick={() => setExpandedSources((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        cursor: 'pointer',
                                                        py: 0.5,
                                                        px: 1,
                                                        borderRadius: 1,
                                                        bgcolor: alpha(theme.palette.info.main, 0.06),
                                                        '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.12) },
                                                    }}
                                                >
                                                    {expandedSources[message.id] ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                                                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.main', fontSize: '0.75rem' }}>
                                                        📚 参考来源 ({message.sources.length})
                                                    </Typography>
                                                </Box>
                                                <Collapse in={expandedSources[message.id]}>
                                                    <Box sx={{ mt: 0.5 }}>
                                                        {message.sources.map((src, idx) => (
                                                            <Box
                                                                key={idx}
                                                                sx={{
                                                                    py: 1,
                                                                    px: 1.5,
                                                                    borderBottom: idx < message.sources!.length - 1 ? '1px solid' : 'none',
                                                                    borderColor: 'divider',
                                                                }}
                                                            >
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                                    <Chip
                                                                        label={`[${idx + 1}]`}
                                                                        size="small"
                                                                        sx={{ height: 18, fontSize: '0.65rem', minWidth: 28 }}
                                                                    />
                                                                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.primary' }}>
                                                                        {src.documentName}
                                                                    </Typography>
                                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', ml: 'auto' }}>
                                                                        {Math.round((1 - src.similarity) * 100)}% 匹配
                                                                    </Typography>
                                                                </Box>
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{
                                                                        color: 'text.secondary',
                                                                        fontSize: '0.7rem',
                                                                        display: '-webkit-box',
                                                                        WebkitLineClamp: 3,
                                                                        WebkitBoxOrient: 'vertical',
                                                                        overflow: 'hidden',
                                                                        lineHeight: 1.5,
                                                                    }}
                                                                >
                                                                    {src.content}
                                                                </Typography>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                </Collapse>
                                            </Box>
                                        )}
                                        {message.createdAt && (
                                            <Typography 
                                                variant="caption" 
                                                sx={{ 
                                                    display: 'block', 
                                                    mt: 0.5, 
                                                    opacity: 0.6,
                                                    fontSize: '0.7rem',
                                                }}
                                            >
                                                {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        )}
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

                    {loading && !isStreaming && (
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
                {/* Hidden file input */}
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                />
                <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                    {/* Image preview chips */}
                    {pendingImages.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                            {pendingImages.map((file, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        position: 'relative',
                                        width: 64,
                                        height: 64,
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                    }}
                                >
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <IconButton
                                        size="small"
                                        onClick={() => removePendingImage(idx)}
                                        sx={{
                                            position: 'absolute',
                                            top: 2,
                                            right: 2,
                                            bgcolor: 'rgba(0,0,0,0.5)',
                                            color: 'white',
                                            p: 0.25,
                                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                                        }}
                                    >
                                        <Close sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                        {/* Image upload button */}
                        <IconButton
                            onClick={() => imageInputRef.current?.click()}
                            disabled={loading || isStreaming}
                            sx={{ flexShrink: 0 }}
                        >
                            <ImageIcon />
                        </IconButton>
                        <TextField
                            fullWidth
                            placeholder="输入消息... (说「创建定时任务」可以创建个性化任务)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading || isStreaming}
                            multiline
                            maxRows={4}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 2,
                                },
                            }}
                        />
                        <Box sx={{ flexShrink: 0 }}>
                            <AIProviderSelector />
                        </Box>
                        <IconButton
                            color="primary"
                            onClick={handleSend}
                            disabled={(!input.trim() && pendingImages.length === 0) || loading || isStreaming}
                            sx={{
                                flexShrink: 0,
                                bgcolor: 'primary.main',
                                color: 'white',
                                '&:hover': { bgcolor: 'primary.dark' },
                                '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
                            }}
                        >
                            <Send />
                        </IconButton>
                    </Box>
                </Box>
            </Paper>
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>确定要删除此对话吗？删除后无法恢复。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        删除
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AIChat;
