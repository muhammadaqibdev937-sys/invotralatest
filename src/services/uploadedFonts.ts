import {
  clearFontAvailabilityCache,
  clearUploadedFontsInEngine,
  FontCategory,
  registerUploadedFontInEngine,
  unregisterUploadedFontInEngine,
} from '../engine/fonts';
import {
  clearFontRecordsFromIndexedDb,
  deleteFontRecordFromIndexedDb,
  getAllFontRecordsFromIndexedDb,
  isIndexedDbAvailable,
  saveFontRecordToIndexedDb,
} from './uploadedFontStorage';
import { base64ToUint8, uint8ToBase64 } from './woffToTtf';

export const MAX_UPLOAD_FONT_BYTES = 10 * 1024 * 1024; // 10 MB

export type AllowedFontExtension = '.ttf' | '.otf' | '.woff2';

export interface UploadedFontRecord {
  id: string;
  family: string;
  fileName: string;
  extension: AllowedFontExtension;
  cssFormat: 'truetype' | 'opentype' | 'woff2';
  mimeType: string;
  byteSize: number;
  base64Data: string;
  category: FontCategory;
  loadedViaFontFace: boolean;
  uploadedAt: number;
}

export class FontUploadError extends Error {
  public readonly code:
    | 'INVALID_EXTENSION'
    | 'INVALID_MAGIC_BYTES'
    | 'FILE_EMPTY'
    | 'FILE_TOO_LARGE'
    | 'INVALID_FAMILY_NAME'
    | 'FONT_LOAD_FAILED';

  constructor(code: FontUploadError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'FontUploadError';
  }
}

export interface ValidatedFontMeta {
  extension: AllowedFontExtension;
  cssFormat: 'truetype' | 'opentype' | 'woff2';
  mimeType: string;
}

const sessionUploadedFonts = new Map<string, UploadedFontRecord>();
const uploadedFontsListeners = new Set<() => void>();
let hasHydratedFromIdb = false;
let hydrationInFlight: Promise<UploadedFontHydrationResult> | null = null;

export interface UploadedFontHydrationResult {
  restored: UploadedFontRecord[];
  skippedCount: number;
  storageAvailable: boolean;
}

export function subscribeUploadedFonts(listener: () => void): () => void {
  uploadedFontsListeners.add(listener);
  return () => {
    uploadedFontsListeners.delete(listener);
  };
}

function notifyUploadedFontsChanged(): void {
  for (const listener of uploadedFontsListeners) {
    try {
      listener();
    } catch (err) {
      console.warn('[uploadedFonts] Listener callback threw:', err);
    }
  }
}

export function isUploadedFontsHydrated(): boolean {
  return hasHydratedFromIdb;
}

function matchMagicBytes(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.byteLength < sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return false;
  }
  return true;
}

export function getFontExtension(fileName: string): AllowedFontExtension | null {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith('.ttf')) return '.ttf';
  if (lower.endsWith('.otf')) return '.otf';
  if (lower.endsWith('.woff2')) return '.woff2';
  return null;
}

export function validateFontUpload(
  fileName: string,
  bytes: Uint8Array,
  reportedSizeBytes?: number
): ValidatedFontMeta {
  const ext = getFontExtension(fileName);
  if (!ext) {
    throw new FontUploadError(
      'INVALID_EXTENSION',
      'Unsupported file type. Only .ttf, .otf, and .woff2 font files are supported.'
    );
  }

  const effectiveSize = reportedSizeBytes ?? bytes.byteLength;
  if (effectiveSize <= 0 || bytes.byteLength <= 0) {
    throw new FontUploadError('FILE_EMPTY', 'The selected font file is empty.');
  }

  if (effectiveSize > MAX_UPLOAD_FONT_BYTES || bytes.byteLength > MAX_UPLOAD_FONT_BYTES) {
    throw new FontUploadError(
      'FILE_TOO_LARGE',
      'Font file exceeds the 10 MB maximum size limit.'
    );
  }

  if (bytes.byteLength < 4) {
    throw new FontUploadError(
      'INVALID_MAGIC_BYTES',
      `The file is too small to be a valid ${ext} font.`
    );
  }

  if (ext === '.ttf') {
    const isSfnt = matchMagicBytes(bytes, [0x00, 0x01, 0x00, 0x00]);
    const isAppleTrue = matchMagicBytes(bytes, [0x74, 0x72, 0x75, 0x65]); // 'true'
    if (!isSfnt && !isAppleTrue) {
      throw new FontUploadError(
        'INVALID_MAGIC_BYTES',
        'Invalid .ttf font signature. Make sure the file is an authentic TrueType font.'
      );
    }
    return { extension: '.ttf', cssFormat: 'truetype', mimeType: 'font/ttf' };
  }

  if (ext === '.otf') {
    const isOtto = matchMagicBytes(bytes, [0x4f, 0x54, 0x54, 0x4f]); // 'OTTO'
    if (!isOtto) {
      throw new FontUploadError(
        'INVALID_MAGIC_BYTES',
        'Invalid .otf font signature. Make sure the file is an authentic OpenType CFF font.'
      );
    }
    return { extension: '.otf', cssFormat: 'opentype', mimeType: 'font/otf' };
  }

  const isWoff2 = matchMagicBytes(bytes, [0x77, 0x4f, 0x46, 0x32]); // 'wOF2'
  if (!isWoff2) {
    throw new FontUploadError(
      'INVALID_MAGIC_BYTES',
      'Invalid .woff2 font signature. Make sure the file is a valid WOFF2 font.'
    );
  }
  return { extension: '.woff2', cssFormat: 'woff2', mimeType: 'font/woff2' };
}

export function sanitizeUploadedFontFamily(raw: string): string {
  return raw
    .replace(/['"<>\\/;{}()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function deriveFontFamilyName(fileName: string): string {
  const withoutExt = fileName.replace(/\.(ttf|otf|woff2)$/i, '');
  const cleaned = sanitizeUploadedFontFamily(withoutExt.replace(/[_-]+/g, ' '));
  return cleaned || 'Custom Uploaded Font';
}

export interface UploadFontOptions {
  familyName?: string;
  category?: FontCategory;
  /** Optional dependency hook primarily for testing FontFace loading in non-browser environments */
  registerFontFace?: (family: string, sourceBuffer: ArrayBuffer) => Promise<void>;
}

async function defaultRegisterFontFace(
  family: string,
  sourceBuffer: ArrayBuffer
): Promise<boolean> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !('fonts' in document)) {
    return false;
  }

  try {
    const face = new FontFace(family, sourceBuffer);
    const loadedFace = await face.load();
    document.fonts.add(loadedFace);
    return true;
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
    throw new FontUploadError(
      'FONT_LOAD_FAILED',
      `Could not load the font binary into the browser${detail}. Please try another .ttf, .otf, or .woff2 file.`
    );
  }
}

export async function uploadFontFromBytes(params: {
  fileName: string;
  bytes: Uint8Array;
  sizeBytes?: number;
  options?: UploadFontOptions;
}): Promise<UploadedFontRecord> {
  const meta = validateFontUpload(params.fileName, params.bytes, params.sizeBytes);
  const rawFamily = params.options?.familyName ?? deriveFontFamilyName(params.fileName);
  const family = sanitizeUploadedFontFamily(rawFamily);
  if (!family) {
    throw new FontUploadError(
      'INVALID_FAMILY_NAME',
      'Please enter a valid font family name.'
    );
  }

  const category: FontCategory = params.options?.category ?? 'Serif';
  const copyBuffer = params.bytes.slice().buffer;

  let loadedViaFontFace = false;
  if (params.options?.registerFontFace) {
    try {
      await params.options.registerFontFace(family, copyBuffer);
      loadedViaFontFace = true;
    } catch (err) {
      if (err instanceof FontUploadError) throw err;
      const detail = err instanceof Error && err.message ? ` (${err.message})` : '';
      throw new FontUploadError(
        'FONT_LOAD_FAILED',
        `Could not load the font binary into the browser${detail}.`
      );
    }
  } else {
    loadedViaFontFace = await defaultRegisterFontFace(family, copyBuffer);
  }

  const record: UploadedFontRecord = {
    id: `uploaded_${family.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    family,
    fileName: params.fileName,
    extension: meta.extension,
    cssFormat: meta.cssFormat,
    mimeType: meta.mimeType,
    byteSize: params.sizeBytes ?? params.bytes.byteLength,
    base64Data: uint8ToBase64(params.bytes),
    category,
    loadedViaFontFace,
    uploadedAt: Date.now(),
  };

  sessionUploadedFonts.set(family.toLowerCase(), record);
  registerUploadedFontInEngine(family, category);
  clearFontAvailabilityCache();

  try {
    await saveFontRecordToIndexedDb(record);
  } catch (err) {
    console.warn(`[uploadedFonts] Failed to persist "${family}" in IndexedDB:`, err);
  }

  notifyUploadedFontsChanged();

  return record;
}

export interface HydrateUploadedFontsOptions {
  force?: boolean;
  registerFontFace?: (family: string, sourceBuffer: ArrayBuffer) => Promise<void>;
}

export async function hydrateUploadedFontsFromIndexedDb(
  options?: HydrateUploadedFontsOptions
): Promise<UploadedFontHydrationResult> {
  if (hasHydratedFromIdb && !options?.force) {
    return {
      restored: getUploadedFonts(),
      skippedCount: 0,
      storageAvailable: isIndexedDbAvailable(),
    };
  }

  if (hydrationInFlight && !options?.force) {
    return hydrationInFlight;
  }

  const run = (async (): Promise<UploadedFontHydrationResult> => {
    const storageAvailable = isIndexedDbAvailable();
    if (!storageAvailable) {
      hasHydratedFromIdb = true;
      return {
        restored: getUploadedFonts(),
        skippedCount: 0,
        storageAvailable: false,
      };
    }

    let storedRecords: UploadedFontRecord[] = [];
    try {
      storedRecords = await getAllFontRecordsFromIndexedDb();
    } catch (err) {
      console.warn('[uploadedFonts] IndexedDB hydration read failed:', err);
      hasHydratedFromIdb = true;
      return {
        restored: getUploadedFonts(),
        skippedCount: 0,
        storageAvailable: false,
      };
    }

    const restored: UploadedFontRecord[] = [];
    let skippedCount = 0;

    for (const rec of storedRecords) {
      try {
        const family = sanitizeUploadedFontFamily(rec.family);
        if (!family) {
          skippedCount += 1;
          continue;
        }

        const bytes = base64ToUint8(rec.base64Data);
        validateFontUpload(rec.fileName || `${family}${rec.extension}`, bytes, bytes.byteLength);
        const copyBuffer = bytes.slice().buffer;

        let loadedViaFontFace = false;
        if (options?.registerFontFace) {
          await options.registerFontFace(family, copyBuffer);
          loadedViaFontFace = true;
        } else {
          loadedViaFontFace = await defaultRegisterFontFace(family, copyBuffer);
        }

        const hydratedRecord: UploadedFontRecord = {
          ...rec,
          family,
          loadedViaFontFace,
        };

        sessionUploadedFonts.set(family.toLowerCase(), hydratedRecord);
        registerUploadedFontInEngine(family, hydratedRecord.category);
        restored.push(hydratedRecord);
      } catch (err) {
        skippedCount += 1;
        console.warn(
          `[uploadedFonts] Skipping corrupt persisted font "${rec?.family ?? 'unknown'}":`,
          err
        );
      }
    }

    hasHydratedFromIdb = true;
    clearFontAvailabilityCache();

    if (restored.length > 0) {
      notifyUploadedFontsChanged();
    }

    return {
      restored,
      skippedCount,
      storageAvailable: true,
    };
  })();

  hydrationInFlight = run;
  try {
    return await run;
  } finally {
    if (hydrationInFlight === run) {
      hydrationInFlight = null;
    }
  }
}

export async function uploadFontFile(
  file: File,
  options?: UploadFontOptions
): Promise<UploadedFontRecord> {
  const ext = getFontExtension(file.name);
  if (!ext) {
    throw new FontUploadError(
      'INVALID_EXTENSION',
      'Unsupported file type. Only .ttf, .otf, and .woff2 font files are supported.'
    );
  }
  if (file.size <= 0) {
    throw new FontUploadError('FILE_EMPTY', 'The selected font file is empty.');
  }
  if (file.size > MAX_UPLOAD_FONT_BYTES) {
    throw new FontUploadError(
      'FILE_TOO_LARGE',
      'Font file exceeds the 10 MB maximum size limit.'
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new FontUploadError('FONT_LOAD_FAILED', 'Could not read the selected font file.');
  }

  return uploadFontFromBytes({
    fileName: file.name,
    bytes: new Uint8Array(buffer),
    sizeBytes: file.size,
    options,
  });
}

export function getUploadedFonts(): UploadedFontRecord[] {
  return Array.from(sessionUploadedFonts.values());
}

export function getUploadedFontRecord(
  family: string | null | undefined
): UploadedFontRecord | undefined {
  if (!family) return undefined;
  const cleaned = family.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  if (!cleaned) return undefined;
  return sessionUploadedFonts.get(cleaned.toLowerCase());
}

export function removeUploadedFont(family: string): void {
  const key = family.trim().toLowerCase();
  sessionUploadedFonts.delete(key);
  unregisterUploadedFontInEngine(family);
  clearFontAvailabilityCache();
  notifyUploadedFontsChanged();
  void deleteFontRecordFromIndexedDb(family).catch((err) => {
    console.warn(`[uploadedFonts] Failed to remove "${family}" from IndexedDB:`, err);
  });
}

export async function deleteUploadedFont(family: string): Promise<boolean> {
  const key = family.trim().toLowerCase();
  sessionUploadedFonts.delete(key);
  unregisterUploadedFontInEngine(family);
  clearFontAvailabilityCache();
  notifyUploadedFontsChanged();
  return deleteFontRecordFromIndexedDb(family);
}

export function clearUploadedFonts(): void {
  sessionUploadedFonts.clear();
  clearUploadedFontsInEngine();
  clearFontAvailabilityCache();
  notifyUploadedFontsChanged();
  void clearFontRecordsFromIndexedDb().catch((err) => {
    console.warn('[uploadedFonts] Failed to clear persisted fonts from IndexedDB:', err);
  });
}

export async function clearAllUploadedFonts(): Promise<boolean> {
  sessionUploadedFonts.clear();
  clearUploadedFontsInEngine();
  clearFontAvailabilityCache();
  notifyUploadedFontsChanged();
  return clearFontRecordsFromIndexedDb();
}

export function clearUploadedFontsInMemoryOnly(): void {
  sessionUploadedFonts.clear();
  clearUploadedFontsInEngine();
  clearFontAvailabilityCache();
  hasHydratedFromIdb = false;
  hydrationInFlight = null;
  notifyUploadedFontsChanged();
}

export function buildUploadedFontCss(families?: string[]): string {
  const blocks: string[] = [];
  const targets =
    families && families.length > 0
      ? families
          .map((f) => getUploadedFontRecord(f))
          .filter((r): r is UploadedFontRecord => Boolean(r))
      : getUploadedFonts();

  const seen = new Set<string>();
  for (const rec of targets) {
    const key = rec.family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const safeFamily = rec.family.replace(/'/g, "\\'");
    blocks.push(
      `@font-face { font-family: '${safeFamily}'; font-style: normal; font-weight: 400; src: url('data:${rec.mimeType};base64,${rec.base64Data}') format('${rec.cssFormat}'); }`
    );
  }

  return blocks.join('\n');
}
