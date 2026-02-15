import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import PhoneCodeInput from '../components/PhoneCodeInput';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    const onSubmit = async (data: any) => {
        try {
            setError('');
            const response = await api.post('/auth/login', data);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Invalid credentials');
        }
    };

    const handlePhoneLogin = async () => {
        if (!phone || !code) {
            setError('请输入手机号和验证码');
            return;
        }
        setPhoneLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/login-phone', { phone, code });
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || '登录失败');
        } finally {
            setPhoneLoading(false);
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
                Welcome
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                Sign in to continue to Mini Chat
            </Typography>

            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} centered sx={{ mb: 2 }}>
                <Tab label="邮箱登录" />
                <Tab label="手机号登录" />
            </Tabs>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {tabValue === 0 ? (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth
                        label="Email Address"
                        margin="normal"
                        {...register('email', { required: 'Email is required' })}
                        error={!!errors.email}
                        helperText={errors.email?.message as string}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        margin="normal"
                        {...register('password', { required: 'Password is required' })}
                        error={!!errors.password}
                        helperText={errors.password?.message as string}
                    />

                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        Sign In
                    </Button>
                </form>
            ) : (
                <Box sx={{ mt: 2 }}>
                    <PhoneCodeInput
                        phone={phone}
                        setPhone={setPhone}
                        code={code}
                        setCode={setCode}
                        type="login"
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handlePhoneLogin}
                        disabled={phoneLoading}
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        {phoneLoading ? '登录中...' : '登录'}
                    </Button>
                </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                    Don't have an account?{' '}
                    <Link component={RouterLink} to="/register" underline="hover">
                        Sign up
                    </Link>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                    <Link component={RouterLink} to="/reset-password" underline="hover">
                        忘记密码？
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Login;
