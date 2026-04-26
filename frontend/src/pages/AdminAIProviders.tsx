import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    FormControlLabel,
    Chip,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    Add,
    Edit,
    Delete,
    ArrowBack,
    SmartToy,
    Star,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface AIProvider {
    _id: string;
    name: string;
    baseURL: string;
    modelName: string;
    embeddingApiKey?: string;
    embeddingModel?: string;
    embeddingBaseURL?: string;
    embeddingDimensions?: number;
    groupId?: string;
    enabled: boolean;
    isDefault: boolean;
    createdAt: string;
}

interface ProviderForm {
    name: string;
    baseURL: string;
    apiKey: string;
    modelName: string;
    embeddingApiKey: string;
    embeddingModel: string;
    embeddingBaseURL: string;
    embeddingDimensions: string;
    groupId: string;
    enabled: boolean;
    isDefault: boolean;
}

const initialForm: ProviderForm = {
    name: '',
    baseURL: '',
    apiKey: '',
    modelName: '',
    embeddingApiKey: '',
    embeddingModel: '',
    embeddingBaseURL: '',
    embeddingDimensions: '',
    groupId: '',
    enabled: true,
    isDefault: false,
};

const AdminAIProviders: React.FC = () => {
    const navigate = useNavigate();
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ProviderForm>(initialForm);
    const [saving, setSaving] = useState(false);

    const fetchProviders = async () => {
        try {
            const res = await api.get('/ai-providers/admin');
            setProviders(res.data);
            setError('');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number } };
            if (axiosErr.response?.status === 403) {
                setError('需要管理员权限');
            } else {
                setError('获取数据失败');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
    }, []);

    const handleOpenDialog = (provider?: AIProvider) => {
        if (provider) {
            setEditingId(provider._id);
            setForm({
                name: provider.name,
                baseURL: provider.baseURL,
                apiKey: '',
                modelName: provider.modelName,
                embeddingApiKey: '',
                embeddingModel: provider.embeddingModel || '',
                embeddingBaseURL: provider.embeddingBaseURL || '',
                embeddingDimensions: provider.embeddingDimensions ? String(provider.embeddingDimensions) : '',
                groupId: provider.groupId || '',
                enabled: provider.enabled,
                isDefault: provider.isDefault,
            });
        } else {
            setEditingId(null);
            setForm(initialForm);
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingId(null);
        setForm(initialForm);
    };

    const handleSave = async () => {
        if (!form.name || !form.baseURL || !form.modelName) {
            setError('请填写必填字段');
            return;
        }
        if (!editingId && !form.apiKey) {
            setError('请填写 API Key');
            return;
        }

        setSaving(true);
        try {
            const payload: Partial<ProviderForm> = { ...form };
            if (!payload.embeddingApiKey) {
                delete payload.embeddingApiKey;
            }

            if (editingId) {
                const updateData: Partial<ProviderForm> & { _id?: string } = { ...payload };
                if (!updateData.apiKey) {
                    delete updateData.apiKey;
                }
                await api.put(`/ai-providers/admin/${editingId}`, updateData);
            } else {
                await api.post('/ai-providers/admin', payload);
            }
            handleCloseDialog();
            fetchProviders();
            setError('');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此模型？')) return;
        try {
            await api.delete(`/ai-providers/admin/${id}`);
            fetchProviders();
        } catch (err: unknown) {
            console.error('Delete provider error:', err);
            setError('删除失败');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
                    <ArrowBack />
                </IconButton>
                <SmartToy sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h5" fontWeight={600}>
                    AI 模型管理
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                    sx={{ ml: 'auto' }}
                >
                    添加模型
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>名称</TableCell>
                            <TableCell>模型</TableCell>
                            <TableCell>Base URL</TableCell>
                            <TableCell>状态</TableCell>
                            <TableCell align="right">操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {providers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography color="text.secondary" sx={{ py: 4 }}>
                                        暂无 AI 模型，点击右上角添加
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            providers.map((provider) => (
                                <TableRow key={provider._id}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {provider.name}
                                            {provider.isDefault && (
                                                <Chip
                                                    icon={<Star sx={{ fontSize: 14 }} />}
                                                    label="默认"
                                                    size="small"
                                                    color="primary"
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{provider.modelName}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {provider.baseURL}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={provider.enabled ? '启用' : '禁用'}
                                            color={provider.enabled ? 'success' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton onClick={() => handleOpenDialog(provider)} size="small">
                                            <Edit />
                                        </IconButton>
                                        <IconButton onClick={() => handleDelete(provider._id)} size="small" color="error">
                                            <Delete />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingId ? '编辑模型' : '添加模型'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="名称"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                            placeholder="例如：GPT-4、Claude-3"
                        />
                        <TextField
                            label="Base URL"
                            value={form.baseURL}
                            onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
                            required
                            placeholder="例如：https://api.openai.com/v1"
                        />
                        <TextField
                            label="API Key"
                            type="password"
                            value={form.apiKey}
                            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                            required={!editingId}
                            placeholder={editingId ? '留空则不修改' : '输入 API Key'}
                            helperText={editingId ? '留空则保持原有 Key 不变' : ''}
                        />
                        <TextField
                            label="模型名称"
                            value={form.modelName}
                            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                            required
                            placeholder="例如：gpt-4、claude-3-sonnet-20240229"
                        />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                            以下为知识库 Embedding 配置（非必填）
                        </Typography>
                        <TextField
                            label="Embedding API Key"
                            type="password"
                            value={form.embeddingApiKey}
                            onChange={(e) => setForm({ ...form, embeddingApiKey: e.target.value })}
                            placeholder={editingId ? '留空则不修改' : '留空则复用上方 API Key'}
                            helperText="聊天模型和向量模型来自不同厂商时，在这里填写向量服务的 Key。"
                            size="small"
                        />
                        <TextField
                            label="Embedding 模型"
                            value={form.embeddingModel}
                            onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })}
                            placeholder="例如：embo-01、text-embedding-ada-002（留空自动使用 text-embedding-ada-002）"
                            size="small"
                        />
                        <TextField
                            label="Embedding Base URL"
                            value={form.embeddingBaseURL}
                            onChange={(e) => setForm({ ...form, embeddingBaseURL: e.target.value })}
                            placeholder="留空则自动从 Chat Base URL 推断"
                            size="small"
                        />
                        <TextField
                            label="Embedding 维度"
                            type="number"
                            value={form.embeddingDimensions}
                            onChange={(e) => setForm({ ...form, embeddingDimensions: e.target.value })}
                            placeholder="例如：1536"
                            size="small"
                            helperText="DashScope 的 text-embedding-v4 建议填 1536；留空则按模型默认值请求。"
                        />
                        <TextField
                            label="Group ID（Minimax 等需要）"
                            value={form.groupId}
                            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                            placeholder="如 Minimax 需要 group_id"
                            size="small"
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.enabled}
                                        onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                    />
                                }
                                label="启用"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.isDefault}
                                        onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                                    />
                                }
                                label="设为默认"
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>取消</Button>
                    <Button onClick={handleSave} variant="contained" disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : '保存'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminAIProviders;
