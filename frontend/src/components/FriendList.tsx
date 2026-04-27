import React, { useEffect, useState } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemAvatar, Avatar, ListItemText, Typography, Divider, Button, Badge, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Checkbox, IconButton, Tooltip } from '@mui/material';
import { GitHub, MenuBook, Translate, AutoAwesome, Groups, Add } from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';

interface FriendRequestItem {
    _id: string;
    requester: { _id: string; username: string; avatar: string };
    recipient: { _id: string; username: string; avatar: string };
    status: string;
    createdAt: string;
}

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
    const {
        friends,
        groups,
        pendingRequests,
        fetchFriends,
        fetchGroups,
        fetchPendingRequests,
        selectFriend,
        selectGroup,
        acceptFriendRequest,
        selectedFriend,
        selectedGroup,
        selectScheduledTask,
        selectedTaskType,
    } = useChatStore();
    const [scheduledTasks, setScheduledTasks] = useState<ScheduledTaskConversation[]>([]);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

    useEffect(() => {
        fetchFriends();
        fetchGroups();
        fetchPendingRequests();
        fetchScheduledTasks();

        // Poll for updates every 10 seconds (in a real app, use socket events for requests too)
        const interval = setInterval(() => {
            fetchFriends();
            fetchGroups();
            fetchPendingRequests();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchFriends, fetchGroups, fetchPendingRequests]);

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

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds((current) =>
            current.includes(memberId)
                ? current.filter((id) => id !== memberId)
                : [...current, memberId]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        await api.post('/groups', {
            name: groupName.trim(),
            memberIds: selectedMemberIds,
        });
        setGroupDialogOpen(false);
        setGroupName('');
        setSelectedMemberIds([]);
        await fetchGroups();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Pending Requests Section */}
            {pendingRequests.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" sx={{ p: 2, bgcolor: 'action.hover' }}>
                        好友请求
                    </Typography>
                    <List dense>
                        {pendingRequests.map((req: FriendRequestItem) => (
                            <ListItem key={req._id}>
                                <ListItemAvatar>
                                    <Avatar>{req.requester.username[0]}</Avatar>
                                </ListItemAvatar>
                                <ListItemText primary={req.requester.username} />
                                <Button size="small" variant="outlined" onClick={() => acceptFriendRequest(req._id)}>
                                    接受
                                </Button>
                            </ListItem>
                        ))}
                    </List>
                    <Divider />
                </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    群组
                </Typography>
                <Tooltip title="创建群组">
                    <IconButton size="small" onClick={() => setGroupDialogOpen(true)}>
                        <Add fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <List dense>
                {groups.map((group) => (
                    <ListItemButton
                        key={group._id}
                        selected={selectedGroup?._id === group._id}
                        onClick={() => selectGroup(group)}
                    >
                        <ListItemAvatar>
                            <Avatar src={group.avatar} sx={{ bgcolor: 'secondary.main' }}>
                                <Groups />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={group.name} secondary={group.assistantEnabled ? '@小助手可用' : '群聊'} />
                    </ListItemButton>
                ))}
                {groups.length === 0 && (
                    <ListItem>
                        <ListItemText
                            primary="暂无群组"
                            secondary="点击右侧加号创建"
                            primaryTypographyProps={{ color: 'text.secondary', variant: 'body2' }}
                        />
                    </ListItem>
                )}
            </List>
            <Divider />

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
                好友列表
            </Typography>
            <List sx={{ flex: 1, overflowY: 'auto' }}>
                {friends.map((friend) => (
                    <ListItemButton
                        key={friend._id}
                        selected={selectedFriend?._id === friend._id}
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

            <Dialog open={groupDialogOpen} onClose={() => setGroupDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>创建群组</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="群名称"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        选择好友加入
                    </Typography>
                    <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
                        {friends.map((friend) => (
                            <ListItemButton key={friend._id} onClick={() => toggleMember(friend._id)}>
                                <Checkbox checked={selectedMemberIds.includes(friend._id)} />
                                <ListItemAvatar>
                                    <Avatar src={friend.avatar}>{friend.username[0].toUpperCase()}</Avatar>
                                </ListItemAvatar>
                                <ListItemText primary={friend.username} secondary={friend.email} />
                            </ListItemButton>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setGroupDialogOpen(false)}>取消</Button>
                    <Button variant="contained" onClick={handleCreateGroup} disabled={!groupName.trim()}>
                        创建
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FriendList;
