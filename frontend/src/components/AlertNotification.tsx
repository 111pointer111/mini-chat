import React, { useEffect, useState, useRef } from 'react';
import { Alert, AlertTitle, Stack } from '@mui/material';
import { useSocketStore } from '../store/socketStore';
import { useAuthStore } from '../store/authStore';

interface AlertData {
    id: string;
    type: 'firing' | 'resolved';
    severity: 'critical' | 'warning' | 'info';
    name: string;
    message: string;
    timestamp: number;
}

const MAX_ALERTS = 5;

const AlertNotification: React.FC = () => {
    const { socket } = useSocketStore();
    const { user } = useAuthStore();
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        if (!socket || user?.role !== 'admin') return;

        const handleAlert = (data: Omit<AlertData, 'id'>) => {
            const alert: AlertData = {
                ...data,
                id: `${data.name}-${data.timestamp}`,
            };
            setAlerts(prev => [...prev, alert].slice(-MAX_ALERTS));

            // 自动消失：critical 15s，其他 8s
            const duration = alert.severity === 'critical' ? 15_000 : 8_000;
            const timer = setTimeout(() => {
                setAlerts(prev => prev.filter(a => a.id !== alert.id));
                timersRef.current.delete(alert.id);
            }, duration);
            timersRef.current.set(alert.id, timer);
        };

        socket.on('alert', handleAlert);
        return () => {
            socket.off('alert', handleAlert);
            timersRef.current.forEach(timer => clearTimeout(timer));
            timersRef.current.clear();
        };
    }, [socket, user?.role]);

    const handleClose = (id: string) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    if (user?.role !== 'admin' || alerts.length === 0) return null;

    return (
        <Stack
            spacing={1}
            sx={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 9999,
                maxWidth: 400,
            }}
        >
            {alerts.map(alert => (
                <Alert
                    key={alert.id}
                    severity={alert.type === 'resolved' ? 'success' : alert.severity === 'critical' ? 'error' : alert.severity}
                    onClose={() => handleClose(alert.id)}
                    variant="filled"
                >
                    <AlertTitle>
                        {alert.type === 'firing' ? '告警触发' : '告警恢复'}: {alert.name}
                    </AlertTitle>
                    {alert.message}
                </Alert>
            ))}
        </Stack>
    );
};

export default AlertNotification;
