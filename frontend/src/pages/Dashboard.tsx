import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { Box, Container, Paper, Typography, Chip, Avatar, Button, Divider } from '@mui/material';
import FriendList from '../components/FriendList';
import ChatWindow from '../components/ChatWindow';
import UserSearch from '../components/UserSearch';

const Dashboard: React.FC = () => {
    const { user, logout } = useAuthStore();
    const { connect, disconnect, isConnected } = useSocketStore();

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#e0e0e0' }}>
            {/* Top Bar */}
            <Paper elevation={1} sx={{ p: 1, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" fontWeight="bold" color="primary">MiniChat</Typography>
                    <Chip
                        label={isConnected ? "Online" : "Connecting..."}
                        color={isConnected ? "success" : "warning"}
                        size="small"
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={user?.avatar} sx={{ width: 32, height: 32 }} />
                    <Typography>{user?.username}</Typography>
                    <Button size="small" color="inherit" onClick={logout}>Logout</Button>
                </Box>
            </Paper>

            {/* Main Content */}
            <Container maxWidth="xl" sx={{ flex: 1, py: 2, overflow: 'hidden' }}>
                <Paper sx={{ height: '100%', display: 'flex', overflow: 'hidden', borderRadius: 2 }}>
                    {/* Sidebar */}
                    <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                        <UserSearch />
                        <Divider />
                        <FriendList />
                    </Box>

                    {/* Chat Area */}
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                        <ChatWindow />
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default Dashboard;
