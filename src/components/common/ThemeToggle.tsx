import styled from 'styled-components';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../contexts/theme';

const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.backgroundHover};
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <ToggleButton onClick={toggleTheme} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
    </ToggleButton>
  );
};

export default ThemeToggle;
