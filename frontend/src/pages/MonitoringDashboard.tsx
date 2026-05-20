import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Box, Paper, Typography, Card, CardContent, Grid, Chip,
    IconButton, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { getMetrics, getAlerts } from '../services/api';

interface MetricsData {
    timestamp: string;
    requests: { total: number; windowed: number; byStatus: Record<string, number> };
    latency: { p50: number; p95: number; p99: number; max: number; count: number };
    errors: { server5xx: number; client4xx: number; ratePercent: number };
    system: { memoryUsageMB: number; socketConnections: number; uptimeSeconds: number };
}

interface AlertStatus {
    name: string;
    status: string;
    severity: string;
    description: string;
}

const MetricCard: React.FC<{ title: string; value: string | number; unit?: string; color?: string }> = ({
    title, value, unit, color = 'primary',
}) => (
    <Card>
        <CardContent>
            <Typography color="text.secondary" variant="body2" gutterBottom>{title}</Typography>
            <Typography variant="h4" color={color} fontWeight="bold">
                {value}
                {unit && <Typography component="span" variant="body2" color="text.secondary"> {unit}</Typography>}
            </Typography>
        </CardContent>
    </Card>
);

const statusColor = (status: string) => {
    switch (status) {
        case 'firing': return 'error';
        case 'pending': return 'warning';
        case 'resolved': return 'success';
        default: return 'default';
    }
};

const severityLabel = (severity: string) => {
    switch (severity) {
        case 'critical': return '严重';
        case 'warning': return '警告';
        case 'info': return '信息';
        default: return severity;
    }
};

const renderDescription = (desc: string, metrics?: MetricsData) => {
    if (!metrics) return desc;
    return desc
        .replace(/\{\{rate\}\}/g, String(metrics.errors.ratePercent))
        .replace(/\{\{p95\}\}/g, String(metrics.latency.p95))
        .replace(/\{\{memory\}\}/g, String(metrics.system.memoryUsageMB))
        .replace(/\{\{sockets\}\}/g, String(metrics.system.socketConnections));
};

const MonitoringDashboard: React.FC = () => {
    const navigate = useNavigate();

    const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics, error: metricsError } = useQuery<MetricsData>({
        queryKey: ['metrics'],
        queryFn: async () => (await getMetrics()).data,
        refetchInterval: 10_000,
    });

    const { data: alerts, isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery<AlertStatus[]>({
        queryKey: ['alerts'],
        queryFn: async () => (await getAlerts()).data,
        refetchInterval: 10_000,
    });

    const handleRefresh = () => {
        refetchMetrics();
        refetchAlerts();
    };

    if (loadingMetrics || loadingAlerts) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (metricsError) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">加载监控数据失败，请确认您有管理员权限。</Alert>
            </Box>
        );
    }

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Bar */}
            <Paper elevation={1} sx={{ p: 1.5, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate('/')} size="small">
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6" fontWeight="bold">系统监控</Typography>
                </Box>
                <Tooltip title="刷新">
                    <IconButton onClick={handleRefresh} size="small">
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Paper>

            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {/* Metrics Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                            title="窗口请求数 (5min)"
                            value={metrics?.requests.windowed ?? 0}
                            unit="次"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                            title="错误率 (5xx)"
                            value={metrics?.errors.ratePercent ?? 0}
                            unit="%"
                            color={(metrics?.errors.ratePercent ?? 0) > 5 ? 'error' : 'success'}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                            title="P95 延迟"
                            value={metrics?.latency.p95 ?? 0}
                            unit="ms"
                            color={(metrics?.latency.p95 ?? 0) > 2000 ? 'warning' : 'primary'}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <MetricCard
                            title="内存使用"
                            value={metrics?.system.memoryUsageMB ?? 0}
                            unit="MB"
                            color={(metrics?.system.memoryUsageMB ?? 0) > 512 ? 'warning' : 'primary'}
                        />
                    </Grid>
                </Grid>

                {/* Additional Info */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">Socket 连接数</Typography>
                                <Typography variant="h5">{metrics?.system.socketConnections ?? 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">累计请求</Typography>
                                <Typography variant="h5">{metrics?.requests.total ?? 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" variant="body2">运行时间</Typography>
                                <Typography variant="h5">{formatUptime(metrics?.system.uptimeSeconds ?? 0)}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Alerts Table */}
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>告警规则状态</Typography>
                    {alerts && alerts.length > 0 ? (
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                            <Box component="thead">
                                <Box component="tr" sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <Box component="th" sx={{ textAlign: 'left', p: 1 }}>规则</Box>
                                    <Box component="th" sx={{ textAlign: 'left', p: 1 }}>级别</Box>
                                    <Box component="th" sx={{ textAlign: 'left', p: 1 }}>状态</Box>
                                    <Box component="th" sx={{ textAlign: 'left', p: 1 }}>描述</Box>
                                </Box>
                            </Box>
                            <Box component="tbody">
                                {alerts.map((alert) => (
                                    <Box component="tr" key={alert.name} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                                        <Box component="td" sx={{ p: 1, fontFamily: 'monospace' }}>{alert.name}</Box>
                                        <Box component="td" sx={{ p: 1 }}>
                                            <Chip label={severityLabel(alert.severity)} size="small" color={alert.severity === 'critical' ? 'error' : 'warning'} variant="outlined" />
                                        </Box>
                                        <Box component="td" sx={{ p: 1 }}>
                                            <Chip label={alert.status} size="small" color={statusColor(alert.status) as 'error' | 'warning' | 'success' | 'default'} />
                                        </Box>
                                        <Box component="td" sx={{ p: 1 }}>{renderDescription(alert.description, metrics)}</Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    ) : (
                        <Typography color="text.secondary">暂无告警规则</Typography>
                    )}
                </Paper>
            </Box>
        </Box>
    );
};

export default MonitoringDashboard;
