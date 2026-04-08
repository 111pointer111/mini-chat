import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, TextField, List, ListItem, ListItemAvatar, Avatar, ListItemText, Button, Typography, InputAdornment, CircularProgress } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import api from '../services/api';
import { useChatStore } from '../store/chatStore';

interface SearchResultUser {
    _id: string;
    username: string;
    email: string;
    avatar: string;
}

const UserSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResultUser[]>([]);
    const { sendFriendRequest } = useChatStore();
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const doSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }
        setLoading(true);
        try {
            const res = await api.get(`/users/search?query=${searchQuery}`);
            setResults(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced search on query change
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            doSearch(query);
        }, 300);
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, doSearch]);

    const handleSearch = () => {
        doSearch(query);
    };

    const handleAdd = async (userId: string) => {
        try {
            await sendFriendRequest(userId);
            alert('好友请求已发送!');
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            alert(axiosErr.response?.data?.message || '发送请求失败');
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <TextField
                fullWidth
                size="small"
                placeholder="搜索用户名或邮箱"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" fontSize="small" />
                        </InputAdornment>
                    ),
                    endAdornment: loading ? (
                        <InputAdornment position="end">
                            <CircularProgress size={18} />
                        </InputAdornment>
                    ) : null,
                }}
            />

            <List dense>
                {results.map((user) => (
                    <ListItem key={user._id} secondaryAction={
                        <Button size="small" onClick={() => handleAdd(user._id)}>添加</Button>
                    }>
                        <ListItemAvatar>
                            <Avatar src={user.avatar}>{user.username[0].toUpperCase()}</Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={user.username} secondary={user.email} />
                    </ListItem>
                ))}
                {results.length === 0 && query && !loading && (
                    <Typography variant="body2" color="text.secondary" align="center">
                        未找到用户
                    </Typography>
                )}
            </List>
        </Box>
    );
};

export default UserSearch;
