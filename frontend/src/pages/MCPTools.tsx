import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    MenuItem,
    Paper,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    Add,
    ArrowBack,
    CheckCircle,
    Delete,
    Extension,
    Hub,
    Key,
    Lan,
    PowerSettingsNew,
    Refresh,
    Science,
    SettingsEthernet,
    WarningAmber,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    createMCPServer,
    deleteMCPServer,
    getMCPServers,
    refreshMCPServerTools,
    testMCPServer,
    updateMCPServer,
    type MCPHeaderInput,
    type MCPServerInput,
} from '../services/api';

interface MCPTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

interface MCPServer {
    _id: string;
    name: string;
    description?: string;
    transport: 'http' | 'sse';
    url: string;
    headers: Array<{ key: string; hasValue: boolean }>;
    enabled: boolean;
    cachedTools: MCPTool[];
    lastConnectedAt?: string;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
}

type AuthMode = 'none' | 'bearer' | 'custom';

interface FormState {
    name: string;
    description: string;
    transport: 'http' | 'sse';
    url: string;
    enabled: boolean;
    authMode: AuthMode;
    bearerToken: string;
    customHeaderKey: string;
    customHeaderValue: string;
    headersTouched: boolean;
}

const emptyForm: FormState = {
    name: '',
    description: '',
    transport: 'http',
    url: '',
    enabled: true,
    authMode: 'none',
    bearerToken: '',
    customHeaderKey: '',
    customHeaderValue: '',
    headersTouched: false,
};

const MCPTools: React.FC = () => {
    const navigate = useNavigate();
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MCPServer | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);

    const selectedServer = useMemo(
        () => servers.find((server) => server._id === selectedId) || servers[0],
        [servers, selectedId]
    );

    const enabledCount = servers.filter((server) => server.enabled).length;
    const toolCount = servers.reduce((count, server) => count + (server.cachedTools?.length || 0), 0);

    const loadServers = async () => {
        setLoading(true);
        try {
            const res = await getMCPServers();
            const nextServers = res.data.servers || [];
            setServers(nextServers);
            if (!selectedId && nextServers.length > 0) {
                setSelectedId(nextServers[0]._id);
            }
        } catch (err: unknown) {
            const text = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '加载 MCP 服务失败';
            setMessage({ severity: 'error', text });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServers();
    }, []);

    const openCreateDialog = () => {
        setEditingServer(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEditDialog = (server: MCPServer) => {
        setEditingServer(server);
        setForm({
            name: server.name,
            description: server.description || '',
            transport: server.transport,
            url: server.url,
            enabled: server.enabled,
            authMode: 'none',
            bearerToken: '',
            customHeaderKey: '',
            customHeaderValue: '',
            headersTouched: false,
        });
        setDialogOpen(true);
    };

    const getHeadersFromForm = (): MCPHeaderInput[] | undefined => {
        if (form.authMode === 'bearer') {
            return form.bearerToken.trim()
                ? [{ key: 'Authorization', value: `Bearer ${form.bearerToken.trim()}` }]
                : [];
        }

        if (form.authMode === 'custom') {
            return form.customHeaderKey.trim() && form.customHeaderValue
                ? [{ key: form.customHeaderKey.trim(), value: form.customHeaderValue }]
                : [];
        }

        return [];
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.url.trim()) return;

        setActionLoading('save');
        setMessage(null);
        try {
            const payload: MCPServerInput | Partial<MCPServerInput> = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                transport: form.transport,
                url: form.url.trim(),
                enabled: form.enabled,
            };

            if (!editingServer || form.headersTouched) {
                payload.headers = getHeadersFromForm();
            }

            if (editingServer) {
                const res = await updateMCPServer(editingServer._id, payload);
                setServers((prev) => prev.map((server) => server._id === editingServer._id ? res.data.server : server));
                setSelectedId(editingServer._id);
                setMessage({ severity: 'success', text: 'MCP 服务已更新' });
            } else {
                const res = await createMCPServer(payload as MCPServerInput);
                setServers((prev) => [res.data.server, ...prev]);
                setSelectedId(res.data.server._id);
                setMessage({ severity: 'success', text: 'MCP 服务已添加，可以测试连接并刷新工具' });
            }

            setDialogOpen(false);
        } catch (err: unknown) {
            const text = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '保存 MCP 服务失败';
            setMessage({ severity: 'error', text });
        } finally {
            setActionLoading(null);
        }
    };

    const updateServerInList = (server: MCPServer) => {
        setServers((prev) => prev.map((item) => item._id === server._id ? server : item));
        setSelectedId(server._id);
    };

    const handleTest = async (server: MCPServer) => {
        setActionLoading(`test:${server._id}`);
        setMessage(null);
        try {
            const res = await testMCPServer(server._id);
            updateServerInList(res.data.server);
            setMessage({
                severity: res.data.success ? 'success' : 'error',
                text: res.data.success
                    ? `连接成功，发现 ${res.data.toolCount} 个工具`
                    : res.data.error || '连接失败',
            });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefreshTools = async (server: MCPServer) => {
        setActionLoading(`refresh:${server._id}`);
        setMessage(null);
        try {
            const res = await refreshMCPServerTools(server._id);
            updateServerInList(res.data.server);
            setMessage({ severity: 'success', text: `已刷新 ${res.data.tools.length} 个工具` });
        } catch (err: unknown) {
            const text = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '刷新工具失败';
            setMessage({ severity: 'error', text });
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleEnabled = async (server: MCPServer) => {
        setActionLoading(`toggle:${server._id}`);
        try {
            const res = await updateMCPServer(server._id, { enabled: !server.enabled });
            updateServerInList(res.data.server);
        } catch (err: unknown) {
            const text = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '更新状态失败';
            setMessage({ severity: 'error', text });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setActionLoading('delete');
        try {
            await deleteMCPServer(deleteTarget._id);
            setServers((prev) => prev.filter((server) => server._id !== deleteTarget._id));
            if (selectedId === deleteTarget._id) {
                setSelectedId('');
            }
            setDeleteTarget(null);
            setMessage({ severity: 'success', text: 'MCP 服务已删除' });
        } catch (err: unknown) {
            const text = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除失败';
            setMessage({ severity: 'error', text });
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (date?: string) => {
        if (!date) return '尚未连接';
        return new Date(date).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const setAuthMode = (authMode: AuthMode) => {
        setForm((prev) => ({ ...prev, authMode, headersTouched: true }));
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={1} sx={{ p: 2, px: { xs: 1, sm: 3 }, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: { xs: 0, sm: 1 } }}>
                    <ArrowBack />
                </IconButton>
                <Hub color="primary" />
                <Box>
                    <Typography variant="h6" fontWeight="bold">MCP 工具</Typography>
                    <Typography variant="caption" color="text.secondary">
                        管理当前账号可用的外部工具服务
                    </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Chip icon={<PowerSettingsNew />} label={`${enabledCount} 个已启用`} color="primary" variant="outlined" />
                <Chip icon={<Extension />} label={`${toolCount} 个工具`} color="secondary" variant="outlined" />
                <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
                    添加服务
                </Button>
            </Paper>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', p: 2 }}>
                {message && (
                    <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
                        {message.text}
                    </Alert>
                )}

                <Box sx={{ height: '100%', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px 1fr' }, gap: 2 }}>
                    <Paper sx={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2 }}>
                            <Avatar sx={{ width: 36, height: 36 }}>
                                <SettingsEthernet />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography fontWeight={700}>已注册服务</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    AI 只会加载已启用服务中的缓存工具
                                </Typography>
                            </Box>
                            <Tooltip title="刷新列表">
                                <IconButton onClick={loadServers}>
                                    <Refresh />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                        <Divider />

                        {loading ? (
                            <Box sx={{ py: 6, textAlign: 'center' }}>
                                <CircularProgress />
                            </Box>
                        ) : servers.length === 0 ? (
                            <Box sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
                                <Lan sx={{ fontSize: 44, mb: 1, opacity: 0.5 }} />
                                <Typography fontWeight={600} color="text.primary">还没有 MCP 服务</Typography>
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    添加一个远程 MCP endpoint，让 AI 可以调用它暴露的工具。
                                </Typography>
                                <Button sx={{ mt: 2 }} variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
                                    添加服务
                                </Button>
                            </Box>
                        ) : (
                            <List sx={{ overflow: 'auto', py: 1 }}>
                                {servers.map((server) => {
                                    const selected = selectedServer?._id === server._id;
                                    return (
                                        <ListItem key={server._id} disablePadding sx={{ px: 1, mb: 0.5 }}>
                                            <ListItemButton
                                                selected={selected}
                                                onClick={() => setSelectedId(server._id)}
                                                sx={{
                                                    alignItems: 'flex-start',
                                                    transition: 'transform 0.16s ease, background-color 0.16s ease',
                                                    '&:hover': { transform: 'translateX(2px)' },
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Typography fontWeight={700} noWrap>{server.name}</Typography>
                                                            <Chip
                                                                size="small"
                                                                label={server.enabled ? '启用' : '停用'}
                                                                color={server.enabled ? 'success' : 'default'}
                                                            />
                                                        </Stack>
                                                    }
                                                    secondary={
                                                        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                                            <Typography variant="caption" color="text.secondary" noWrap>
                                                                {server.url}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                                                <Chip size="small" label={server.transport.toUpperCase()} variant="outlined" />
                                                                <Chip size="small" label={`${server.cachedTools?.length || 0} tools`} variant="outlined" />
                                                                {server.lastError && (
                                                                    <Chip size="small" icon={<WarningAmber />} color="error" label="连接异常" />
                                                                )}
                                                            </Stack>
                                                        </Stack>
                                                    }
                                                />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        )}
                    </Paper>

                    <Paper sx={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {!selectedServer ? (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                                <Typography>选择或添加一个 MCP 服务</Typography>
                            </Box>
                        ) : (
                            <>
                                <Box sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                    <Avatar sx={{ width: 48, height: 48 }}>
                                        {selectedServer.lastError ? <WarningAmber /> : <CheckCircle />}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                            <Typography variant="h6" fontWeight={800}>{selectedServer.name}</Typography>
                                            <Chip
                                                label={selectedServer.enabled ? 'AI 对话中可用' : '已停用'}
                                                color={selectedServer.enabled ? 'success' : 'default'}
                                                size="small"
                                            />
                                            <Chip label={selectedServer.transport.toUpperCase()} size="small" variant="outlined" />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {selectedServer.description || '这个服务还没有描述。'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }} noWrap>
                                            {selectedServer.url}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title={selectedServer.enabled ? '停用' : '启用'}>
                                            <IconButton
                                                onClick={() => handleToggleEnabled(selectedServer)}
                                                disabled={Boolean(actionLoading)}
                                                color={selectedServer.enabled ? 'success' : 'default'}
                                            >
                                                <PowerSettingsNew />
                                            </IconButton>
                                        </Tooltip>
                                        <Button onClick={() => openEditDialog(selectedServer)}>编辑</Button>
                                        <Tooltip title="删除">
                                            <IconButton color="error" onClick={() => setDeleteTarget(selectedServer)}>
                                                <Delete />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Box>

                                <Divider />

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2, bgcolor: alpha('#6366f1', 0.04) }}>
                                    <Chip
                                        icon={selectedServer.lastError ? <WarningAmber /> : <CheckCircle />}
                                        label={selectedServer.lastError ? '最近连接失败' : `最近连接：${formatDate(selectedServer.lastConnectedAt)}`}
                                        color={selectedServer.lastError ? 'error' : 'success'}
                                        variant="outlined"
                                    />
                                    {selectedServer.headers?.some((header) => header.hasValue) && (
                                        <Chip icon={<Key />} label="已配置认证 Header" variant="outlined" />
                                    )}
                                    <Box sx={{ flex: 1 }} />
                                    <Button
                                        startIcon={<Science />}
                                        onClick={() => handleTest(selectedServer)}
                                        disabled={Boolean(actionLoading)}
                                    >
                                        {actionLoading === `test:${selectedServer._id}` ? '测试中...' : '测试连接'}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={<Refresh />}
                                        onClick={() => handleRefreshTools(selectedServer)}
                                        disabled={Boolean(actionLoading)}
                                    >
                                        {actionLoading === `refresh:${selectedServer._id}` ? '刷新中...' : '刷新工具'}
                                    </Button>
                                </Stack>

                                {selectedServer.lastError && (
                                    <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
                                        {selectedServer.lastError}
                                    </Alert>
                                )}

                                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                    <Typography fontWeight={800} sx={{ mb: 1.5 }}>
                                        工具清单
                                    </Typography>

                                    {selectedServer.cachedTools?.length ? (
                                        <Stack spacing={1}>
                                            {selectedServer.cachedTools.map((tool) => (
                                                <Box
                                                    key={tool.name}
                                                    sx={{
                                                        p: 1.5,
                                                        borderRadius: 2,
                                                        bgcolor: alpha('#ffffff', 0.62),
                                                        border: '1px solid',
                                                        borderColor: alpha('#6366f1', 0.16),
                                                        transition: 'transform 0.16s ease, border-color 0.16s ease',
                                                        '&:hover': {
                                                            transform: 'translateY(-1px)',
                                                            borderColor: alpha('#6366f1', 0.35),
                                                        },
                                                    }}
                                                >
                                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography fontWeight={700}>{tool.name}</Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {tool.description || '没有工具描述'}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            size="small"
                                                            label={`${Object.keys((tool.inputSchema?.properties as Record<string, unknown>) || {}).length} 个参数`}
                                                            variant="outlined"
                                                        />
                                                    </Stack>
                                                </Box>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                                            <Extension sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                                            <Typography fontWeight={700} color="text.primary">还没有缓存工具</Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                测试连接或刷新工具后，AI 才能在对话中看到这些工具。
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </>
                        )}
                    </Paper>
                </Box>
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingServer ? '编辑 MCP 服务' : '添加 MCP 服务'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="名称"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                            required
                        />
                        <TextField
                            label="描述"
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                        <TextField
                            select
                            label="传输方式"
                            value={form.transport}
                            onChange={(e) => setForm((prev) => ({ ...prev, transport: e.target.value as 'http' | 'sse' }))}
                            fullWidth
                        >
                            <MenuItem value="http">Streamable HTTP</MenuItem>
                            <MenuItem value="sse">SSE</MenuItem>
                        </TextField>
                        <TextField
                            label="MCP Server URL"
                            placeholder="https://example.com/mcp"
                            value={form.url}
                            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                            fullWidth
                            required
                        />
                        <TextField
                            select
                            label="认证方式"
                            value={form.authMode}
                            onChange={(e) => setAuthMode(e.target.value as AuthMode)}
                            fullWidth
                            helperText={editingServer && !form.headersTouched ? '不修改认证方式时会保留原有 Header' : undefined}
                        >
                            <MenuItem value="none">无认证</MenuItem>
                            <MenuItem value="bearer">Bearer Token</MenuItem>
                            <MenuItem value="custom">自定义 Header</MenuItem>
                        </TextField>
                        {form.authMode === 'bearer' && (
                            <TextField
                                label="Bearer Token"
                                type="password"
                                value={form.bearerToken}
                                onChange={(e) => setForm((prev) => ({ ...prev, bearerToken: e.target.value, headersTouched: true }))}
                                fullWidth
                            />
                        )}
                        {form.authMode === 'custom' && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                <TextField
                                    label="Header 名称"
                                    value={form.customHeaderKey}
                                    onChange={(e) => setForm((prev) => ({ ...prev, customHeaderKey: e.target.value, headersTouched: true }))}
                                    fullWidth
                                />
                                <TextField
                                    label="Header 值"
                                    type="password"
                                    value={form.customHeaderValue}
                                    onChange={(e) => setForm((prev) => ({ ...prev, customHeaderValue: e.target.value, headersTouched: true }))}
                                    fullWidth
                                />
                            </Stack>
                        )}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={form.enabled}
                                    onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                                />
                            }
                            label="启用后，AI 对话会加载这个服务的工具"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>取消</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!form.name.trim() || !form.url.trim() || actionLoading === 'save'}
                    >
                        {actionLoading === 'save' ? '保存中...' : '保存'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>删除 MCP 服务</DialogTitle>
                <DialogContent>
                    <Typography>
                        确定删除「{deleteTarget?.name}」吗？删除后 AI 将无法再调用它的工具。
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>取消</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={actionLoading === 'delete'}>
                        删除
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MCPTools;
