import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Container, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Typography from '@mui/material/Typography';

// 浮动光球动画配置
const orbs = [
    {
        size: 400, top: '-10%', left: '-5%',
        gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        animate: {
            x: [0, 80, -40, 60, 0],
            y: [0, -60, 80, 40, 0],
            scale: [1, 1.1, 0.9, 1.05, 1],
        },
        duration: 20,
    },
    {
        size: 350, top: '50%', right: '-8%',
        gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
        animate: {
            x: [0, -60, 50, -80, 0],
            y: [0, 70, -50, -30, 0],
            scale: [1, 1.15, 0.85, 1.1, 1],
        },
        duration: 25,
    },
    {
        size: 300, bottom: '-5%', left: '30%',
        gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
        animate: {
            x: [0, 100, -70, 0],
            y: [0, 50, -80, 0],
            scale: [1, 1.2, 0.9, 1],
        },
        duration: 22,
    },
    {
        size: 200, top: '20%', right: '25%',
        gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
        animate: {
            x: [0, 60, -40, 80, 0],
            y: [0, -40, 60, 20, 0],
            scale: [1, 1.05, 0.95, 1.1, 1],
        },
        duration: 18,
    },
];

// 粒子配置
const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 4,
    opacity: Math.random() * 0.4 + 0.1,
}));

const AuthLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const authMode = location.pathname === '/register' ? 'register' : location.pathname === '/login' ? 'login' : null;

    // 粒子动画 — 直接用 animate prop 驱动
    const particleAnimations = useMemo(() => particles.map((p) => ({
        y: [p.y + '%', (p.y - 30) + '%', p.y + '%'],
        x: [p.x + '%', (p.x + 15) + '%', p.x + '%'],
        opacity: [0, 0.6, 0],
        transition: {
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut' as const,
        },
    })), []);

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100svh',
                py: { xs: 2.5, sm: 4 },
                overflowX: 'hidden',
                overflowY: 'auto',
                background: 'linear-gradient(135deg, #0f0c29 0%, #1a1145 30%, #302b63 60%, #24243e 100%)',
            }}
        >
            {/* 动态光球背景 — Framer Motion 驱动 */}
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                {orbs.map((orb, i) => (
                    <Box
                        key={i}
                        component={motion.div}
                        animate={orb.animate}
                        transition={{
                            duration: orb.duration,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        sx={{
                            position: 'absolute',
                            width: orb.size,
                            height: orb.size,
                            borderRadius: '50%',
                            background: orb.gradient,
                            filter: 'blur(80px)',
                            opacity: 0.5,
                            top: orb.top,
                            left: orb.left,
                            right: orb.right,
                            bottom: orb.bottom,
                        }}
                    />
                ))}
            </Box>

            {/* 浮动粒子 — Framer Motion 驱动 */}
            <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {particles.map((p, i) => (
                    <Box
                        key={p.id}
                        component={motion.div}
                        animate={particleAnimations[i]}
                        sx={{
                            position: 'absolute',
                            width: p.size,
                            height: p.size,
                            borderRadius: '50%',
                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                            left: 0,
                            top: 0,
                        }}
                    />
                ))}
            </Box>

            {/* 网格纹理 */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
                    backgroundSize: '40px 40px',
                    pointerEvents: 'none',
                }}
            />

            {/* 径向光晕 — 中心提亮 */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '60vw',
                    height: '60vh',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }}
            />

            {/* 居中卡片区域 */}
            <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1, width: '100%', px: { xs: 2, sm: 3 } }}>
                {/* 品牌头部 — 入场动画 */}
                <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    sx={{ textAlign: 'center', mb: { xs: 2, sm: 3 } }}
                >
                    <Box
                        component={motion.div}
                        animate={{
                            boxShadow: [
                                '0 8px 32px rgba(99, 102, 241, 0.4)',
                                '0 8px 48px rgba(139, 92, 246, 0.6)',
                                '0 8px 32px rgba(99, 102, 241, 0.4)',
                            ],
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: { xs: 50, sm: 56 },
                            height: { xs: 50, sm: 56 },
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            mb: 1.5,
                        }}
                    >
                        <AutoAwesome sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                    <Typography
                        variant="h5"
                        component={motion.h1}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        sx={{
                            fontWeight: 700,
                            color: '#fff',
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Mini Chat
                    </Typography>
                </Box>

                {/* 表单卡片 — 入场动画 */}
                <Box
                    component={motion.div}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                >
                    <Paper
                        elevation={0}
                        sx={{
                            position: 'relative',
                            p: { xs: 2.25, sm: 4 },
                            width: '100%',
                            borderRadius: '20px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            backdropFilter: 'blur(24px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                            overflow: 'hidden',
                        }}
                    >
                        {authMode && (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 0.5,
                                    p: 0.5,
                                    mb: 3,
                                    borderRadius: '14px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                            >
                                {[
                                    { value: 'login', label: '登录', path: '/login' },
                                    { value: 'register', label: '注册', path: '/register' },
                                ].map((item) => {
                                    const active = authMode === item.value;

                                    return (
                                        <ButtonBase
                                            key={item.value}
                                            onClick={() => navigate(item.path)}
                                            aria-pressed={active}
                                            sx={{
                                                height: 38,
                                                borderRadius: '11px',
                                                color: active ? '#f8fafc' : 'rgba(255,255,255,0.55)',
                                                fontSize: '0.92rem',
                                                fontWeight: 700,
                                                backgroundColor: active ? 'rgba(129, 140, 248, 0.24)' : 'transparent',
                                                transition: 'background-color 160ms ease, color 160ms ease',
                                                '&:hover': {
                                                    backgroundColor: active ? 'rgba(129, 140, 248, 0.3)' : 'rgba(255,255,255,0.05)',
                                                },
                                            }}
                                        >
                                            {item.label}
                                        </ButtonBase>
                                    );
                                })}
                            </Box>
                        )}

                        <Outlet />
                    </Paper>
                </Box>

                {/* 底部装饰文字 */}
                <Box
                    component={motion.div}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                    sx={{ textAlign: 'center', mt: 3 }}
                >
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>
                        Powered by AI · Secure & Private
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};

export default AuthLayout;
