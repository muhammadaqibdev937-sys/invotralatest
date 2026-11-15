import { useEffect } from 'react';

export type ThemeMode = 'dark';

export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return { theme: 'dark' as ThemeMode };
}
