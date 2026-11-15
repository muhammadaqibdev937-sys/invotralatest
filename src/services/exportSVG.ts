import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../engine/schema';
import {
  collectTextNodesWithAncestors,
  getTextNodeProperties,
  serializeSceneToSvg,
} from '../engine/svgScene';
import { buildEmbeddedLocalFontCss, getFontDefinition } from './fontLoader';

export interface ExportSvgOptions {
  embedFonts?: boolean;
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

export async function exportEditableSvg(
  template: LoadedTemplateV1,
  docState: SvgEditorDocumentStateV1,
  options: ExportSvgOptions = {}
): Promise<ExportSvgResult> {
  const report = (percent: number, stage: string) => options.onProgress?.(percent, stage);
  report(15, 'Collecting fonts & vector layers...');

  let embeddedFontCss: string | undefined;
  if (options.embedFonts !== false) {
    const textEntries = collectTextNodesWithAncestors(docState.scene.nodes);
    const reqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }> = [];
    for (const { node, ancestors } of textEntries) {
      if (!node.visible) continue;
      const props = getTextNodeProperties(node, docState.scene.cssRules, ancestors);
      const def = getFontDefinition(props.fontFamily);
      if (def) {
        reqs.push({
          family: def.family,
          weight: props.fontWeight,
          style: props.fontStyle,
        });
      }
    }
    if (reqs.length > 0) {
      report(45, 'Embedding Google Fonts...');
      try {
        embeddedFontCss = await buildEmbeddedLocalFontCss(reqs);
      } catch {
        // Fallback silently if font embedding fails
      }
    }
  }

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
