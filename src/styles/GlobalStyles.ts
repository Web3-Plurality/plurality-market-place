import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  /* Lexend font loaded via /fonts/lexend.css in index.html */

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
    width: 100%;
    font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textPrimary};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  #root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  a {
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: ${({ theme }) => theme.isDark ? '#00e6d0' : '#5568d8'};
    }
  }

  button {
    font-family: 'Lexend', sans-serif;
    cursor: pointer;
    border: none;
    background: none;
    font-size: inherit;
  }

  input, textarea {
    font-family: 'Lexend', sans-serif;
    font-size: inherit;
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    color: ${({ theme }) => theme.colors.textPrimary};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 12px 16px;
    transition: border-color 0.2s ease, background-color 0.2s ease;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.backgroundSecondary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 4px;

    &:hover {
      background: ${({ theme }) => theme.colors.textMuted};
    }
  }

  /* Selection */
  ::selection {
    background: ${({ theme }) => theme.colors.primary}40;
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;
