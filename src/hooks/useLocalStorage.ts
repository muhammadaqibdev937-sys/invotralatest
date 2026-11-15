import { useCallback, useMemo } from 'react';

export function checkLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ea_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function useLocalStorageSupport() {
  const isAvailable = useMemo(() => checkLocalStorageAvailable(), []);

  const readItem = useCallback(
    <T,>(key: string): T | null => {
      if (!isAvailable) return null;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    [isAvailable]
  );

  const writeItem = useCallback(
    <T,>(key: string, value: T): boolean => {
      if (!isAvailable) return false;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    [isAvailable]
  );

  const removeItem = useCallback(
    (key: string): void => {
      if (!isAvailable) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    },
    [isAvailable]
  );

  return useMemo(
    () => ({ isAvailable, readItem, writeItem, removeItem }),
    [isAvailable, readItem, writeItem, removeItem]
  );
}
