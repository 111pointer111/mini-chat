import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { authInputSx, authButtonSx, authLinkSx, authAlertSx } from '../styles/authStyles';

interface LoginFormValues {
    email: string;
    password: string;
}

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    const onSubmit: SubmitHandler<LoginFormValues> = async (data) => {
        try {
            setLoginLoading(true);
            setError('');
            const response = await api.post('/auth/login', data);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '登录失败，请检查账号密码');
        } finally {
            setLoginLoading(false);
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
                登录 Mini Chat
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', mb: 3 }}>
                使用已注册的邮箱和密码进入。
            </Typography>

            {error && <Alert severity="error" sx={authAlertSx}>{error}</Alert>}

            <form onSubmit={handleSubmit(onSubmit)}>
                <TextField
                    fullWidth label="邮箱" type="email" margin="normal"
                    autoComplete="email"
                    {...register('email', { required: '请输入邮箱' })}
                    error={!!errors.email} helperText={errors.email?.message}
                    sx={authInputSx}
                />
                <TextField
                    fullWidth label="密码" type="password" margin="normal"
                    autoComplete="current-password"
                    {...register('password', { required: '请输入密码' })}
                    error={!!errors.password} helperText={errors.password?.message}
                    sx={authInputSx}
                />
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loginLoading} sx={authButtonSx}>
                    {loginLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '登录'}
                </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                    还没有账号？{' '}
                    <Link component={RouterLink} to="/register" sx={authLinkSx}>去注册</Link>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.45)' }}>
                    <Link component={RouterLink} to="/reset-password" sx={authLinkSx}>忘记密码？</Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Login;
