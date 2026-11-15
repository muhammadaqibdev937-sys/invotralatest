import { LoadedTemplateV1 } from '../engine/schema';
import {
  collectTextNodesWithAncestors,
  getSceneStats,
  getTextNodeProperties,
  parseSvgToScene,
  scanSceneFontUsage,
} from '../engine/svgScene';
import { ensureFontsLoaded, getFontDefinition } from './fontLoader';

export const MAX_DESIGN_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export type ImportProgressCallback = (percent: number, stage: string) => void;

export class DesignImportError extends Error {
  public readonly code:
    | 'EMPTY_FILE'
    | 'FILE_TOO_LARGE'
    | 'UNSUPPORTED_FORMAT'
    | 'INVALID_SVG';

  constructor(
    code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_FORMAT' | 'INVALID_SVG',
    message: string
  ) {
    super(message);
    this.name = 'DesignImportError';
    this.code = code;
  }
}

export interface ImportSvgOptions {
  onProgress?: ImportProgressCallback;
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 16));
}

function cleanDisplayTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled SVG Design'
  );
}

function cleanExportBaseName(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '');
  return base ? `${base}-Edited` : 'Design-Edited';
}

function buildDesignId(fileName: string): string {
  const slug = fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${slug || 'svg-design'}-${Date.now().toString(36)}`;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function detectRejectedFormat(
  bytes: Uint8Array,
  fileName: string
): 'png' | 'jpg' | 'pdf' | 'raster' | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }

  // PDF: %PDF-
  const headerProbeLen = Math.min(bytes.length, 1024);
  for (let i = 0; i <= headerProbeLen - 5; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46 &&
      bytes[i + 4] === 0x2d
    ) {
      return 'pdf';
    }
  }

  // GIF / WEBP / BMP
  if (
    (bytes.length >= 4 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38) ||
    (bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50) ||
    (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d)
  ) {
    return 'raster';
  }

  if (/\.(png|jpe?g|pdf|gif|webp|bmp|tiff?)$/i.test(fileName)) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'png';
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (ext === 'pdf') return 'pdf';
    return 'raster';
  }

  return null;
}

export async function importSvgDesignFile(
  file: File,
  options: ImportSvgOptions = {}
): Promise<LoadedTemplateV1> {
  const report: ImportProgressCallback = (percent, stage) => {
    options.onProgress?.(percent, stage);
  };

  if (!file || file.size === 0) {
    throw new DesignImportError('EMPTY_FILE', 'The selected SVG file is empty (0 bytes).');
  }

  if (file.size > MAX_DESIGN_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new DesignImportError(
      'FILE_TOO_LARGE',
      `File is ${sizeMb} MB, which exceeds the 25 MB browser limit.`
    );
  }

  report(18, 'Validating SVG signature...');
  await yieldToPaint();

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const rejected = detectRejectedFormat(bytes, file.name);
  if (rejected === 'png') {
    throw new DesignImportError(
      'UNSUPPORTED_FORMAT',
      'PNG files are not supported. Invotora is an SVG-native editor — please upload the .svg file from your Etsy download.'
    );
  }
  if (rejected === 'jpg') {
    throw new DesignImportError(
      'UNSUPPORTED_FORMAT',
      'JPG/JPEG files are not supported. Invotora is an SVG-native editor — please upload the .svg file from your Etsy download.'
    );
  }
  if (rejected === 'pdf') {
    throw new DesignImportError(
      'UNSUPPORTED_FORMAT',
      'PDF files are not supported. Invotora is an SVG-native editor — please upload the .svg file from your Etsy download.'
    );
  }
  if (rejected === 'raster') {
    throw new DesignImportError(
      'UNSUPPORTED_FORMAT',
      'Image files are not supported. Please upload a genuine editable .svg vector file.'
    );
  }

  // Check for binary NUL bytes
  const sampleLen = Math.min(bytes.length, 4096);
  for (let i = 0; i < sampleLen; i++) {
    if (bytes[i] === 0x00) {
      throw new DesignImportError(
        'INVALID_SVG',
        'This file appears to be binary rather than an XML SVG file. Please upload a valid .svg file.'
      );
    }
  }

  report(42, 'Sanitizing & parsing SVG XML...');
  await yieldToPaint();

  const rawSvg = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim();
  if (!/<svg[\s>]/i.test(rawSvg)) {
    throw new DesignImportError(
      'INVALID_SVG',
      'No valid <svg> root element was found in this file. Please check that the file is a valid SVG.'
    );
  }

  let scene;
  try {
    const fallbackTitle = cleanDisplayTitle(file.name);
    scene = parseSvgToScene(rawSvg, fallbackTitle);
  } catch (err) {
    throw new DesignImportError(
      'INVALID_SVG',
      err instanceof Error
        ? err.message
        : 'Could not parse this SVG file. Please verify the SVG XML syntax is valid.'
    );
  }

  report(72, 'Detecting text elements, layers & colors...');
  await yieldToPaint();

  const stats = getSceneStats(scene);
  if (stats.totalElements === 0) {
    throw new DesignImportError(
      'INVALID_SVG',
      'This SVG contains no visible vector shapes or text elements to edit.'
    );
  }

  report(88, 'Loading typography...');
  const fontSummary = scanSceneFontUsage(scene);
  if (fontSummary.missingCount > 0) {
    console.warn(`[designImporter] Font scan for "${file.name}": ${fontSummary.summaryText}`);
  }

  const textEntries = collectTextNodesWithAncestors(scene.nodes);
  const fontReqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }> = [];
  for (const { node, ancestors } of textEntries) {
    const props = getTextNodeProperties(node, scene.cssRules, ancestors);
    const def =
      getFontDefinition(props.fontFamily) ??
      (props.isFontFallback ? getFontDefinition(props.fallbackPreviewFamily) : undefined);
    if (def) {
      fontReqs.push({
        family: def.family,
        weight: props.fontWeight,
        style: props.fontStyle,
      });
    }
  }
  if (fontReqs.length > 0) {
    await ensureFontsLoaded(fontReqs).catch((err) => {
      console.warn('[designImporter] Font preload warning:', err);
    });
  }

  report(100, 'Ready');
  const designId = buildDesignId(file.name);

  return {
    id: designId,
    name: scene.title || cleanDisplayTitle(file.name),
    designVersion: hashString(rawSvg),
    exportFilename: cleanExportBaseName(file.name),
    originalScene: scene,
    sourceInfo: {
      fileName: file.name,
      fileType: 'svg',
      fileSizeBytes: file.size,
      textCount: stats.textCount,
      shapeCount: stats.shapeCount,
      groupCount: stats.groupCount,
      imageCount: stats.imageCount,
      warnings: scene.warnings,
      fontSummary,
    },
  };
}
