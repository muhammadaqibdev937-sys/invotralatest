import { isFontAvailableInBrowser } from '../engine/fonts';
import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../engine/schema';
import {
  collectTextNodesWithAncestors,
  getEffectiveNodeProp,
  getNodeTspans,
  getTextNodeProperties,
  serializeSceneToSvg,
} from '../engine/svgScene';
import { buildEmbeddedLocalFontCss, getFontDefinition } from './fontLoader';
import { buildUploadedFontCss, getUploadedFontRecord } from './uploadedFonts';

export interface ExportSvgOptions {
  embedFonts?: boolean;
  /** OFF by default so uploaded fonts are never embedded into exported SVGs without explicit opt-in */
  embedUploadedFonts?: boolean;
  filename?: string;
  onProgress?: (percent: number, stage: string) => void;
}

export interface ExportSvgResult {
  filename: string;
  viewBox: string;
  width: number;
  height: number;
  byteSize: number;
  svgString: string;
}

export interface ExportParityReport {
  isFullParity: boolean;
  notes: string[];
  missingFonts: string[];
  unembeddedUploadedFonts: string[];
}

export function sanitizeSvgFilename(raw: string | undefined, fallback = 'Design-Edited'): string {
  const cleaned = (raw ?? '')
    .replace(/\.svg$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim();
  return `${cleaned || fallback}.svg`;
}

export function buildEditableSvgString(
  docState: SvgEditorDocumentStateV1,
  embeddedFontCss?: string
): string {
  return serializeSceneToSvg(docState.scene, {
    embeddedFontCss,
    backgroundColor: docState.scene.backgroundColor,
    transparentBackground: docState.transparentBackground,
  });
}

function collectVisibleFontRequests(docState: SvgEditorDocumentStateV1): {
  bundledReqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }>;
  uploadedFamilies: string[];
  missingFonts: string[];
} {
  const textEntries = collectTextNodesWithAncestors(docState.scene.nodes);
  const bundledReqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }> = [];
  const uploadedFamilies = new Set<string>();
  const missingFonts = new Set<string>();

  const recordVariant = (
    rawFamily: string,
    rawWeight: string,
    rawStyle: 'normal' | 'italic',
    isFallback: boolean,
    originalFamily: string
  ) => {
    const def = getFontDefinition(rawFamily);
    if (def) {
      bundledReqs.push({
        family: def.family,
        weight: rawWeight,
        style: rawStyle,
      });
      return;
    }
    const uploaded = getUploadedFontRecord(rawFamily);
    if (uploaded) {
      uploadedFamilies.add(uploaded.family);
      return;
    }
    if (isFallback && !isFontAvailableInBrowser(originalFamily)) {
      missingFonts.add(originalFamily);
    }
  };

  for (const { node, ancestors } of textEntries) {
    if (!node.visible) continue;
    const props = getTextNodeProperties(node, docState.scene.cssRules, ancestors);
    recordVariant(
      props.fontFamily,
      props.fontWeight,
      props.fontStyle,
      props.isFontFallback,
      props.originalFontFamily
    );

    const tspans = getNodeTspans(node);
    if (tspans && tspans.length > 0) {
      const tspanAncestors = [...ancestors, node];
      for (const ts of tspans) {
        const tsFamilyRaw =
          getEffectiveNodeProp(
            { attrs: ts.attrs, tag: 'tspan' },
            'font-family',
            docState.scene.cssRules,
            tspanAncestors
          ) || props.fontFamily;
        const firstFamily = tsFamilyRaw.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || props.fontFamily;
        const tsWeight =
          getEffectiveNodeProp(
            { attrs: ts.attrs, tag: 'tspan' },
            'font-weight',
            docState.scene.cssRules,
            tspanAncestors
          ) || props.fontWeight;
        const tsStyleRaw =
          getEffectiveNodeProp(
            { attrs: ts.attrs, tag: 'tspan' },
            'font-style',
            docState.scene.cssRules,
            tspanAncestors
          ) || props.fontStyle;
        const tsStyle: 'normal' | 'italic' = tsStyleRaw.toLowerCase().includes('italic')
          ? 'italic'
          : 'normal';

        recordVariant(
          firstFamily,
          tsWeight,
          tsStyle,
          props.isFontFallback && firstFamily === props.originalFontFamily,
          firstFamily
        );
      }
    }
  }

  return {
    bundledReqs,
    uploadedFamilies: Array.from(uploadedFamilies),
    missingFonts: Array.from(missingFonts),
  };
}

export function analyzeExportParity(
  docState: SvgEditorDocumentStateV1,
  options: { embedFonts?: boolean; embedUploadedFonts?: boolean } = {}
): ExportParityReport {
  const { bundledReqs, uploadedFamilies, missingFonts } = collectVisibleFontRequests(docState);
  const notes: string[] = [];

  if (options.embedFonts === false && bundledReqs.length > 0) {
    notes.push(
      'Google Font embedding is off — exported SVG will rely on locally installed fonts in external viewers.'
    );
  }
  const unembeddedUploadedFonts =
    options.embedUploadedFonts === true ? [] : uploadedFamilies;
  if (unembeddedUploadedFonts.length > 0) {
    notes.push(
      `Session-uploaded font (${unembeddedUploadedFonts.join(', ')}) is not embedded by default; enable "Embed uploaded fonts in export" if your license permits.`
    );
  }
  if (missingFonts.length > 0) {
    notes.push(
      `Unbundled font (${missingFonts.join(', ')}) keeps its original family name in the exported SVG while the editor uses a fallback preview.`
    );
  }

  return {
    isFullParity: notes.length === 0,
    notes,
    missingFonts,
    unembeddedUploadedFonts,
  };
}

export async function collectEmbeddedFontCssForExport(
  docState: SvgEditorDocumentStateV1,
  options: { embedFonts?: boolean; embedUploadedFonts?: boolean } = {}
): Promise<string | undefined> {
  const cssParts: string[] = [];
  const { bundledReqs, uploadedFamilies } = collectVisibleFontRequests(docState);

  if (options.embedFonts !== false && bundledReqs.length > 0) {
    try {
      const bundledCss = await buildEmbeddedLocalFontCss(bundledReqs);
      if (bundledCss) cssParts.push(bundledCss);
    } catch {
      // Fallback silently if font embedding fails
    }
  }

  if (options.embedUploadedFonts === true && uploadedFamilies.length > 0) {
    const uploadedCss = buildUploadedFontCss(uploadedFamilies);
    if (uploadedCss) cssParts.push(uploadedCss);
  }

  return cssParts.length > 0 ? cssParts.join('\n') : undefined;
}

export async function exportEditableSvg(
  template: LoadedTemplateV1,
  docState: SvgEditorDocumentStateV1,
  options: ExportSvgOptions = {}
): Promise<ExportSvgResult> {
  const report = (percent: number, stage: string) => options.onProgress?.(percent, stage);
  report(15, 'Collecting fonts & vector layers...');

  if (options.embedFonts !== false || options.embedUploadedFonts === true) {
    report(45, 'Embedding fonts...');
  }
  const embeddedFontCss = await collectEmbeddedFontCssForExport(docState, {
    embedFonts: options.embedFonts,
    embedUploadedFonts: options.embedUploadedFonts === true,
  });

  report(75, 'Serializing editable SVG...');
  const svgString = buildEditableSvgString(docState, embeddedFontCss);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const filename = sanitizeSvgFilename(options.filename, template.exportFilename || 'Design-Edited');

  report(95, 'Starting download...');
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  report(100, 'Downloaded');
  return {
    filename,
    viewBox: docState.scene.viewBox,
    width: docState.scene.vbW,
    height: docState.scene.vbH,
    byteSize: blob.size,
    svgString,
  };
}
