import React, { useState, useEffect } from 'react';
import { Box, TextField, Button } from '@mui/material';
import api from '../services/api';
import { authInputSx } from '../styles/authStyles';

interface EmailCodeInputProps {
    email: string;
    setEmail: (email: string) => void;
    code: string;
    setCode: (code: string) => void;
    type: 'register' | 'login' | 'bind' | 'reset';
    emailError?: string;
    codeError?: string;
}

const EmailCodeInput: React.FC<EmailCodeInputProps> = ({
    email,
    setEmail,
    code,
    setCode,
    type,
    emailError,
    codeError
}) => {
    const [countdown, setCountdown] = useState(0);
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendCode = async () => {
        if (!email || countdown > 0 || sending) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setSendError('请输入正确的邮箱地址');
            return;
        }

        setSending(true);
        setSendError('');

        try {
            await api.post('/auth/send-verification', { email, type });
            setCountdown(60);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setSendError(axiosErr.response?.data?.message || '发送失败');
        } finally {
            setSending(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    label="邮箱地址"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    error={!!emailError || !!sendError}
                    helperText={emailError || sendError}
                    placeholder="请输入邮箱地址"
                    sx={authInputSx}
                />
                <Button
                    variant="outlined"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || sending || !email}
                    sx={{
                        width: { xs: '100%', sm: 'auto' },
                        minWidth: { xs: '100%', sm: 120 },
                        height: 48,
                        whiteSpace: 'nowrap',
                        borderRadius: '12px',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        color: '#a5b4fc',
                        fontWeight: 600,
                        '&:hover': {
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        },
                        '&:disabled': {
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'rgba(255, 255, 255, 0.2)',
                        },
                    }}
                >
                    {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Button>
            </Box>
            <TextField
                fullWidth
                label="验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                error={!!codeError}
                helperText={codeError}
                placeholder="请输入验证码"
                sx={authInputSx}
            />
        </Box>
    );
};

export default EmailCodeInput;
