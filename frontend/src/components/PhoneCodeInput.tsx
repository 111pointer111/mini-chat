import React, { useState, useEffect } from 'react';
import { Box, TextField, Button } from '@mui/material';
import api from '../services/api';

interface PhoneCodeInputProps {
    phone: string;
    setPhone: (phone: string) => void;
    code: string;
    setCode: (code: string) => void;
    type: 'register' | 'login' | 'bind' | 'reset';
    phoneError?: string;
    codeError?: string;
}

const PhoneCodeInput: React.FC<PhoneCodeInputProps> = ({
    phone,
    setPhone,
    code,
    setCode,
    type,
    phoneError,
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
        if (!phone || countdown > 0 || sending) return;

        // Validate phone format
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            setSendError('请输入正确的手机号');
            return;
        }

        setSending(true);
        setSendError('');

        try {
            await api.post('/auth/send-code', { phone, type });
            setCountdown(60);
        } catch (err: any) {
            setSendError(err.response?.data?.message || '发送失败');
        } finally {
            setSending(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    label="手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    error={!!phoneError || !!sendError}
                    helperText={phoneError || sendError}
                    placeholder="请输入手机号"
                />
                <Button
                    variant="outlined"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || sending || !phone}
                    sx={{ minWidth: 120, whiteSpace: 'nowrap' }}
                >
                    {sending ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Button>
            </Box>
            <TextField
                fullWidth
                label="验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                error={!!codeError}
                helperText={codeError}
                placeholder="请输入验证码"
            />
        </Box>
    );
};

export default PhoneCodeInput;
