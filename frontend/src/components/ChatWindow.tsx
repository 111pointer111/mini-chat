import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, List, ListItem, ListItemSecondaryAction, ListItemText, Paper, Stack, TextField, Tooltip, Typography, Avatar } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { GitHub, MenuBook, Translate, AutoAwesome, ChatBubbleOutline, Groups, LibraryBooks, Upload, Link as LinkIcon, Delete, Refresh } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import {
    deleteGroupKBDocument,
    getGroupKBDocuments,
    importGroupKBFromUrl,
    uploadGroupKBDocument,
} from '../services/api';

interface ScheduledTaskMessageData {
    conversationId: string;
    taskType: string;
    message: Pick<Message, '_id' | 'content' | 'type' | 'createdAt'>;
}

interface KBDocument {
    id: number;
    title: string;
    source: 'local' | 'url';
    file_type: string | null;
    chunk_count: number;
    status: 'processing' | 'ready' | 'failed';
    error_msg: string | null;
    created_at: string;
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
    const {
        selectedFriend,
        selectedGroup,
        selectedTaskType,
        selectedTaskName,
        messages,
        addMessage,
        appendMessageContent,
        replaceMessage,
    } = useChatStore();
    const { user } = useAuthStore();
    const { socket } = useSocketStore();
    const [inputText, setInputText] = useState('');
    const [kbDrawerOpen, setKbDrawerOpen] = useState(false);
    const [kbDocuments, setKbDocuments] = useState<KBDocument[]>([]);
    const [kbLoading, setKbLoading] = useState(false);
    const [kbUploading, setKbUploading] = useState(false);
    const [kbMessage, setKbMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [urlTitle, setUrlTitle] = useState('');
    const [urlImporting, setUrlImporting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const groupKbFileInputRef = useRef<HTMLInputElement>(null);

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
        const handleGroupAiStart = (data: { groupId: string; message?: Message }) => {
            if (data.groupId === selectedGroup._id && data.message) {
                addMessage(data.message);
            }
        };
        const handleGroupAiChunk = (data: { groupId: string; tempMessageId: string; content: string }) => {
            if (data.groupId === selectedGroup._id) {
                appendMessageContent(data.tempMessageId, data.content);
            }
        };
        const handleGroupAiDone = (data: { groupId: string; tempMessageId: string; message?: Message }) => {
            if (data.groupId === selectedGroup._id && data.message) {
                replaceMessage(data.tempMessageId, data.message);
            }
        };
        const handleGroupAiError = (data: { groupId: string; tempMessageId: string; message?: Message }) => {
            if (data.groupId === selectedGroup._id && data.message) {
                replaceMessage(data.tempMessageId, data.message);
            }
        };

        socket.on('receive_group_message', handleReceiveGroupMessage);
        socket.on('group_ai_stream_start', handleGroupAiStart);
        socket.on('group_ai_stream_chunk', handleGroupAiChunk);
        socket.on('group_ai_stream_done', handleGroupAiDone);
        socket.on('group_ai_stream_error', handleGroupAiError);

        return () => {
            socket.off('receive_group_message', handleReceiveGroupMessage);
            socket.off('group_ai_stream_start', handleGroupAiStart);
            socket.off('group_ai_stream_chunk', handleGroupAiChunk);
            socket.off('group_ai_stream_done', handleGroupAiDone);
            socket.off('group_ai_stream_error', handleGroupAiError);
        };
    }, [socket, selectedGroup, addMessage, appendMessageContent, replaceMessage]);

    const loadGroupDocuments = useCallback(async () => {
        if (!selectedGroup) return;
        setKbLoading(true);
        try {
            const res = await getGroupKBDocuments(selectedGroup._id);
            setKbDocuments(res.data.documents || []);
            setKbMessage(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '获取群知识库失败';
            setKbMessage({ severity: 'error', text: msg });
        } finally {
            setKbLoading(false);
        }
    }, [selectedGroup]);

    useEffect(() => {
        if (kbDrawerOpen && selectedGroup) {
            loadGroupDocuments();
        }
    }, [kbDrawerOpen, selectedGroup, loadGroupDocuments]);

    const handleGroupKbUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedGroup) return;

        const formData = new FormData();
        formData.append('file', file);
        setKbUploading(true);
        setKbMessage(null);

        try {
            await uploadGroupKBDocument(selectedGroup._id, formData);
            setKbMessage({ severity: 'success', text: `文件“${file.name}”已上传并开始向量化。` });
            await loadGroupDocuments();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '上传失败';
            setKbMessage({ severity: 'error', text: msg });
        } finally {
            setKbUploading(false);
            if (groupKbFileInputRef.current) {
                groupKbFileInputRef.current.value = '';
            }
        }
    };

    const handleGroupUrlImport = async () => {
        if (!selectedGroup || !urlInput.trim()) return;

        setUrlImporting(true);
        setKbMessage(null);
        try {
            await importGroupKBFromUrl(selectedGroup._id, urlInput.trim(), urlTitle.trim() || undefined);
            setUrlDialogOpen(false);
            setUrlInput('');
            setUrlTitle('');
            setKbMessage({ severity: 'success', text: '链接已导入并开始向量化。' });
            await loadGroupDocuments();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '导入失败';
            setKbMessage({ severity: 'error', text: msg });
        } finally {
            setUrlImporting(false);
        }
    };

    const handleDeleteGroupDocument = async (documentId: number) => {
        if (!selectedGroup || !confirm('确定删除这个群知识库文档吗？')) return;
        try {
            await deleteGroupKBDocument(selectedGroup._id, documentId);
            await loadGroupDocuments();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除失败';
            setKbMessage({ severity: 'error', text: msg });
        }
    };

    const getStatusColor = (status: string) => {
        if (status === 'ready') return 'success';
        if (status === 'failed') return 'error';
        return 'warning';
    };

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
            }, (ack: { success: boolean; error?: string; messageId?: string; message?: Message }) => {
                if (!ack?.success) {
                    useChatStore.setState((state) => ({
                        messages: state.messages.filter((m) => m._id !== tempId),
                    }));
                    console.error('Failed to send group message:', ack?.error);
                } else if (ack?.message) {
                    replaceMessage(tempId, ack.message);
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
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6">{selectedGroup.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            输入 @小助手 可让群聊小助手基于群知识库回答
                        </Typography>
                    </Box>
                    <Tooltip title="群知识库">
                        <IconButton color="primary" onClick={() => setKbDrawerOpen(true)}>
                            <LibraryBooks />
                        </IconButton>
                    </Tooltip>
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

                <Drawer
                    anchor="right"
                    open={kbDrawerOpen}
                    onClose={() => setKbDrawerOpen(false)}
                    PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
                >
                    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                            <LibraryBooks color="primary" />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6">群知识库</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    @{`小助手`} 会优先检索这些文档
                                </Typography>
                            </Box>
                            <Tooltip title="刷新">
                                <IconButton onClick={loadGroupDocuments}>
                                    <Refresh />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                            <Button
                                variant="contained"
                                startIcon={kbUploading ? <CircularProgress size={16} color="inherit" /> : <Upload />}
                                onClick={() => groupKbFileInputRef.current?.click()}
                                disabled={kbUploading}
                            >
                                上传文件
                            </Button>
                            <input
                                ref={groupKbFileInputRef}
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.markdown,.json,.csv,.tsv,.log,image/*"
                                onChange={handleGroupKbUpload}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<LinkIcon />}
                                onClick={() => setUrlDialogOpen(true)}
                            >
                                导入链接
                            </Button>
                        </Stack>

                        {kbMessage && (
                            <Alert severity={kbMessage.severity} sx={{ mb: 2 }} onClose={() => setKbMessage(null)}>
                                {kbMessage.text}
                            </Alert>
                        )}

                        {kbLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <List sx={{ flex: 1, overflowY: 'auto' }}>
                                {kbDocuments.map((doc) => (
                                    <ListItem
                                        key={doc.id}
                                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 1, pr: 6 }}
                                    >
                                        <ListItemText
                                            primary={doc.title}
                                            secondary={
                                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                                                    <Chip label={doc.source === 'local' ? '文件' : '链接'} size="small" />
                                                    {doc.file_type && <Chip label={doc.file_type.toUpperCase()} size="small" variant="outlined" />}
                                                    <Chip label={`${doc.chunk_count} 片段`} size="small" variant="outlined" />
                                                    <Chip label={doc.status} size="small" color={getStatusColor(doc.status)} />
                                                    {doc.error_msg && (
                                                        <Typography variant="caption" color="error.main">
                                                            {doc.error_msg}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" color="error" onClick={() => handleDeleteGroupDocument(doc.id)}>
                                                <Delete />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                                {kbDocuments.length === 0 && (
                                    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                                        <LibraryBooks sx={{ fontSize: 42, opacity: 0.4, mb: 1 }} />
                                        <Typography>暂无群知识库文档</Typography>
                                    </Box>
                                )}
                            </List>
                        )}
                    </Box>
                </Drawer>

                <Dialog open={urlDialogOpen} onClose={() => setUrlDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>导入网页链接</DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            label="网页 URL"
                            placeholder="https://..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            sx={{ mt: 1, mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="标题（可选）"
                            value={urlTitle}
                            onChange={(e) => setUrlTitle(e.target.value)}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setUrlDialogOpen(false)}>取消</Button>
                        <Button variant="contained" onClick={handleGroupUrlImport} disabled={!urlInput.trim() || urlImporting}>
                            {urlImporting ? '导入中...' : '导入'}
                        </Button>
                    </DialogActions>
                </Dialog>
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
