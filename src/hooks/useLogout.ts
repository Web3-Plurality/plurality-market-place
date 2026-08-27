import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisconnect } from 'wagmi';
import { message } from 'antd';
import { useAppDispatch } from './useAppStore';
import { logout } from '../store/slices/authSlice';
import { apiPost } from '../utils/api';

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { disconnectAsync } = useDisconnect();

  const handleLogout = useCallback(async () => {
    try {
      // Disconnect wallet if connected
      try {
        await disconnectAsync();
      } catch {
        // Ignore disconnect errors
      }

      // Call backend to clear the HttpOnly auth cookie. Market stack is
      // MetaMask-only (SIWE), so we point at the SIWE logout route.
      try {
        await apiPost('/auth/siwe/logout');
      } catch {
        // Continue with logout even if the API call fails — frontend state
        // is cleared below regardless so the user definitely lands signed-out.
        console.warn('Failed to call logout API');
      }

      // Clear Redux auth state (persisted via redux-persist)
      dispatch(logout());

      // Navigate to login
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      message.error('Failed to logout');
    }
  }, [dispatch, disconnectAsync, navigate]);

  return { logout: handleLogout };
};
