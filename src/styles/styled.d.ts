import 'styled-components';
import { ThemeColors, ThemeMode } from '../contexts/theme';

declare module 'styled-components' {
  export interface DefaultTheme {
    mode: ThemeMode;
    colors: ThemeColors;
    isDark: boolean;
  }
}
