import { create } from 'zustand';
import api from '../services/api';

export interface User {
    _id: string;
    username: string;
    email: string;
    avatar: string;
}

export interface Message {
    _id: string;
    sender: string | User;
    receiver?: string;
    groupId?: string;
    content: string;
    type: 'text' | 'image' | 'system';
    createdAt: string;
    mentionAssistant?: boolean;
}

export interface Group {
    _id: string;
    name: string;
    description?: string;
    avatar?: string;
    assistantEnabled: boolean;
    role?: 'owner' | 'admin' | 'member';
    createdAt: string;
}

interface FriendRequest {
    _id: string;
    requester: User;
    recipient: User;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

interface ChatState {
    friends: User[];
    groups: Group[];
    pendingRequests: FriendRequest[];
    selectedFriend: User | null;
    selectedGroup: Group | null;
    selectedTaskType: string | null;
    selectedTaskName: string | null;
    messages: Message[];
    isLoading: boolean;

    fetchFriends: () => Promise<void>;
    fetchGroups: () => Promise<void>;
    fetchPendingRequests: () => Promise<void>;
    fetchMessages: (friendId: string) => Promise<void>;
    fetchGroupMessages: (groupId: string) => Promise<void>;
    fetchTaskMessages: (taskType: string) => Promise<void>;
    selectFriend: (friend: User) => void;
    selectGroup: (group: Group) => void;
    selectScheduledTask: (taskType: string, taskName?: string) => void;
    addMessage: (message: Message) => void;
    sendFriendRequest: (recipientId: string) => Promise<void>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    friends: [],
    groups: [],
    pendingRequests: [],
    selectedFriend: null,
    selectedGroup: null,
    selectedTaskType: null,
    selectedTaskName: null,
    messages: [],
    isLoading: false,

    fetchFriends: async () => {
        try {
            const res = await api.get('/friends');
            set({ friends: res.data });
        } catch (err) {
            console.error(err);
        }
    },

    fetchGroups: async () => {
        try {
            const res = await api.get('/groups');
            set({ groups: res.data });
        } catch (err) {
            console.error(err);
        }
    },

    fetchPendingRequests: async () => {
        try {
            const res = await api.get('/friends/requests/pending');
            set({ pendingRequests: res.data });
        } catch (err) {
            console.error(err);
        }
    },

    fetchMessages: async (friendId: string) => {
        try {
            set({ isLoading: true, messages: [] });
            const res = await api.get(`/messages/${friendId}`);
            set({ messages: res.data.messages ?? res.data, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    fetchGroupMessages: async (groupId: string) => {
        try {
            set({ isLoading: true, messages: [] });
            const res = await api.get(`/groups/${groupId}/messages`);
            set({ messages: res.data.messages ?? res.data, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    selectFriend: (friend) => {
        set({ selectedFriend: friend, selectedGroup: null, selectedTaskType: null });
        get().fetchMessages(friend._id);
    },

    selectGroup: (group) => {
        set({ selectedGroup: group, selectedFriend: null, selectedTaskType: null, selectedTaskName: null });
        get().fetchGroupMessages(group._id);
    },

    selectScheduledTask: (taskType: string, taskName?: string) => {
        set({ selectedTaskType: taskType, selectedTaskName: taskName || null, selectedFriend: null, selectedGroup: null });
        get().fetchTaskMessages(taskType);
    },

    fetchTaskMessages: async (taskType: string) => {
        try {
            set({ isLoading: true, messages: [] });
            const res = await api.get(`/scheduled-tasks/${taskType}/messages`);
            set({ messages: res.data.messages || [], isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    addMessage: (message) => {
        const { selectedFriend, selectedGroup } = get();

        if (selectedGroup && message.groupId === selectedGroup._id) {
            set((state) => ({ messages: [...state.messages, message] }));
            return;
        }

        if (!selectedFriend) return;

        const friendId = selectedFriend._id;
        const senderId = typeof message.sender === 'string' ? message.sender : message.sender._id;
        if (senderId === friendId || message.receiver === friendId) {
            set((state) => ({ messages: [...state.messages, message] }));
        }
    },

    sendFriendRequest: async (recipientId: string) => {
        await api.post('/friends/request', { recipientId });
    },

    acceptFriendRequest: async (requestId: string) => {
        await api.put(`/friends/request/${requestId}/accept`);
        get().fetchPendingRequests();
        get().fetchFriends();
    },
}));
