import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { store, persistor } from './store';
import type { RootState, AppDispatch } from './store';
import { setUser, setAuthMethod, logout } from './store/slices/authSlice';
import { wagmiConfig, queryClient } from './services/wagmi';
import { ThemeProvider } from './contexts/theme';
import { GlobalStyles } from './styles/GlobalStyles';
import { NotificationProvider } from './components/common/Notification';
import { tryRecoverSession } from './services/sessionRecovery';

// Marketplace is dark-themed end-to-end. ConfigProvider switches all antd
// surfaces (Modal, Spin, Empty, Pagination, Checkbox, message) to dark colors
// matched to the indigo/violet/pink palette used elsewhere.
const antdMarketplaceTheme = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#8b5cf6',
    colorBgBase: '#0c0e1c',
    colorBgContainer: '#181a2e',
    colorBgElevated: '#1a1d33',
    colorBorder: 'rgba(255, 255, 255, 0.12)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.75)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.55)',
    borderRadius: 10,
  },
};

// Pages
import LoginPage from './pages/Login';
import MarketplaceLayout from './layouts/MarketplaceLayout';

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch(logout());
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Always probe the backend cookie — never trust Redux-persist alone,
      // because localStorage can outlive the HttpOnly cookie (logout in another
      // tab, expiry, manual cookie clear) and leave the gate trusting a token
      // the backend no longer recognises.
      const session = await tryRecoverSession();

      // SIWE-only — no token to stash (the HttpOnly cookie IS the auth) and
      // no email loginMethod since marketplace is MetaMask-only.
      if (session.success && session.userId) {
        dispatch(setUser({ id: session.userId }));
        dispatch(setAuthMethod('metamask'));
      } else if (isAuthenticated) {
        dispatch(logout());
      }

      setIsInitializing(false);
    };

    initializeAuth();
  }, []);

  if (isInitializing) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Lexend, sans-serif',
        }}
      >
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ConfigProvider theme={antdMarketplaceTheme}>
                <GlobalStyles />
                <NotificationProvider>
                  <AuthInitializer>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/" element={<LoginPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/marketplace/*" element={<MarketplaceLayout />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </BrowserRouter>
                  </AuthInitializer>
                </NotificationProvider>
              </ConfigProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
