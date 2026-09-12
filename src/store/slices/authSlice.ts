import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  authMethod: 'metamask' | null;
  isLoading: boolean;
  error: string | null;
  // Wallet is on the team allowlist (backend ADMIN_WALLETS). Gates curation
  // UI like the "feature on homepage" toggle; the backend re-checks anyway.
  isAdmin: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
  authMethod: null,
  isLoading: false,
  error: null,
  isAdmin: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    setAuthMethod: (state, action: PayloadAction<'metamask' | null>) => {
      state.authMethod = action.payload;
    },
    setIsAdmin: (state, action: PayloadAction<boolean>) => {
      state.isAdmin = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      state.authMethod = null;
      state.error = null;
      state.isAdmin = false;
    },
  },
});

export const { setLoading, setUser, updateUser, setToken, setAuthMethod, setIsAdmin, setError, logout } =
  authSlice.actions;
export default authSlice.reducer;
