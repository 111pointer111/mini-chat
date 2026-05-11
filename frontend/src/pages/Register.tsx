import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab, CircularProgress, InputAdornment } from '@mui/material';
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
    const [registerLoading, setRegisterLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [sendError, setSendError] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const login = useAuthStore((state) => state.login);

    const onSubmit = async (data: FieldValues) => {
        if (!verificationCode || verificationCode.length !== 6) {
            setError('请输入6位验证码');
            return;
        }
        try {
            setRegisterLoading(true);
            setError('');
            const response = await api.post('/auth/register', {
                ...data,
                code: verificationCode
            });
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '注册失败，请重试');
        } finally {
            setRegisterLoading(false);
        }
    };

    const handleSendCode = async () => {
        if (!email) {
            setSendError('请先输入邮箱');
            return;
        }
        setSendingCode(true);
        setSendError('');
        try {
            await api.post('/auth/send-verification', { email });
            setCountdown(60);
            timerRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setSendError(axiosErr.response?.data?.message || '发送失败，请重试');
        } finally {
            setSendingCode(false);
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
                        label="用户名"
                        margin="normal"
                        {...register('username', { required: '请输入用户名', minLength: { value: 2, message: '至少2个字符' }, maxLength: { value: 30, message: '最多30个字符' } })}
                        error={!!errors.username}
                        helperText={errors.username?.message as string}
                    />
                    <TextField
                        fullWidth
                        label="邮箱"
                        type="email"
                        margin="normal"
                        {...register('email', { required: '请输入邮箱' })}
                        error={!!errors.email}
                        helperText={errors.email?.message as string}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="验证码"
                        margin="normal"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        inputProps={{ maxLength: 6 }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Button
                                        onClick={handleSendCode}
                                        disabled={countdown > 0 || sendingCode || !email}
                                        size="small"
                                    >
                                        {sendingCode ? <CircularProgress size={18} /> : countdown > 0 ? `${countdown}s` : '发送验证码'}
                                    </Button>
                                </InputAdornment>
                            )
                        }}
                    />
                    {sendError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{sendError}</Alert>}
                    <TextField
                        fullWidth
                        label="密码"
                        type="password"
                        margin="normal"
                        {...register('password', { required: '请输入密码', minLength: { value: 6, message: '密码至少6位' } })}
                        error={!!errors.password}
                        helperText={errors.password?.message as string}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={registerLoading}
                        sx={{ mt: 3, mb: 2, height: 48 }}
                    >
                        {registerLoading ? <CircularProgress size={24} /> : '注册'}
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
