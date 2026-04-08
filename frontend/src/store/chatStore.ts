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
    sender: string;
    receiver: string;
    content: string;
    type: 'text' | 'image' | 'system';
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
    pendingRequests: FriendRequest[];
    selectedFriend: User | null;
    selectedTaskType: string | null;
    selectedTaskName: string | null;
    messages: Message[];
    isLoading: boolean;

    fetchFriends: () => Promise<void>;
    fetchPendingRequests: () => Promise<void>;
    fetchMessages: (friendId: string) => Promise<void>;
    fetchTaskMessages: (taskType: string) => Promise<void>;
    selectFriend: (friend: User) => void;
    selectScheduledTask: (taskType: string, taskName?: string) => void;
    addMessage: (message: Message) => void;
    sendFriendRequest: (recipientId: string) => Promise<void>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    friends: [],
    pendingRequests: [],
    selectedFriend: null,
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
            set({ messages: res.data, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    selectFriend: (friend) => {
        set({ selectedFriend: friend, selectedTaskType: null });
        get().fetchMessages(friend._id);
    },

    selectScheduledTask: (taskType: string, taskName?: string) => {
        set({ selectedTaskType: taskType, selectedTaskName: taskName || null, selectedFriend: null });
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
        const { selectedFriend } = get();
        if (!selectedFriend) return;

        const friendId = selectedFriend._id;
        if (message.sender === friendId || message.receiver === friendId) {
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
