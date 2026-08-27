import { createContext, useState, useEffect, useContext, type ReactNode } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryRgb: string;
  primaryGradient: string;
  extensionAccent: string;
  extensionAccentRgb: string;
  background: string;
  backgroundSecondary: string;
  backgroundGradient: string;
  backgroundHover: string;
  backgroundSelected: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  shadowColor: string;
  shadowPrimary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

const lightTheme: ThemeColors = {
  primary: '#667eea',
  primaryRgb: '102, 126, 234',
  primaryGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  extensionAccent: '#8002FF',
  extensionAccentRgb: '128, 2, 255',
  background: '#ffffff',
  backgroundSecondary: '#f8f9fa',
  backgroundGradient: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
  backgroundHover: '#f0f0f0',
  backgroundSelected: '#e8e8ff',
  textPrimary: '#000000',
  textSecondary: '#363837',
  textMuted: '#969595',
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  shadowColor: 'rgba(0, 0, 0, 0.12)',
  shadowPrimary: 'rgba(102, 126, 234, 0.3)',
  success: '#00CEBA',
  error: '#FF0080',
  warning: '#FF4E00',
  info: '#00B8FF',
};

const darkTheme: ThemeColors = {
  primary: '#00CEBA',
  primaryRgb: '0, 206, 186',
  primaryGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  extensionAccent: '#00CEBA',
  extensionAccentRgb: '0, 206, 186',
  background: '#1a1a1a',
  backgroundSecondary: '#252525',
  backgroundGradient: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
  backgroundHover: '#333333',
  backgroundSelected: '#1a3d3a',
  textPrimary: '#E3E4E4',
  textSecondary: '#969595',
  textMuted: '#6b6b6b',
  border: '#363837',
  borderLight: '#2d2d2d',
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  shadowPrimary: 'rgba(102, 126, 234, 0.3)',
  success: '#00CEBA',
  error: '#ef4444',
  warning: '#FF4E00',
  info: '#00B8FF',
};

export interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const getInitialTheme = (): ThemeMode => {
    // Check localStorage first
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  const [mode, setMode] = useState<ThemeMode>(getInitialTheme);

  // Listen for browser theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no manual preference is set
      const stored = localStorage.getItem('theme-mode');
      if (!stored) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const colors = mode === 'dark' ? darkTheme : lightTheme;
  const isDark = mode === 'dark';

  const contextValue: ThemeContextType = {
    mode,
    colors,
    isDark,
    toggleTheme,
  };

  const styledTheme = {
    mode,
    colors,
    isDark,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <StyledThemeProvider theme={styledTheme}>
        {children}
      </StyledThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { lightTheme, darkTheme };
