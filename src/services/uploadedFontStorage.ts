import type { AllowedFontExtension, UploadedFontRecord } from './uploadedFonts';
import type { FontCategory } from '../engine/fonts';

export const UPLOADED_FONT_DB_NAME = 'invotora-fonts-db';
export const UPLOADED_FONT_DB_VERSION = 1;
export const UPLOADED_FONT_STORE_NAME = 'uploaded_fonts';

const VALID_EXTENSIONS = new Set<AllowedFontExtension>(['.ttf', '.otf', '.woff2']);
const VALID_CATEGORIES = new Set<FontCategory>(['Serif', 'Sans', 'Script']);

function getIndexedDbFactory(): IDBFactory | null {
  try {
    if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis && globalThis.indexedDB) {
      return globalThis.indexedDB;
    }
  } catch {
    // Accessing indexedDB can throw SecurityError in restricted/sandboxed iframes
  }
  return null;
}

export function isIndexedDbAvailable(): boolean {
  return getIndexedDbFactory() !== null;
}

function isValidPersistedFontRecord(value: unknown): value is UploadedFontRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<UploadedFontRecord>;
  return (
    typeof r.id === 'string' &&
    r.id.trim().length > 0 &&
    typeof r.family === 'string' &&
    r.family.trim().length > 0 &&
    typeof r.fileName === 'string' &&
    typeof r.extension === 'string' &&
    VALID_EXTENSIONS.has(r.extension as AllowedFontExtension) &&
    typeof r.cssFormat === 'string' &&
    typeof r.mimeType === 'string' &&
    typeof r.byteSize === 'number' &&
    Number.isFinite(r.byteSize) &&
    r.byteSize > 0 &&
    typeof r.base64Data === 'string' &&
    r.base64Data.length > 0 &&
    typeof r.category === 'string' &&
    VALID_CATEGORIES.has(r.category as FontCategory)
  );
}

async function openUploadedFontDatabase(): Promise<IDBDatabase | null> {
  const idb = getIndexedDbFactory();
  if (!idb) return null;

  return new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(db);
    };

    try {
      const request = idb.open(UPLOADED_FONT_DB_NAME, UPLOADED_FONT_DB_VERSION);

      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(UPLOADED_FONT_STORE_NAME)) {
            db.createObjectStore(UPLOADED_FONT_STORE_NAME, { keyPath: 'id' });
          }
        } catch (err) {
          console.warn('[uploadedFontStorage] Failed to create font object store:', err);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        try {
          db.onversionchange = () => {
            try {
              db.close();
            } catch {
              // Ignore close errors
            }
          };
        } catch {
          // Some minimal mock IDB implementations don't support onversionchange
        }
        finish(db);
      };

      request.onerror = () => {
        console.warn('[uploadedFontStorage] IndexedDB open error:', request.error);
        finish(null);
      };

      request.onblocked = () => {
        console.warn('[uploadedFontStorage] IndexedDB open blocked by another tab/connection.');
        finish(null);
      };
    } catch (err) {
      console.warn('[uploadedFontStorage] IndexedDB open threw:', err);
      finish(null);
    }
  });
}

function closeDbQuietly(db: IDBDatabase | null): void {
  if (!db) return;
  try {
    db.close();
  } catch {
    // Ignore
  }
}

export async function saveFontRecordToIndexedDb(record: UploadedFontRecord): Promise<boolean> {
  const db = await openUploadedFontDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      closeDbQuietly(db);
      resolve(ok);
    };

    try {
      const tx = db.transaction(UPLOADED_FONT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(UPLOADED_FONT_STORE_NAME);
      const req = store.put(record);

      req.onerror = () => {
        console.warn('[uploadedFontStorage] Failed to store font record:', req.error);
        finish(false);
      };
      tx.oncomplete = () => finish(true);
      tx.onerror = () => {
        console.warn('[uploadedFontStorage] Font save transaction error:', tx.error);
        finish(false);
      };
      tx.onabort = () => {
        console.warn('[uploadedFontStorage] Font save transaction aborted:', tx.error);
        finish(false);
      };
    } catch (err) {
      console.warn('[uploadedFontStorage] Font save threw:', err);
      finish(false);
    }
  });
}

export async function getAllFontRecordsFromIndexedDb(): Promise<UploadedFontRecord[]> {
  const db = await openUploadedFontDatabase();
  if (!db) return [];

  return new Promise<UploadedFontRecord[]>((resolve) => {
    let settled = false;
    const finish = (records: UploadedFontRecord[]) => {
      if (settled) return;
      settled = true;
      closeDbQuietly(db);
      resolve(records);
    };

    try {
      const tx = db.transaction(UPLOADED_FONT_STORE_NAME, 'readonly');
      const store = tx.objectStore(UPLOADED_FONT_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const rawList = Array.isArray(req.result) ? req.result : [];
        const valid = rawList
          .filter(isValidPersistedFontRecord)
          .sort((a, b) => (a.uploadedAt ?? 0) - (b.uploadedAt ?? 0));
        finish(valid);
      };
      req.onerror = () => {
        console.warn('[uploadedFontStorage] Failed to read persisted fonts:', req.error);
        finish([]);
      };
      tx.onerror = () => finish([]);
      tx.onabort = () => finish([]);
    } catch (err) {
      console.warn('[uploadedFontStorage] Reading persisted fonts threw:', err);
      finish([]);
    }
  });
}

export async function deleteFontRecordFromIndexedDb(familyOrId: string): Promise<boolean> {
  const needle = familyOrId.trim().toLowerCase();
  if (!needle) return false;

  const db = await openUploadedFontDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      closeDbQuietly(db);
      resolve(ok);
    };

    try {
      const tx = db.transaction(UPLOADED_FONT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(UPLOADED_FONT_STORE_NAME);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const rows = Array.isArray(getAllReq.result) ? getAllReq.result : [];
        let deletedAny = false;
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;
          const rec = row as Partial<UploadedFontRecord>;
          const idMatch = typeof rec.id === 'string' && rec.id.trim().toLowerCase() === needle;
          const familyMatch =
            typeof rec.family === 'string' && rec.family.trim().toLowerCase() === needle;
          if ((idMatch || familyMatch) && typeof rec.id === 'string') {
            store.delete(rec.id);
            deletedAny = true;
          }
        }
        if (!deletedAny && rows.length === 0) {
          // Attempt direct key delete just in case
          try {
            store.delete(familyOrId);
          } catch {
            // Ignore
          }
        }
      };

      getAllReq.onerror = () => {
        console.warn('[uploadedFontStorage] Failed to locate font to delete:', getAllReq.error);
        finish(false);
      };

      tx.oncomplete = () => finish(true);
      tx.onerror = () => {
        console.warn('[uploadedFontStorage] Font delete transaction error:', tx.error);
        finish(false);
      };
      tx.onabort = () => finish(false);
    } catch (err) {
      console.warn('[uploadedFontStorage] Font delete threw:', err);
      finish(false);
    }
  });
}

export async function clearFontRecordsFromIndexedDb(): Promise<boolean> {
  const db = await openUploadedFontDatabase();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      closeDbQuietly(db);
      resolve(ok);
    };

    try {
      const tx = db.transaction(UPLOADED_FONT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(UPLOADED_FONT_STORE_NAME);
      const req = store.clear();

      req.onerror = () => {
        console.warn('[uploadedFontStorage] Failed to clear font store:', req.error);
        finish(false);
      };
      tx.oncomplete = () => finish(true);
      tx.onerror = () => finish(false);
      tx.onabort = () => finish(false);
    } catch (err) {
      console.warn('[uploadedFontStorage] Clearing font store threw:', err);
      finish(false);
    }
  });
}
