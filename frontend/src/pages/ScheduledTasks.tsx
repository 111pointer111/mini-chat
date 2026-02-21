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
} from '@mui/material';
import { ArrowBack, GitHub, MenuBook, Translate, AccessTime, NotificationsActive } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface ScheduledTask {
    taskType: string;
    name: string;
    enabled: boolean;
    pushTime: string;
    conversationId?: string;
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
};

// Generate time options (every minute for precise testing)
const TIME_OPTIONS = Array.from({ length: 24 * 60 }, (_, i) => {
    const hour = Math.floor(i / 60);
    const minute = i % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const TaskCard: React.FC<{
    task: ScheduledTask;
    updating: boolean;
    onToggle: (enabled: boolean) => void;
    onTimeChange: (time: string) => void;
}> = ({ task, updating, onToggle, onTimeChange }) => {
    const config = TASK_CONFIG[task.taskType];

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
                                {task.name}
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

                {/* Content */}
                <Box sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {config.description}
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
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await api.get('/scheduled-tasks');
            setTasks(res.data);
        } catch (err) {
            setError('获取任务列表失败');
        } finally {
            setLoading(false);
        }
    };

    // Get user's timezone
    const getUserTimezone = () => {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    };

    const handleToggle = async (taskType: string, enabled: boolean) => {
        setUpdating(taskType);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/${taskType}`, { enabled, timezone });
            setTasks((prev) =>
                prev.map((t) => (t.taskType === taskType ? res.data : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handleTimeChange = async (taskType: string, pushTime: string) => {
        setUpdating(taskType);
        try {
            const timezone = getUserTimezone();
            const res = await api.put(`/scheduled-tasks/${taskType}`, { pushTime, timezone });
            setTasks((prev) =>
                prev.map((t) => (t.taskType === taskType ? res.data : t))
            );
        } catch (err) {
            setError('更新失败');
        } finally {
            setUpdating(null);
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
                        </Typography>
                    </Paper>
                </motion.div>

                {tasks.map((task, index) => (
                    <motion.div
                        key={task.taskType}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                        <TaskCard
                            task={task}
                            updating={updating === task.taskType}
                            onToggle={(enabled) => handleToggle(task.taskType, enabled)}
                            onTimeChange={(time) => handleTimeChange(task.taskType, time)}
                        />
                    </motion.div>
                ))}
            </Box>
        </Box>
    );
};

export default ScheduledTasks;
