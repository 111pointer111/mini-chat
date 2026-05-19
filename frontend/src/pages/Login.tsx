import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import PhoneCodeInput from '../components/PhoneCodeInput';
import EmailCodeInput from '../components/EmailCodeInput';
import { authInputSx, authTabsSx, authButtonSx, authLinkSx, authAlertSx } from '../styles/authStyles';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [emailCodeEmail, setEmailCodeEmail] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [emailCodeLoading, setEmailCodeLoading] = useState(false);
    const login = useAuthStore((state) => state.login);

    const onSubmit = async (data: FieldValues) => {
        try {
            setError('');
            const response = await api.post('/auth/login', data);
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '登录失败，请检查账号密码');
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
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '登录失败');
        } finally {
            setPhoneLoading(false);
        }
    };

    const handleEmailCodeLogin = async () => {
        if (!emailCodeEmail || !emailCode) {
            setError('请输入邮箱和验证码');
            return;
        }
        setEmailCodeLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/login-email-code', { email: emailCodeEmail, code: emailCode });
            login(response.data.user, response.data.token);
            navigate('/');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(axiosErr.response?.data?.message || '登录失败');
        } finally {
            setEmailCodeLoading(false);
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
                欢迎回来
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', mb: 3 }}>
                登录以继续使用 Mini Chat
            </Typography>

            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} centered sx={authTabsSx}>
                <Tab label="密码登录" />
                <Tab label="邮箱验证码" />
                <Tab label="手机号" />
            </Tabs>

            {error && <Alert severity="error" sx={authAlertSx}>{error}</Alert>}

            {tabValue === 0 && (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth label="邮箱地址" margin="normal"
                        {...register('email', { required: '请输入邮箱' })}
                        error={!!errors.email} helperText={errors.email?.message as string}
                        sx={authInputSx}
                    />
                    <TextField
                        fullWidth label="密码" type="password" margin="normal"
                        {...register('password', { required: '请输入密码' })}
                        error={!!errors.password} helperText={errors.password?.message as string}
                        sx={authInputSx}
                    />
                    <Button fullWidth type="submit" variant="contained" size="large" sx={authButtonSx}>
                        登录
                    </Button>
                </form>
            )}

            {tabValue === 1 && (
                <Box>
                    <EmailCodeInput
                        email={emailCodeEmail}
                        setEmail={setEmailCodeEmail}
                        code={emailCode}
                        setCode={setEmailCode}
                        type="login"
                    />
                    <Button fullWidth variant="contained" size="large" onClick={handleEmailCodeLogin} disabled={emailCodeLoading} sx={authButtonSx}>
                        {emailCodeLoading ? '登录中...' : '登录'}
                    </Button>
                </Box>
            )}

            {tabValue === 2 && (
                <Box>
                    <PhoneCodeInput phone={phone} setPhone={setPhone} code={code} setCode={setCode} type="login" />
                    <Button fullWidth variant="contained" size="large" onClick={handlePhoneLogin} disabled={phoneLoading} sx={authButtonSx}>
                        {phoneLoading ? '登录中...' : '登录'}
                    </Button>
                </Box>
            )}

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                    还没有账号？{' '}
                    <Link component={RouterLink} to="/register" sx={authLinkSx}>立即注册</Link>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.45)' }}>
                    <Link component={RouterLink} to="/reset-password" sx={authLinkSx}>忘记密码？</Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Login;
