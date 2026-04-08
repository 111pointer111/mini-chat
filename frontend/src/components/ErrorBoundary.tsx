import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        p: 4,
                    }}
                >
                    <Alert severity="error" sx={{ mb: 2, maxWidth: 500 }}>
                        页面发生错误，请刷新重试
                    </Alert>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {this.state.error?.message}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => window.location.reload()}
                    >
                        刷新页面
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}
