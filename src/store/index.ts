import { configureStore, combineReducers, type Reducer } from '@reduxjs/toolkit';
import { persistStore, persistReducer, type PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import authReducer, { type AuthState } from './slices/authSlice';

const rootReducer = combineReducers({
  auth: authReducer,
});

// Define the root state type
interface RootStateType {
  auth: AuthState;
}

const persistConfig: PersistConfig<RootStateType> = {
  key: 'plurality-marketplace',
  storage,
  whitelist: ['auth'],
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
