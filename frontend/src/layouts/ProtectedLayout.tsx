import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const ProtectedLayout: React.FC = () => {
    const { isAuthenticated, login, logout, token } = useAuthStore();
    const [isLoading, setIsLoading] = React.useState(true);

    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const response = await api.get('/auth/me');
                login(response.data.user, token);
            } catch {
                useAuthStore.getState().logout();
                // Socket will be disconnected by Dashboard unmount or we can force it here
            } finally {
                setIsLoading(false);
            }
        };

        if (!isAuthenticated && token) {
            verifyToken();
        } else {
            setIsLoading(false);
        }
    }, [isAuthenticated, token, login, logout]);

    if (isLoading) {
        return <div>Loading...</div>; // Or a proper loading spinner
    }

    if (!isAuthenticated && !token) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedLayout;
