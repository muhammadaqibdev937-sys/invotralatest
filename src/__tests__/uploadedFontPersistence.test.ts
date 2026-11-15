import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFontAvailabilityCache, isFontAvailableInBrowser } from '../engine/fonts';
import { SvgEditorDocumentStateV1 } from '../engine/schema';
import { parseSvgToScene, scanSceneFontUsage } from '../engine/svgScene';
import { usePersistedUploadedFonts } from '../hooks/usePersistedUploadedFonts';
import {
  buildEditableSvgString,
  collectEmbeddedFontCssForExport,
} from '../services/exportSVG';
import {
  clearAllUploadedFonts,
  clearUploadedFonts,
  clearUploadedFontsInMemoryOnly,
  deleteUploadedFont,
  getUploadedFonts,
  hydrateUploadedFontsFromIndexedDb,
  uploadFontFromBytes,
} from '../services/uploadedFonts';
import {
  getAllFontRecordsFromIndexedDb,
  saveFontRecordToIndexedDb,
  UPLOADED_FONT_STORE_NAME,
} from '../services/uploadedFontStorage';

interface MockStoreEntry {
  keyPath: string;
  records: Map<string, Record<string, unknown>>;
}

function createInMemoryIndexedDb(): {
  factory: IDBFactory;
  databases: Map<string, { version: number; stores: Map<string, MockStoreEntry> }>;
} {
  const databases = new Map<string, { version: number; stores: Map<string, MockStoreEntry> }>();

  const schedule = (fn: () => void) => {
    Promise.resolve().then(fn);
  };

  const makeRequest = <T,>() => {
    const req: {
      result: T;
      error: DOMException | null;
      onsuccess: ((ev: Event) => void) | null;
      onerror: ((ev: Event) => void) | null;
      onupgradeneeded: ((ev: IDBVersionChangeEvent) => void) | null;
      onblocked: ((ev: Event) => void) | null;
    } = {
      result: undefined as unknown as T,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      onblocked: null,
    };
    return req;
  };

  const factory = {
    open(name: string, version = 1) {
      const req = makeRequest<IDBDatabase>();
      schedule(() => {
        let dbEntry = databases.get(name);
        const needsUpgrade = !dbEntry || dbEntry.version < version;
        if (!dbEntry) {
          dbEntry = { version, stores: new Map() };
          databases.set(name, dbEntry);
        } else if (dbEntry.version < version) {
          dbEntry.version = version;
        }

        const mockDb = {
          name,
          version: dbEntry.version,
          objectStoreNames: {
            contains: (storeName: string) => dbEntry!.stores.has(storeName),
          },
          createObjectStore: (storeName: string, opts?: { keyPath?: string }) => {
            const store: MockStoreEntry = {
              keyPath: opts?.keyPath ?? 'id',
              records: new Map(),
            };
            dbEntry!.stores.set(storeName, store);
            return {} as IDBObjectStore;
          },
          close: () => {},
          transaction: (storeNames: string | string[]) => {
            const targetName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
            const storeEntry = dbEntry!.stores.get(targetName);
            const tx: {
              oncomplete: ((ev: Event) => void) | null;
              onerror: ((ev: Event) => void) | null;
              onabort: ((ev: Event) => void) | null;
              error: DOMException | null;
              objectStore: (name: string) => IDBObjectStore;
            } = {
              oncomplete: null,
              onerror: null,
              onabort: null,
              error: null,
              objectStore: () => {
                if (!storeEntry) {
                  throw new DOMException('Object store not found', 'NotFoundError');
                }
                let pendingOps = 0;
                const doneOp = () => {
                  pendingOps -= 1;
                  if (pendingOps <= 0) {
                    schedule(() => {
                      tx.oncomplete?.(new Event('complete'));
                    });
                  }
                };

                return {
                  put: (value: Record<string, unknown>) => {
                    pendingOps += 1;
                    const putReq = makeRequest<IDBValidKey>();
                    schedule(() => {
                      const key = String(value[storeEntry.keyPath]);
                      storeEntry.records.set(key, structuredClone(value));
                      putReq.result = key;
                      putReq.onsuccess?.(new Event('success'));
                      doneOp();
                    });
                    return putReq as unknown as IDBRequest<IDBValidKey>;
                  },
                  getAll: () => {
                    pendingOps += 1;
                    const getAllReq = makeRequest<unknown[]>();
                    schedule(() => {
                      getAllReq.result = Array.from(storeEntry.records.values()).map((v) =>
                        structuredClone(v)
                      );
                      getAllReq.onsuccess?.(new Event('success'));
                      doneOp();
                    });
                    return getAllReq as unknown as IDBRequest<unknown[]>;
                  },
                  delete: (key: IDBValidKey) => {
                    pendingOps += 1;
                    const delReq = makeRequest<undefined>();
                    schedule(() => {
                      storeEntry.records.delete(String(key));
                      delReq.result = undefined;
                      delReq.onsuccess?.(new Event('success'));
                      doneOp();
                    });
                    return delReq as unknown as IDBRequest<undefined>;
                  },
                  clear: () => {
                    pendingOps += 1;
                    const clearReq = makeRequest<undefined>();
                    schedule(() => {
                      storeEntry.records.clear();
                      clearReq.result = undefined;
                      clearReq.onsuccess?.(new Event('success'));
                      doneOp();
                    });
                    return clearReq as unknown as IDBRequest<undefined>;
                  },
                } as unknown as IDBObjectStore;
              },
            };
            return tx as unknown as IDBTransaction;
          },
        } as unknown as IDBDatabase;

        req.result = mockDb;
        if (needsUpgrade) {
          req.onupgradeneeded?.({} as IDBVersionChangeEvent);
        }
        req.onsuccess?.(new Event('success'));
      });
      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return { factory, databases };
}

function makeFontBytes(magic: number[], totalLen = 64): Uint8Array {
  const bytes = new Uint8Array(totalLen);
  magic.forEach((b, i) => {
    bytes[i] = b;
  });
  return bytes;
}

describe('IndexedDB persistence & hydration for user-uploaded fonts', () => {
  let activeRoots: Array<{ root: Root; host: HTMLDivElement }> = [];

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const { factory } = createInMemoryIndexedDb();
    vi.stubGlobal('indexedDB', factory);
    clearUploadedFontsInMemoryOnly();
  });

  afterEach(async () => {
    for (const item of activeRoots) {
      await act(async () => {
        item.root.unmount();
      });
      item.host.remove();
    }
    activeRoots = [];
    clearUploadedFonts();
    clearUploadedFontsInMemoryOnly();
    clearFontAvailabilityCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists uploaded fonts to IndexedDB and restores them after simulated session reload', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
        <text x="100" y="140" font-family="Studio Script Pro" font-size="42">Elena &amp; Marcus</text>
      </svg>
    `;
    const scene = parseSvgToScene(svg, 'Persisted Font Test');

    // Upload a valid .woff2 font
    const uploaded = await uploadFontFromBytes({
      fileName: 'Studio_Script_Pro.woff2',
      bytes: makeFontBytes([0x77, 0x4f, 0x46, 0x32], 96),
      options: { registerFontFace: async () => {} },
    });
    expect(uploaded.family).toBe('Studio Script Pro');

    const storedBeforeReload = await getAllFontRecordsFromIndexedDb();
    expect(storedBeforeReload).toHaveLength(1);
    expect(storedBeforeReload[0].family).toBe('Studio Script Pro');

    // Simulate full browser reload: wipe in-memory & engine font registries only
    clearUploadedFontsInMemoryOnly();
    expect(getUploadedFonts()).toHaveLength(0);
    expect(scanSceneFontUsage(scene, () => false).missingCount).toBe(1);

    const registeredCalls: Array<{ family: string; byteLength: number }> = [];
    const hydration = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async (family, buf) => {
        registeredCalls.push({ family, byteLength: buf.byteLength });
      },
    });

    expect(hydration.storageAvailable).toBe(true);
    expect(hydration.skippedCount).toBe(0);
    expect(hydration.restored).toHaveLength(1);
    expect(registeredCalls).toEqual([{ family: 'Studio Script Pro', byteLength: 96 }]);
    expect(getUploadedFonts()).toHaveLength(1);
    expect(isFontAvailableInBrowser('Studio Script Pro')).toBe(true);
    expect(scanSceneFontUsage(scene, () => false).missingCount).toBe(0);
  });

  it('removes deleted fonts and clears all persisted fonts from IndexedDB', async () => {
    await uploadFontFromBytes({
      fileName: 'FirstCustom.ttf',
      bytes: makeFontBytes([0x00, 0x01, 0x00, 0x00]),
      options: { registerFontFace: async () => {} },
    });
    await uploadFontFromBytes({
      fileName: 'SecondCustom.otf',
      bytes: makeFontBytes([0x4f, 0x54, 0x54, 0x4f]),
      options: { registerFontFace: async () => {} },
    });

    expect(await getAllFontRecordsFromIndexedDb()).toHaveLength(2);

    const deleted = await deleteUploadedFont('FirstCustom');
    expect(deleted).toBe(true);

    // Reload simulation -> only SecondCustom returns
    clearUploadedFontsInMemoryOnly();
    const afterDelete = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async () => {},
    });
    expect(afterDelete.restored.map((r) => r.family)).toEqual(['SecondCustom']);

    // Clear all -> 0 remain across reload
    const cleared = await clearAllUploadedFonts();
    expect(cleared).toBe(true);
    clearUploadedFontsInMemoryOnly();
    const afterClear = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async () => {},
    });
    expect(afterClear.restored).toHaveLength(0);
  });

  it('isolates and skips corrupt persisted records without breaking valid restored fonts', async () => {
    await uploadFontFromBytes({
      fileName: 'ValidSerif.ttf',
      bytes: makeFontBytes([0x00, 0x01, 0x00, 0x00]),
      options: { registerFontFace: async () => {} },
    });

    // Inject corrupt record directly into IndexedDB store
    await saveFontRecordToIndexedDb({
      id: 'uploaded_corrupt_font',
      family: 'Corrupt Font',
      fileName: 'corrupt.woff2',
      extension: '.woff2',
      cssFormat: 'woff2',
      mimeType: 'font/woff2',
      byteSize: 32,
      base64Data: 'not-valid-woff2-magic-bytes!!!',
      category: 'Serif',
      loadedViaFontFace: false,
      uploadedAt: Date.now(),
    });

    clearUploadedFontsInMemoryOnly();
    const hydration = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async () => {},
    });

    expect(hydration.restored.map((r) => r.family)).toEqual(['ValidSerif']);
    expect(hydration.skippedCount).toBe(1);
    expect(getUploadedFonts()).toHaveLength(1);
  });

  it('degrades gracefully when indexedDB is missing or throws SecurityError', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const sessionOnly = await uploadFontFromBytes({
      fileName: 'FallbackSession.otf',
      bytes: makeFontBytes([0x4f, 0x54, 0x54, 0x4f]),
      options: { registerFontFace: async () => {} },
    });
    expect(sessionOnly.family).toBe('FallbackSession');
    expect(getUploadedFonts()).toHaveLength(1);

    clearUploadedFontsInMemoryOnly();
    const missingResult = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async () => {},
    });
    expect(missingResult.storageAvailable).toBe(false);
    expect(missingResult.restored).toEqual([]);

    // Now simulate SecurityError when opening indexedDB (e.g., restricted private mode)
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('Access denied', 'SecurityError');
      },
    } as unknown as IDBFactory);

    clearUploadedFontsInMemoryOnly();
    const blockedUpload = await uploadFontFromBytes({
      fileName: 'BlockedMode.ttf',
      bytes: makeFontBytes([0x00, 0x01, 0x00, 0x00]),
      options: { registerFontFace: async () => {} },
    });
    expect(blockedUpload.family).toBe('BlockedMode');
    const savedOk = await saveFontRecordToIndexedDb(blockedUpload);
    expect(savedOk).toBe(false);

    clearUploadedFontsInMemoryOnly();
    const blockedHydrate = await hydrateUploadedFontsFromIndexedDb({
      registerFontFace: async () => {},
    });
    expect(blockedHydrate.restored).toEqual([]);
  });

  it('usePersistedUploadedFonts hook hydrates on mount and keeps SVG export embedding off by default', async () => {
    // Seed a font then simulate reload
    const saved = await uploadFontFromBytes({
      fileName: 'ClientAtelier.woff2',
      bytes: makeFontBytes([0x77, 0x4f, 0x46, 0x32], 48),
      options: { registerFontFace: async () => {} },
    });
    expect(saved.family).toBe('ClientAtelier');
    clearUploadedFontsInMemoryOnly();

    const hookSnapshots: Array<{ count: number; hydrated: boolean; version: number; supported: boolean }> = [];
    const registerHook = vi.fn(async () => {});

    const Probe: React.FC = () => {
      const state = usePersistedUploadedFonts({ registerFontFace: registerHook });
      hookSnapshots.push({
        count: state.uploadedFonts.length,
        hydrated: state.isHydrated,
        version: state.fontRegistryVersion,
        supported: state.storageSupported,
      });
      return React.createElement(
        'div',
        { 'data-testid': 'font-probe' },
        state.uploadedFonts.map((f) => f.family).join(',')
      );
    };

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    activeRoots.push({ root, host });

    await act(async () => {
      root.render(React.createElement(Probe));
    });
    // Flush async IDB promise ticks
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(host.textContent).toBe('ClientAtelier');
    expect(registerHook).toHaveBeenCalledTimes(1);
    const latest = hookSnapshots[hookSnapshots.length - 1];
    expect(latest.hydrated).toBe(true);
    expect(latest.supported).toBe(true);
    expect(latest.count).toBe(1);
    expect(latest.version).toBeGreaterThan(0);

    // Confirm restored uploaded font still is NOT embedded into exported SVG by default
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><text x="80" y="100" font-family="ClientAtelier" font-size="32">Hello</text></svg>`;
    const scene = parseSvgToScene(svg, 'Privacy Check');
    const docState: SvgEditorDocumentStateV1 = {
      designVersion: '1',
      scene,
      transparentBackground: false,
    };
    const defaultCss = await collectEmbeddedFontCssForExport(docState, { embedFonts: false });
    expect(defaultCss).toBeUndefined();
    const defaultSvg = buildEditableSvgString(docState, defaultCss);
    expect(defaultSvg).not.toContain('data:font/woff2;base64');
    expect(UPLOADED_FONT_STORE_NAME).toBe('uploaded_fonts');
  });
});
