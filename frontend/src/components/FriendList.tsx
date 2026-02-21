import React, { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemAvatar, Avatar, ListItemText, Typography, Divider, Button, Badge } from '@mui/material';
import { GitHub, MenuBook, Translate, AutoAwesome } from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';

interface PresetTask {
    _id?: string;
    taskType: string;
    taskName: string;
    enabled: boolean;
    pushTime: string;
    conversationId?: string;
    isCustom: false;
}

interface CustomTask {
    _id: string;
    taskType: 'custom';
    taskName: string;
    prompt?: string;
    enabled: boolean;
    pushTime: string;
    conversationId?: string;
    isCustom: true;
}

type ScheduledTaskConversation = PresetTask | CustomTask;

const TASK_ICONS: Record<string, React.ReactNode> = {
    github_trending: <GitHub />,
    daily_poem: <MenuBook />,
    daily_english: <Translate />,
    custom: <AutoAwesome />,
};

const FriendList: React.FC = () => {
    const { friends, pendingRequests, fetchFriends, fetchPendingRequests, selectFriend, acceptFriendRequest, selectedFriend, selectScheduledTask, selectedTaskType } = useChatStore();
    const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskConversation[]>([]);

    useEffect(() => {
        fetchFriends();
        fetchPendingRequests();
        fetchScheduledTasks();

        // Poll for updates every 10 seconds (in a real app, use socket events for requests too)
        const interval = setInterval(() => {
            fetchFriends();
            fetchPendingRequests();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchFriends, fetchPendingRequests]);

    const fetchScheduledTasks = async () => {
        try {
            const res = await api.get('/scheduled-tasks');
            const { presetTasks, customTasks } = res.data;
            const allTasks = [
                ...presetTasks.filter((t: PresetTask) => t.enabled),
                ...customTasks.filter((t: CustomTask) => t.enabled),
            ];
            setScheduledTasks(allTasks);
        } catch (err) {
            console.error('Failed to fetch scheduled tasks:', err);
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        Friend Requests
                    </Typography>
                    <List dense>
                        {pendingRequests.map((req: any) => (
                            <ListItem key={req._id}>
                                <ListItemAvatar>
                                    <Avatar>{req.requester.username[0]}</Avatar>
                                </ListItemAvatar>
                                <ListItemText primary={req.requester.username} />
                                <Button size="small" variant="outlined" onClick={() => acceptFriendRequest(req._id)}>
                                    Accept
                                </Button>
                            </ListItem>
                        ))}
                    </List>
                    <Divider />
                </Box>
            )}

            {/* Scheduled Tasks Section */}
            {scheduledTasks.length > 0 && (
                <>
                    <Typography variant="subtitle2" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        定时推送
                    </Typography>
                    <List dense>
                        {scheduledTasks.map((task) => {
                            const taskKey = task.isCustom ? task._id : task.taskType;
                            const taskIcon = TASK_ICONS[task.taskType] || TASK_ICONS.custom;
                            return (
                                <ListItemButton
                                    key={taskKey}
                                    selected={selectedTaskType === taskKey}
                                    onClick={() => selectScheduledTask(taskKey, task.taskName)}
                                >
                                    <ListItemAvatar>
                                        <Avatar sx={{ bgcolor: task.isCustom ? 'secondary.main' : 'primary.main' }}>
                                            {taskIcon}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText primary={task.taskName} />
                                </ListItemButton>
                            );
                        })}
                    </List>
                    <Divider />
                </>
            )}

            <Typography variant="subtitle2" sx={{ p: 2, bgcolor: 'action.hover' }}>
                Friends
            </Typography>
            <List sx={{ flex: 1, overflowY: 'auto' }}>
                {friends.map((friend) => (
                    <ListItemButton
                        key={friend._id || friend.id}
                        selected={selectedFriend?._id === friend._id || selectedFriend?.id === friend.id}
                        onClick={() => selectFriend(friend)}
                    >
                        <ListItemAvatar>
                            <Badge color="success" variant="dot" invisible={false /* TODO: Online status */}>
                                <Avatar src={friend.avatar}>{friend.username[0].toUpperCase()}</Avatar>
                            </Badge>
                        </ListItemAvatar>
                        <ListItemText primary={friend.username} secondary={friend.email} />
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );
};

export default FriendList;
