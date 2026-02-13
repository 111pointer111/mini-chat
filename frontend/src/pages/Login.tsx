import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Link, Box, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const navigate = useNavigate();
    const [error, setError] = React.useState('');
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
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                Sign in to continue to Mini Chat
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2">
                    Don't have an account?{' '}
                    <Link component={RouterLink} to="/register" underline="hover">
                        Sign up
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
};

export default Login;
