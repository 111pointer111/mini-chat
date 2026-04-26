import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Paper, Typography, Button, IconButton, List, ListItem,
    ListItemText, ListItemSecondaryAction, Chip, CircularProgress,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    Alert, Tooltip, Avatar,
    InputAdornment, Stack, LinearProgress,
} from '@mui/material';
import {
    Upload as UploadIcon,
    Delete as DeleteIcon,
    Link as LinkIcon,
    Search as SearchIcon,
    Article as ArticleIcon,
    Refresh as RefreshIcon,
    SmartToy as SmartToyIcon,
    Folder as FolderIcon,
    ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    getKBDocuments,
    deleteKBDocument,
    uploadKBDocument,
    importKBFromUrl,
    searchKB,
} from '../services/api';

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

const KB_FILE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.markdown,.json,.csv,.tsv,.log,image/*';

const FILE_TYPE_ICONS: Record<string, string> = {
    pdf: '📄',
    docx: '📝',
    doc: '📝',
    pptx: '📊',
    ppt: '📊',
    xlsx: '📋',
    xls: '📋',
    txt: '📃',
    md: '📃',
    image: '🖼️',
    url: '🔗',
    text: '📃',
};

const KnowledgeBase: React.FC = () => {
    const navigate = useNavigate();

    // ---- 文档管理状态 ----
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<KBDocument[]>([]);
    const [, setSearching] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; doc: KBDocument | null }>({ open: false, doc: null });
    const [urlDialog, setUrlDialog] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [urlTitle, setUrlTitle] = useState('');
    const [urlLoading, setUrlLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ==================== 文档管理 ====================

    const loadDocuments = async (pg = 1) => {
        setLoading(true);
        try {
            const res = await getKBDocuments(pg, 20);
            setDocuments(res.data.documents);
            setTotal(res.data.pagination.total);
            setPage(pg);
        } catch (err) {
            console.error('加载文档失败', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleSearch = async (keyword: string) => {
        setSearchKeyword(keyword);
        if (!keyword.trim()) {
            setSearchResults([]);
            loadDocuments();
            return;
        }
        setSearching(true);
        try {
            const res = await searchKB(keyword);
            setSearchResults(res.data.documents || []);
        } catch (err) {
            console.error('搜索失败', err);
        } finally {
            setSearching(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 50 * 1024 * 1024) {
            setUploadMessage({ severity: 'error', text: '文件不能超过 50MB' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploadProgress(true);
        setUploadMessage(null);
        try {
            await uploadKBDocument(formData);
            await loadDocuments();
            setUploadMessage({ severity: 'success', text: `文件“${file.name}”上传成功，知识库正在处理中。` });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '上传失败';
            setUploadMessage({ severity: 'error', text: msg });
            await loadDocuments();
        } finally {
            setUploadProgress(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUrlImport = async () => {
        if (!urlInput.trim()) return;
        setUrlLoading(true);
        try {
            await importKBFromUrl(urlInput, urlTitle || undefined);
            setUrlDialog(false);
            setUrlInput('');
            setUrlTitle('');
            await loadDocuments();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '导入失败';
            alert(msg);
        } finally {
            setUrlLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog.doc) return;
        try {
            await deleteKBDocument(deleteDialog.doc.id);
            await loadDocuments();
        } catch (err) {
            console.error('删除失败', err);
        }
        setDeleteDialog({ open: false, doc: null });
    };

    const displayDocs = searchKeyword ? searchResults : documents;

    const getFileIcon = (type: string | null) => {
        if (!type) return '📄';
        return FILE_TYPE_ICONS[type.toLowerCase()] || '📄';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
    };

    const getStatusColor = (status: string) => {
        if (status === 'ready') return 'success';
        if (status === 'failed') return 'error';
        return 'warning';
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* 顶部栏 */}
            <Paper elevation={1} sx={{ p: 2, px: { xs: 1, sm: 3 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: { xs: 0, sm: 1 } }}>
                    <ArrowBack />
                </IconButton>
                <SmartToyIcon color="primary" />
                <Typography variant="h6" fontWeight="bold">知识库</Typography>
                <Box sx={{ flex: 1 }} />
                <Chip icon={<FolderIcon />} label="文档管理" color="primary" variant="outlined" />
            </Paper>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                    {/* 操作栏 */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<UploadIcon />}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadProgress}
                        >
                            {uploadProgress ? '处理中...' : '上传文件'}
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            accept={KB_FILE_ACCEPT}
                            onChange={handleUpload}
                        />
                        <Button
                            variant="outlined"
                            startIcon={<LinkIcon />}
                            onClick={() => setUrlDialog(true)}
                        >
                            添加链接
                        </Button>
                        <TextField
                            size="small"
                            placeholder="搜索文档..."
                            value={searchKeyword}
                            onChange={e => handleSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flex: 1, maxWidth: 300 }}
                        />
                        <Tooltip title="刷新">
                            <IconButton onClick={() => { setSearchKeyword(''); setSearchResults([]); loadDocuments(); }}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    {uploadProgress && <LinearProgress sx={{ mb: 2 }} />}
                    {uploadMessage && (
                        <Alert severity={uploadMessage.severity} sx={{ mb: 2 }}>
                            {uploadMessage.text}
                        </Alert>
                    )}

                    {/* 文档列表 */}
                    {loading ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : displayDocs.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                            <ArticleIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                            <Typography>{searchKeyword ? '未找到匹配的文档' : '暂无文档，上传或导入开始构建知识库'}</Typography>
                        </Box>
                    ) : (
                        <List>
                            {displayDocs.map((doc) => (
                                <ListItem key={doc.id} sx={{ mb: 1, bgcolor: 'background.paper', borderRadius: 2 }}>
                                    <Avatar sx={{ mr: 2, bgcolor: 'primary.light' }}>
                                        {getFileIcon(doc.file_type)}
                                    </Avatar>
                                    <ListItemText
                                        primary={doc.title}
                                        secondary={
                                            <Stack direction="row" spacing={1} alignItems="center" mt={0.5} flexWrap="wrap" useFlexGap>
                                                <Chip label={doc.source === 'local' ? '本地文件' : '网页链接'} size="small" />
                                                {doc.file_type && <Chip label={doc.file_type.toUpperCase()} size="small" variant="outlined" />}
                                                <Chip label={`${doc.chunk_count} 个片段`} size="small" variant="outlined" />
                                                <Chip label={doc.status} size="small" color={getStatusColor(doc.status)} />
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDate(doc.created_at)}
                                                </Typography>
                                                {doc.status === 'failed' && doc.error_msg && (
                                                    <Typography variant="caption" color="error.main">
                                                        {doc.error_msg}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            color="error"
                                            onClick={() => setDeleteDialog({ open: true, doc })}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}

                    {/* 分页 */}
                    {!searchKeyword && total > 20 && (
                        <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 2 }}>
                            <Button size="small" disabled={page <= 1} onClick={() => loadDocuments(page - 1)}>上一页</Button>
                            <Typography sx={{ lineHeight: '32px' }}>{page} / {Math.ceil(total / 20)}</Typography>
                            <Button size="small" disabled={page >= Math.ceil(total / 20)} onClick={() => loadDocuments(page + 1)}>下一页</Button>
                        </Stack>
                    )}
            </Box>

            {/* 删除确认弹窗 */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, doc: null })}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>确定要删除文档「{deleteDialog.doc?.title}」吗？此操作不可恢复。</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, doc: null })}>取消</Button>
                    <Button onClick={handleDelete} color="error" variant="contained">删除</Button>
                </DialogActions>
            </Dialog>

            {/* URL 导入弹窗 */}
            <Dialog open={urlDialog} onClose={() => setUrlDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>从链接导入</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="网页 URL"
                        placeholder="https://..."
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        sx={{ mt: 1, mb: 1 }}
                    />
                    <TextField
                        fullWidth
                        label="文档标题（可选）"
                        placeholder="不填则自动提取"
                        value={urlTitle}
                        onChange={e => setUrlTitle(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUrlDialog(false)}>取消</Button>
                    <Button onClick={handleUrlImport} variant="contained" disabled={!urlInput.trim() || urlLoading}>
                        {urlLoading ? '导入中...' : '导入'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default KnowledgeBase;
