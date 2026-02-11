import { create } from 'zustand';
import api from '../services/api';

export interface User {
    _id: string; // MongoDB ID usually _id, but our User model response might map it or we use raw
    id?: string; // in case we mapped it
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

interface ChatState {
    friends: User[];
    pendingRequests: any[];
    selectedFriend: User | null;
    messages: Message[];
    isLoading: boolean;

    fetchFriends: () => Promise<void>;
    fetchPendingRequests: () => Promise<void>;
    fetchMessages: (friendId: string) => Promise<void>;
    selectFriend: (friend: User) => void;
    addMessage: (message: Message) => void;
    sendFriendRequest: (recipientId: string) => Promise<void>;
    acceptFriendRequest: (requestId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    friends: [],
    pendingRequests: [],
    selectedFriend: null,
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
            set({ isLoading: true, messages: [] }); // Clear prev messages
            // We assume the friend object passed has the correct ID usually mapped to _id
            // But verify if your API returns _id or id
            const res = await api.get(`/messages/${friendId}`);
            set({ messages: res.data, isLoading: false });
        } catch (err) {
            console.error(err);
            set({ isLoading: false });
        }
    },

    selectFriend: (friend) => {
        set({ selectedFriend: friend });
        get().fetchMessages(friend._id || friend.id!);
    },

    addMessage: (message) => {
        // Only add if it belongs to current chat
        const { selectedFriend } = get();
        if (!selectedFriend) return;

        // Check if message is related to current selected friend (sender or receiver)
        // IDs might be string or object, careful comparison needed
        const friendId = selectedFriend._id || selectedFriend.id;
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
