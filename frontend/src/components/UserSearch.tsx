import React, { useState } from 'react';
import { Box, TextField, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button, Typography, Paper } from '@mui/material';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';

const UserSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const { sendFriendRequest } = useChatStore();
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const res = await api.get(`/users/search?query=${query}`);
            setResults(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (userId: string) => {
        try {
            await sendFriendRequest(userId);
            alert('Friend request sent!');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send request');
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by username or email"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button variant="contained" onClick={handleSearch} disabled={loading}>
                    Search
                </Button>
            </Box>

            <List dense>
                {results.map((user) => (
                    <ListItem key={user._id} secondaryAction={
                        <Button size="small" onClick={() => handleAdd(user._id)}>Add</Button>
                    }>
                        <ListItemAvatar>
                            <Avatar src={user.avatar}>{user.username[0].toUpperCase()}</Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={user.username} secondary={user.email} />
                    </ListItem>
                ))}
                {results.length === 0 && query && !loading && (
                    <Typography variant="body2" color="text.secondary" align="center">
                        No users found
                    </Typography>
                )}
            </List>
        </Box>
    );
};

export default UserSearch;
