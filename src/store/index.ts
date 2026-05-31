import { configureStore, combineReducers, type Reducer } from '@reduxjs/toolkit';
import { persistStore, persistReducer, type PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer, { type AuthState } from './slices/authSlice';
import onboardingReducer, { type OnboardingState } from './slices/onboardingSlice';
import gettingStartedReducer, { type GettingStartedState } from './slices/gettingStartedSlice';

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
