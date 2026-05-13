import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab, CircularProgress, InputAdornment } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import PhoneCodeInput from '../components/PhoneCodeInput';
import { authInputSx, authTabsSx, authButtonSx, authLinkSx, authAlertSx } from '../styles/authStyles';

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
            const response = await api.post('/auth/register', { ...data, code: verificationCode });
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
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
        >
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: '#f1f5f9', textAlign: 'center', mb: 0.5 }}>
                创建账号
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', mb: 3 }}>
                加入 Mini Chat，开始智能对话
            </Typography>

            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} centered sx={authTabsSx}>
                <Tab label="邮箱注册" />
                <Tab label="手机号注册" />
            </Tabs>

            {error && <Alert severity="error" sx={authAlertSx}>{error}</Alert>}

            {tabValue === 0 ? (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth label="用户名" margin="normal"
                        {...register('username', { required: '请输入用户名', minLength: { value: 2, message: '至少2个字符' }, maxLength: { value: 30, message: '最多30个字符' } })}
                        error={!!errors.username} helperText={errors.username?.message as string}
                        sx={authInputSx}
                    />
                    <TextField
                        fullWidth label="邮箱" type="email" margin="normal"
                        {...register('email', { required: '请输入邮箱' })}
                        error={!!errors.email} helperText={errors.email?.message as string}
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        sx={authInputSx}
                    />
                    <TextField
                        fullWidth label="验证码" margin="normal"
                        value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                        inputProps={{ maxLength: 6 }}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Button
                                        onClick={handleSendCode}
                                        disabled={countdown > 0 || sendingCode || !email}
                                        size="small"
                                        sx={{ color: '#a5b4fc', fontWeight: 600, '&:disabled': { color: 'rgba(255,255,255,0.2)' } }}
                                    >
                                        {sendingCode ? <CircularProgress size={18} sx={{ color: '#a5b4fc' }} /> : countdown > 0 ? `${countdown}s` : '发送验证码'}
                                    </Button>
                                </InputAdornment>
                            ),
                        }}
                        sx={authInputSx}
                    />
                    {sendError && <Alert severity="error" sx={{ ...authAlertSx, mt: 1, mb: 1 }}>{sendError}</Alert>}
                    <TextField
                        fullWidth label="密码" type="password" margin="normal"
                        {...register('password', { required: '请输入密码', minLength: { value: 6, message: '密码至少6位' } })}
                        error={!!errors.password} helperText={errors.password?.message as string}
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        sx={authInputSx}
                    />
                    <Button fullWidth type="submit" variant="contained" size="large" disabled={registerLoading} sx={authButtonSx}>
                        {registerLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '注册'}
                    </Button>
                </form>
            ) : (
                <Box>
                    <TextField
                        fullWidth label="用户名" value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        margin="normal" required sx={authInputSx}
                    />
                    <TextField
                        fullWidth label="邮箱（可选）" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        margin="normal" helperText="填写邮箱后可使用邮箱登录" sx={authInputSx}
                    />
                    <Box sx={{ mt: 2 }}>
                        <PhoneCodeInput phone={phone} setPhone={setPhone} code={code} setCode={setCode} type="register" />
                    </Box>
                    <TextField
                        fullWidth label="密码（可选）" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        margin="normal" helperText="设置密码后可使用密码登录" sx={authInputSx}
                    />
                    <Button fullWidth variant="contained" size="large" onClick={handlePhoneRegister} disabled={phoneLoading} sx={authButtonSx}>
                        {phoneLoading ? '注册中...' : '注册'}
                    </Button>
                </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                    已有账号？{' '}
                    <Link component={RouterLink} to="/login" sx={authLinkSx}>返回登录</Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Register;
