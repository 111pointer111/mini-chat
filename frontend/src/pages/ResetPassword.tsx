import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import PhoneCodeInput from '../components/PhoneCodeInput';
import { authInputSx, authButtonSx, authLinkSx, authAlertSx, authSuccessAlertSx } from '../styles/authStyles';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        if (!phone || !code || !newPassword) {
            setError('请填写所有必填项');
            return;
        }
        if (newPassword.length < 6) {
            setError('密码长度至少6位');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await api.post('/auth/reset-password-phone', { phone, code, newPassword });
            setSuccess('密码重置成功，即将跳转到登录页面...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '重置失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
        >
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: '#f1f5f9', textAlign: 'center', mb: 0.5 }}>
                找回密码
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', mb: 3 }}>
                通过手机验证码重置密码
            </Typography>

            {error && <Alert severity="error" sx={authAlertSx}>{error}</Alert>}
            {success && <Alert severity="success" sx={authSuccessAlertSx}>{success}</Alert>}

            <Box>
                <PhoneCodeInput phone={phone} setPhone={setPhone} code={code} setCode={setCode} type="reset" />
                <TextField
                    fullWidth label="新密码" type="password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    margin="normal" helperText="密码长度至少6位" sx={authInputSx}
                />
                <TextField
                    fullWidth label="确认密码" type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    margin="normal" sx={authInputSx}
                />
                <Button fullWidth variant="contained" size="large" onClick={handleReset} disabled={loading} sx={authButtonSx}>
                    {loading ? '重置中...' : '重置密码'}
                </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                    想起密码了？{' '}
                    <Link component={RouterLink} to="/login" sx={authLinkSx}>返回登录</Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default ResetPassword;
