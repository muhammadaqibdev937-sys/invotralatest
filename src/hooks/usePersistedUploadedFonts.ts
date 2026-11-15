import { useCallback, useEffect, useState } from 'react';
import {
  clearAllUploadedFonts,
  deleteUploadedFont,
  getUploadedFonts,
  hydrateUploadedFontsFromIndexedDb,
  isUploadedFontsHydrated,
  subscribeUploadedFonts,
  UploadedFontRecord,
} from '../services/uploadedFonts';
import { isIndexedDbAvailable } from '../services/uploadedFontStorage';

export interface UsePersistedUploadedFontsOptions {
  hydrateOnMount?: boolean;
  registerFontFace?: (family: string, sourceBuffer: ArrayBuffer) => Promise<void>;
}

export interface UsePersistedUploadedFontsResult {
  uploadedFonts: UploadedFontRecord[];
  fontRegistryVersion: number;
  isHydrating: boolean;
  isHydrated: boolean;
  storageSupported: boolean;
  removeFont: (family: string) => Promise<boolean>;
  clearAllFonts: () => Promise<boolean>;
}

export function usePersistedUploadedFonts(
  options?: UsePersistedUploadedFontsOptions
): UsePersistedUploadedFontsResult {
  const hydrateOnMount = options?.hydrateOnMount ?? true;
  const customRegisterFontFace = options?.registerFontFace;

  const [uploadedFonts, setUploadedFonts] = useState<UploadedFontRecord[]>(() =>
    getUploadedFonts()
  );
  const [fontRegistryVersion, setFontRegistryVersion] = useState(0);
  const [isHydrated, setIsHydrated] = useState(() => isUploadedFontsHydrated());
  const [isHydrating, setIsHydrating] = useState(() => hydrateOnMount && !isUploadedFontsHydrated());
  const [storageSupported, setStorageSupported] = useState(() => isIndexedDbAvailable());

  useEffect(() => {
    const syncSnapshot = () => {
      setUploadedFonts(getUploadedFonts());
      setFontRegistryVersion((v) => v + 1);
    };

    const unsubscribe = subscribeUploadedFonts(syncSnapshot);

    if (!hydrateOnMount) {
      return unsubscribe;
    }

    let cancelled = false;
    if (!isUploadedFontsHydrated()) {
      setIsHydrating(true);
    }

    hydrateUploadedFontsFromIndexedDb(
      customRegisterFontFace ? { registerFontFace: customRegisterFontFace } : undefined
    )
      .then((res) => {
        if (cancelled) return;
        setStorageSupported(res.storageAvailable);
        setUploadedFonts(getUploadedFonts());
        setIsHydrated(true);
        setIsHydrating(false);
        if (res.restored.length > 0) {
          setFontRegistryVersion((v) => v + 1);
        }
      })
      .catch((err) => {
        console.warn('[usePersistedUploadedFonts] Hydration error:', err);
        if (cancelled) return;
        setStorageSupported(false);
        setIsHydrated(true);
        setIsHydrating(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hydrateOnMount, customRegisterFontFace]);

  const removeFont = useCallback(async (family: string): Promise<boolean> => {
    return deleteUploadedFont(family);
  }, []);

  const clearAllFonts = useCallback(async (): Promise<boolean> => {
    return clearAllUploadedFonts();
  }, []);

  return {
    uploadedFonts,
    fontRegistryVersion,
    isHydrating,
    isHydrated,
    storageSupported,
    removeFont,
    clearAllFonts,
  };
}
