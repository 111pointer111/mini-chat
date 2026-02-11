import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Paper, Typography, useTheme, useMediaQuery } from '@mui/material';
import { motion } from 'framer-motion';

const AuthLayout: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Box sx={{
            display: 'flex',
            minHeight: '100vh',
            bgcolor: 'background.default'
        }}>
            {/* Left Side - Decorative */}
            {!isMobile && (
                <Box
                    component={motion.div}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        bgcolor: 'primary.main',
                        color: 'white',
                        p: 4,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                >
                    <Typography variant="h2" fontWeight="bold" gutterBottom>
                        Mini Chat
                    </Typography>
                    <Typography variant="h5">
                        Connect with AI & Friends
                    </Typography>
                </Box>
            )}

            {/* Right Side - Content */}
            <Box
                sx={{
                    flex: isMobile ? 1 : 0.8,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    p: 4
                }}
            >
                <Container maxWidth="xs">
                    <Paper
                        elevation={3}
                        sx={{
                            p: 4,
                            width: '100%',
                            borderRadius: 2
                        }}
                    >
                        <Outlet />
                    </Paper>
                </Container>
            </Box>
        </Box>
    );
};

export default AuthLayout;
