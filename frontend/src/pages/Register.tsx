import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert, Tabs, Tab, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import PhoneCodeInput from '../components/PhoneCodeInput';
import EmailCodeInput from '../components/EmailCodeInput';
import { authInputSx, authTabsSx, authButtonSx, authLinkSx, authAlertSx } from '../styles/authStyles';

interface EmailRegisterFormValues {
    username: string;
    password: string;
}

const Register: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<EmailRegisterFormValues>();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [email, setEmail] = useState('');
    const [phoneUsername, setPhoneUsername] = useState('');
    const [phoneEmail, setPhoneEmail] = useState('');
    const [phonePassword, setPhonePassword] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [registerLoading, setRegisterLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const login = useAuthStore((state) => state.login);

    const onSubmit: SubmitHandler<EmailRegisterFormValues> = async (data) => {
        if (!email) {
            setError('请输入邮箱');
            return;
        }

        if (!verificationCode || verificationCode.length !== 6) {
            setError('请输入6位验证码');
            return;
        }
        try {
            setRegisterLoading(true);
            setError('');
            const response = await api.post('/auth/register', {
                username: data.username,
                email,
                password: data.password,
                code: verificationCode,
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

    const handlePhoneRegister = async () => {
        if (!phone || !code || !phoneUsername) {
            setError('请填写所有必填项');
            return;
        }
        setPhoneLoading(true);
        setError('');
        try {
            const response = await api.post('/auth/register-phone', {
                phone,
                code,
                username: phoneUsername,
                email: phoneEmail,
                password: phonePassword,
            });
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
                注册 Mini Chat
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', mb: 3 }}>
                选择一种方式创建新账号。
            </Typography>

            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" sx={authTabsSx}>
                <Tab label="邮箱注册" />
                <Tab label="手机号注册" />
            </Tabs>

            {error && <Alert severity="error" sx={authAlertSx}>{error}</Alert>}

            {tabValue === 0 ? (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <TextField
                        fullWidth label="用户名" margin="normal"
                        autoComplete="username"
                        {...register('username', { required: '请输入用户名', minLength: { value: 2, message: '至少2个字符' }, maxLength: { value: 30, message: '最多30个字符' } })}
                        error={!!errors.username} helperText={errors.username?.message}
                        sx={authInputSx}
                    />
                    <Box sx={{ mt: 2 }}>
                        <EmailCodeInput
                            email={email}
                            setEmail={setEmail}
                            code={verificationCode}
                            setCode={setVerificationCode}
                            type="register"
                        />
                    </Box>
                    <TextField
                        fullWidth label="密码" type="password" margin="normal"
                        autoComplete="new-password"
                        {...register('password', { required: '请输入密码', minLength: { value: 6, message: '密码至少6位' } })}
                        error={!!errors.password} helperText={errors.password?.message}
                        sx={authInputSx}
                    />
                    <Button fullWidth type="submit" variant="contained" size="large" disabled={registerLoading} sx={authButtonSx}>
                        {registerLoading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '注册'}
                    </Button>
                </form>
            ) : (
                <Box
                    component="form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handlePhoneRegister();
                    }}
                >
                    <TextField
                        fullWidth label="用户名" value={phoneUsername}
                        onChange={(e) => setPhoneUsername(e.target.value)}
                        autoComplete="username"
                        margin="normal" required sx={authInputSx}
                    />
                    <Box sx={{ mt: 2 }}>
                        <PhoneCodeInput phone={phone} setPhone={setPhone} code={code} setCode={setCode} type="register" />
                    </Box>
                    <Box
                        component="details"
                        sx={{
                            mt: 2,
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            px: 1.5,
                            py: 1.25,
                        }}
                    >
                        <Box
                            component="summary"
                            sx={{
                                cursor: 'pointer',
                                color: '#c7d2fe',
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                listStyle: 'none',
                                '&::-webkit-details-marker': { display: 'none' },
                            }}
                        >
                            可选信息：邮箱和密码
                        </Box>
                        <TextField
                            fullWidth label="邮箱（可选）" type="email" value={phoneEmail}
                            onChange={(e) => setPhoneEmail(e.target.value)}
                            autoComplete="email"
                            margin="normal" helperText="填写邮箱后可使用邮箱登录" sx={authInputSx}
                        />
                        <TextField
                            fullWidth label="密码（可选）" type="password" value={phonePassword}
                            onChange={(e) => setPhonePassword(e.target.value)}
                            autoComplete="new-password"
                            margin="normal" helperText="设置密码后可使用密码登录" sx={authInputSx}
                        />
                    </Box>
                    <Button fullWidth type="submit" variant="contained" size="large" disabled={phoneLoading} sx={authButtonSx}>
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
