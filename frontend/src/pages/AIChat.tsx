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
} from '@mui/material';
import { ArrowBack, Send, SmartToy, Person, AutoAwesome, Add, Delete, Chat, Menu, Edit } from '@mui/icons-material';
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
    createdAt?: string;
}

interface Conversation {
    _id: string;
    name: string;
    lastMessageAt: string;
}

const DRAWER_WIDTH = 280;

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
                const historyMessages: Message[] = res.data.messages.map((msg: any) => ({
                    id: msg._id,
                    role: msg.sender === AI_ASSISTANT_ID ? 'assistant' : 'user',
                    content: msg.content,
                    createdAt: msg.createdAt,
                }));
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
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError('');

        try {
            const res = await api.post('/ai-chat', {
                message: userMessage.content,
                timezone: getUserTimezone(),
                conversationId: currentConversationId,
            });

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.data.reply,
                pendingTask: res.data.pendingTask,
                taskCreated: res.data.taskCreated,
                createdAt: new Date().toISOString(),
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
                            <ListItemText
                                primary={conv.name}
                                secondary={conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString('zh-CN') : ''}
                                primaryTypographyProps={{ noWrap: true }}
                            />
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
                                        <ReactMarkdown>{message.content}</ReactMarkdown>
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
                <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
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
                    <Box sx={{ flexShrink: 0 }}>
                        <AIProviderSelector />
                    </Box>
                    <IconButton
                        color="primary"
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
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
