import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'invitora:theme';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Ignore storage read errors
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'dark';
}

function applyThemeToDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
}

let currentTheme: ThemeMode = readInitialTheme();
const listeners = new Set<(mode: ThemeMode) => void>();

function broadcastTheme(next: ThemeMode): void {
  currentTheme = next;
  applyThemeToDom(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Ignore storage write errors
  }
  listeners.forEach((listener) => listener(next));
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(currentTheme);

  useEffect(() => {
    applyThemeToDom(currentTheme);
    const handler = (mode: ThemeMode) => setThemeState(mode);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    broadcastTheme(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    broadcastTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, setTheme, toggleTheme };
}
