import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import PhoneCodeInput from '../components/PhoneCodeInput';

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
        } catch (err: any) {
            setError(err.response?.data?.message || '重置失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
                找回密码
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                通过手机验证码重置密码
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <Box sx={{ mt: 2 }}>
                <PhoneCodeInput
                    phone={phone}
                    setPhone={setPhone}
                    code={code}
                    setCode={setCode}
                    type="reset"
                />
                <TextField
                    fullWidth
                    label="新密码"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    margin="normal"
                    helperText="密码长度至少6位"
                />
                <TextField
                    fullWidth
                    label="确认密码"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    margin="normal"
                />
                <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleReset}
                    disabled={loading}
                    sx={{ mt: 3, mb: 2, height: 48 }}
                >
                    {loading ? '重置中...' : '重置密码'}
                </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                    想起密码了？{' '}
                    <Link component={RouterLink} to="/login" underline="hover">
                        返回登录
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default ResetPassword;
