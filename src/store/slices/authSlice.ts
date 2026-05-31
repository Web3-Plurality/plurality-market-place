import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  googleJwtToken: string | null;
  authMethod: 'google' | 'email' | 'metamask' | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
  googleJwtToken: null,
  authMethod: null,
  isLoading: false,
  error: null,
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
    setGoogleJwtToken: (state, action: PayloadAction<string | null>) => {
      state.googleJwtToken = action.payload;
    },
    setAuthMethod: (state, action: PayloadAction<'google' | 'email' | 'metamask' | null>) => {
      state.authMethod = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.token = null;
      state.googleJwtToken = null;
      state.authMethod = null;
      state.error = null;
    },
  },
});

export const { setLoading, setUser, updateUser, setToken, setGoogleJwtToken, setAuthMethod, setError, logout } = authSlice.actions;
export default authSlice.reducer;
