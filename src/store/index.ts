import { configureStore, combineReducers, type Reducer } from '@reduxjs/toolkit';
import { persistStore, persistReducer, createTransform, type PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer, { type AuthState } from './slices/authSlice';
import onboardingReducer, { type OnboardingState } from './slices/onboardingSlice';
import gettingStartedReducer, { type GettingStartedState } from './slices/gettingStartedSlice';

const CHAT_ENC_KEY_SESSION_KEY = 'plurality_chatEncKey';

// Transform to handle chatEncKey separately from localStorage persistence
// chatEncKey is stored in sessionStorage (ephemeral, survives refresh, clears on tab close)
const authTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: ReturnType<typeof authReducer>) => {
    const { chatEncKey, ...rest } = inboundState;
    // Sync chatEncKey to sessionStorage (ephemeral, tab-scoped)
    try {
      if (chatEncKey) {
        sessionStorage.setItem(CHAT_ENC_KEY_SESSION_KEY, chatEncKey);
      } else {
        // Clear sessionStorage on logout (when chatEncKey becomes null)
        sessionStorage.removeItem(CHAT_ENC_KEY_SESSION_KEY);
      }
    } catch {
      // sessionStorage may be unavailable (private browsing, etc.)
    }
    return rest; // Don't persist chatEncKey to localStorage
  },
  // Transform state being rehydrated
  (outboundState) => {
    // Try to recover chatEncKey from sessionStorage (survives page refresh)
    let chatEncKey: string | null = null;
    try {
      chatEncKey = sessionStorage.getItem(CHAT_ENC_KEY_SESSION_KEY);
    } catch {
      // sessionStorage may be unavailable
    }
    return {
      ...outboundState,
      chatEncKey, // Will be the cached value or null
    };
  },
  { whitelist: ['auth'] }
);

const rootReducer = combineReducers({
  auth: authReducer,
  onboarding: onboardingReducer,
  gettingStarted: gettingStartedReducer,
});

// Define the root state type
interface RootStateType {
  auth: AuthState;
  onboarding: OnboardingState;
  gettingStarted: GettingStartedState;
}

const persistConfig: PersistConfig<RootStateType> = {
  key: 'plurality-marketplace',
  storage,
  whitelist: ['auth', 'onboarding', 'gettingStarted'],
  transforms: [authTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer as Reducer<RootStateType>);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

// Use the explicitly defined RootStateType to ensure all slices are always present
export type RootState = RootStateType;
export type AppDispatch = typeof store.dispatch;
