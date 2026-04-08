import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import PhoneCodeInput from '../components/PhoneCodeInput';

const Register: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    const onSubmit = async (data: FieldValues) => {
        try {
            setError('');
            const response = await api.post('/auth/register', data);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || 'Registration failed. Please try again.');
        }
    };

    const handlePhoneRegister = async () => {
        if (!phone || !code || !username) {
            setError('请填写所有必填项');
            return;
        }
        setPhoneLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/register-phone', { phone, code, username, email, password });
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '注册失败');
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
                Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                Join Mini Chat today
            </Typography>

            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} centered sx={{ mb: 2 }}>
                <Tab label="邮箱注册" />
                <Tab label="手机号注册" />
            </Tabs>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {tabValue === 0 ? (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth
                        label="Username"
                        margin="normal"
                        {...register('username', { required: 'Username is required' })}
                        error={!!errors.username}
                        helperText={errors.username?.message as string}
                    />
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
                        {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
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
                        Sign Up
                    </Button>
                </form>
            ) : (
                <Box sx={{ mt: 2 }}>
                    <TextField
                        fullWidth
                        label="用户名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        margin="normal"
                        required
                    />
                    <TextField
                        fullWidth
                        label="邮箱（可选）"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        margin="normal"
                        helperText="填写邮箱后可使用邮箱登录"
                    />
                    <Box sx={{ mt: 2 }}>
                        <PhoneCodeInput
                            phone={phone}
                            setPhone={setPhone}
                            code={code}
                            setCode={setCode}
                            type="register"
                        />
                    </Box>
                    <TextField
                        fullWidth
                        label="密码（可选）"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        margin="normal"
                        helperText="设置密码后可使用密码登录"
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handlePhoneRegister}
                        disabled={phoneLoading}
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        {phoneLoading ? '注册中...' : '注册'}
                    </Button>
                </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                    Already have an account?{' '}
                    <Link component={RouterLink} to="/login" underline="hover">
                        Sign in
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Register;
