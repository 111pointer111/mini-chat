import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Switch,
    Select,
    MenuItem,
    Paper,
    CircularProgress,
    Alert,
    IconButton,
    Chip,
    alpha,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
} from '@mui/material';
import { ArrowBack, GitHub, MenuBook, Translate, AccessTime, NotificationsActive, Delete, AutoAwesome } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface PresetTask {
    _id?: string;
    taskType: string;
    taskName: string;
    enabled: boolean;
    pushTime: string;
    conversationId?: string;
    isCustom: false;
}

interface CustomTask {
    _id: string;
    taskType: 'custom';
    taskName: string;
    prompt?: string;
    enabled: boolean;
    pushTime: string;
    conversationId?: string;
    isCustom: true;
}

interface TasksResponse {
    presetTasks: PresetTask[];
    customTasks: CustomTask[];
}

const TASK_CONFIG: Record<string, { icon: React.ReactNode; color: string; gradient: string; description: string }> = {
    github_trending: {
        icon: <GitHub sx={{ fontSize: 28 }} />,
        color: '#24292e',
        gradient: 'linear-gradient(135deg, #24292e 0%, #586069 100%)',
        description: 'AI 分析 GitHub 热门开源项目趋势',
    },
    daily_poem: {
        icon: <MenuBook sx={{ fontSize: 28 }} />,
        color: '#d4380d',
        gradient: 'linear-gradient(135deg, #d4380d 0%, #fa8c16 100%)',
        description: '每日精选古诗词，附带 AI 赏析解读',
    },
    daily_english: {
        icon: <Translate sx={{ fontSize: 28 }} />,
        color: '#1890ff',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
        description: '英文名言好句，翻译解析助力学习',
    },
    custom: {
        icon: <AutoAwesome sx={{ fontSize: 28 }} />,
        color: '#722ed1',
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        description: '自定义内容推送',
    },
};

// Generate time options (every minute for precise testing)
const TIME_OPTIONS = Array.from({ length: 24 * 60 }, (_, i) => {
    const hour = Math.floor(i / 60);
    const minute = i % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

type TaskItem = PresetTask | CustomTask;

const TaskCard: React.FC<{
    task: TaskItem;
    updating: boolean;
    onToggle: (enabled: boolean) => void;
    onTimeChange: (time: string) => void;
    onDelete?: () => void;
}> = ({ task, updating, onToggle, onTimeChange, onDelete }) => {
    const config = TASK_CONFIG[task.taskType] || TASK_CONFIG.custom;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Paper
                elevation={0}
                sx={{
                    mb: 2,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: task.enabled ? alpha(config.color, 0.3) : 'divider',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        borderColor: alpha(config.color, 0.5),
                        boxShadow: `0 4px 20px ${alpha(config.color, 0.15)}`,
                    },
                }}
            >
                {/* Header with gradient */}
                <Box
                    sx={{
                        background: task.enabled ? config.gradient : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.3s ease',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                bgcolor: 'rgba(255,255,255,0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: config.color,
                            }}
                        >
                            {config.icon}
                        </Box>
                        <Box>
                            <Typography
                                variant="h6"
                                sx={{
                                    color: task.enabled ? 'white' : 'text.primary',
                                    fontWeight: 600,
                                    fontSize: '1.1rem',
                                }}
                            >
                                {task.taskName}
                            </Typography>
                            {task.enabled && (
                                <Chip
                                    icon={<NotificationsActive sx={{ fontSize: 14 }} />}
                                    label="已启用"
                                    size="small"
                                    sx={{
                                        mt: 0.5,
                                        bgcolor: 'rgba(255,255,255,0.2)',
                                        color: 'white',
                                        '& .MuiChip-icon': { color: 'white' },
                                        height: 22,
                                        fontSize: '0.75rem',
                                    }}
                                />
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {task.isCustom && onDelete && (
                            <IconButton
                                size="small"
                                onClick={onDelete}
                                sx={{ color: task.enabled ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        )}
                        <Switch
                            checked={task.enabled}
                            onChange={(e) => onToggle(e.target.checked)}
                            disabled={updating}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: 'white',
                                },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    bgcolor: 'rgba(255,255,255,0.5)',
                                },
                            }}
                        />
                    </Box>
                </Box>

                {/* Content */}
                <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {task.isCustom && (task as CustomTask).prompt 
                            ? (task as CustomTask).prompt!.substring(0, 100) + '...'
                            : config.description}
                    </Typography>

                    <AnimatePresence>
                        {task.enabled && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        p: 1.5,
                                        bgcolor: alpha(config.color, 0.05),
                                        borderRadius: 2,
                                    }}
                                >
                                    <AccessTime sx={{ color: config.color, fontSize: 20 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        每日推送时间
                                    </Typography>
                                    <Select
                                        size="small"
                                        value={task.pushTime}
                                        onChange={(e) => onTimeChange(e.target.value)}
                                        disabled={updating}
                                        sx={{
                                            ml: 'auto',
                                            minWidth: 90,
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: alpha(config.color, 0.3),
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: config.color,
                                            },
                                        }}
                                    >
                                        {TIME_OPTIONS.map((time) => (
                                            <MenuItem key={time} value={time}>
                                                {time}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {updating && <CircularProgress size={20} />}
                                </Box>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>
            </Paper>
        </motion.div>
    );
};

const ScheduledTasks: React.FC = () => {
    const navigate = useNavigate();
    const [presetTasks, setPresetTasks] = useState<PresetTask[]>([]);
    const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<CustomTask | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await api.get<TasksResponse>('/scheduled-tasks');
            setPresetTasks(res.data.presetTasks);
            setCustomTasks(res.data.customTasks);
        } catch (err) {
            setError('获取任务列表失败');
        } finally {
            setLoading(false);
        }
    };

    const getUserTimezone = () => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    };

    const handlePresetToggle = async (taskType: string, enabled: boolean) => {
        setUpdating(taskType);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/${taskType}`, { enabled, timezone });
            setPresetTasks((prev) =>
                prev.map((t) => (t.taskType === taskType ? { ...res.data, isCustom: false as const } : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handlePresetTimeChange = async (taskType: string, pushTime: string) => {
        setUpdating(taskType);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/${taskType}`, { pushTime, timezone });
            setPresetTasks((prev) =>
                prev.map((t) => (t.taskType === taskType ? { ...res.data, isCustom: false as const } : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handleCustomToggle = async (taskId: string, enabled: boolean) => {
        setUpdating(taskId);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/custom/${taskId}`, { enabled, timezone });
            setCustomTasks((prev) =>
                prev.map((t) => (t._id === taskId ? { ...res.data, isCustom: true as const } : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handleCustomTimeChange = async (taskId: string, pushTime: string) => {
        setUpdating(taskId);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/custom/${taskId}`, { pushTime, timezone });
            setCustomTasks((prev) =>
                prev.map((t) => (t._id === taskId ? { ...res.data, isCustom: true as const } : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handleDeleteClick = (task: CustomTask) => {
        setTaskToDelete(task);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!taskToDelete) return;
        
        try {
            await api.delete(`/scheduled-tasks/custom/${taskToDelete._id}`);
            setCustomTasks((prev) => prev.filter((t) => t._id !== taskToDelete._id));
            setDeleteDialogOpen(false);
            setTaskToDelete(null);
        } catch (err) {
            setError('删除失败');
        }
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    bgcolor: '#f8f9fa',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                pb: 4,
            }}
        >
            {/* Header */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 0,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    bgcolor: 'white',
                }}
            >
                <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => navigate(-1)} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <Typography variant="h6" fontWeight={600}>
                        定时任务
                    </Typography>
                </Box>
            </Paper>

            <Box sx={{ maxWidth: 600, mx: 'auto', px: 2 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            mb: 3,
                            borderRadius: 2,
                            bgcolor: alpha('#1890ff', 0.05),
                            border: '1px solid',
                            borderColor: alpha('#1890ff', 0.1),
                        }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            💡 启用定时任务后，系统将在指定时间自动推送 AI 生成的内容到对应的聊天窗口。
                            在 AI 聊天中说「创建定时任务」可以创建个性化任务。
                        </Typography>
                    </Paper>
                </motion.div>

                {/* Preset Tasks Section */}
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    📌 通用定时任务
                </Typography>
                
                {presetTasks.map((task, index) => (
                    <motion.div
                        key={task.taskType}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                        <TaskCard
                            task={task}
                            updating={updating === task.taskType}
                            onToggle={(enabled) => handlePresetToggle(task.taskType, enabled)}
                            onTimeChange={(time) => handlePresetTimeChange(task.taskType, time)}
                        />
                    </motion.div>
                ))}

                {/* Custom Tasks Section */}
                {customTasks.length > 0 && (
                    <>
                        <Divider sx={{ my: 3 }} />
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            ✨ 个性化定时任务
                        </Typography>
                        
                        {customTasks.map((task, index) => (
                            <motion.div
                                key={task._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                            >
                                <TaskCard
                                    task={task}
                                    updating={updating === task._id}
                                    onToggle={(enabled) => handleCustomToggle(task._id, enabled)}
                                    onTimeChange={(time) => handleCustomTimeChange(task._id, time)}
                                    onDelete={() => handleDeleteClick(task)}
                                />
                            </motion.div>
                        ))}
                    </>
                )}
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>确认删除</DialogTitle>
                <DialogContent>
                    <Typography>
                        确定要删除定时任务「{taskToDelete?.taskName}」吗？相关的聊天记录也会被删除。
                    </Typography>
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

export default ScheduledTasks;
