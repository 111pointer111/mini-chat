import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { Box, Paper, Typography, Chip, Avatar, Button, Divider, Drawer, IconButton, useMediaQuery, useTheme, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import { useNavigate } from 'react-router-dom';
import FriendList from '../components/FriendList';
import ChatWindow from '../components/ChatWindow';
import UserSearch from '../components/UserSearch';

const DRAWER_WIDTH = 320;

const Dashboard: React.FC = () => {
    const { user, logout } = useAuthStore();
    const { connect, disconnect, isConnected } = useSocketStore();
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const sidebarContent = (
        <>
            <UserSearch />
            <Divider />
            <FriendList />
        </>
    );

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Bar */}
            <Paper elevation={1} sx={{ p: 1, px: { xs: 1, sm: 3 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                    {isMobile && (
                        <IconButton color="inherit" edge="start" onClick={handleDrawerToggle}>
                            <MenuIcon />
                        </IconButton>
                    )}
                    <Typography variant="h6" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>MiniChat</Typography>
                    <Chip
                        label={isConnected ? "在线" : "连接中..."}
                        color={isConnected ? "success" : "warning"}
                        size="small"
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
                    <Tooltip title="AI 助手">
                        <IconButton onClick={() => navigate('/ai-chat')} size="small" color="primary">
                            <SmartToyIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="定时任务">
                        <IconButton onClick={() => navigate('/scheduled-tasks')} size="small">
                            <ScheduleIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="知识库">
                        <IconButton onClick={() => navigate('/knowledge-base')} size="small" color="info">
                            <LibraryBooksIcon />
                        </IconButton>
                    </Tooltip>
                    {user?.role === 'admin' && (
                        <Tooltip title="AI 模型管理">
                            <IconButton onClick={() => navigate('/admin/ai-providers')} size="small" color="secondary">
                                <AdminPanelSettingsIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Avatar src={user?.avatar} sx={{ width: 32, height: 32 }} />
                    <Typography sx={{ display: { xs: 'none', sm: 'block' } }}>{user?.username}</Typography>
                    <Button size="small" color="inherit" onClick={logout}>退出</Button>
                </Box>
            </Paper>

            {/* Main Content */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Mobile Drawer */}
                {isMobile ? (
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={handleDrawerToggle}
                        ModalProps={{ keepMounted: true }}
                        sx={{
                            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
                        }}
                    >
                        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                            {sidebarContent}
                        </Box>
                    </Drawer>
                ) : (
                    /* Desktop Sidebar */
                    <Paper sx={{ width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'white', borderRadius: 0 }}>
                        {sidebarContent}
                    </Paper>
                )}

                {/* Chat Area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                    <ChatWindow />
                </Box>
            </Box>
        </Box>
    );
};

export default Dashboard;
