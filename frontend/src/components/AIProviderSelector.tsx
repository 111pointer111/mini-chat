import React, { useEffect, useState } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Typography,
    Chip,
} from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import api from '../services/api';

interface AIProvider {
    _id: string;
    name: string;
    modelName: string;
    isDefault: boolean;
}

interface AIProviderSelectorProps {
    compact?: boolean;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({ compact = false }) => {
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [providersRes, userProviderRes] = await Promise.all([
                    api.get('/ai-providers'),
                    api.get('/ai-providers/user'),
                ]);
                setProviders(providersRes.data);
                if (userProviderRes.data.provider) {
                    setSelectedProvider(userProviderRes.data.provider._id);
                } else if (providersRes.data.length > 0) {
                    const defaultProvider = providersRes.data.find((p: AIProvider) => p.isDefault);
                    setSelectedProvider(defaultProvider?._id || providersRes.data[0]._id);
                }
            } catch (error) {
                console.error('Failed to fetch AI providers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChange = async (providerId: string) => {
        setUpdating(true);
        try {
            await api.put('/ai-providers/user', { providerId });
            setSelectedProvider(providerId);
        } catch (error) {
            console.error('Failed to update AI provider:', error);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                {!compact && <Typography variant="body2">加载中...</Typography>}
            </Box>
        );
    }

    if (providers.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                暂无可用模型
            </Typography>
        );
    }

    const currentProvider = providers.find((p) => p._id === selectedProvider);

    if (compact) {
        return (
            <Chip
                icon={<SmartToy sx={{ fontSize: 16 }} />}
                label={currentProvider?.name || '选择模型'}
                size="small"
                onClick={() => {}}
                sx={{ cursor: 'default' }}
            />
        );
    }

    return (
        <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="ai-provider-label">AI 模型</InputLabel>
            <Select
                labelId="ai-provider-label"
                value={selectedProvider}
                label="AI 模型"
                onChange={(e) => handleChange(e.target.value)}
                disabled={updating}
            >
                {providers.map((provider) => (
                    <MenuItem key={provider._id} value={provider._id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SmartToy sx={{ fontSize: 18, color: 'primary.main' }} />
                            <Box>
                                <Typography variant="body2">{provider.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {provider.modelName}
                                </Typography>
                            </Box>
                            {provider.isDefault && (
                                <Chip label="默认" size="small" sx={{ ml: 1, height: 20 }} />
                            )}
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};

export default AIProviderSelector;
