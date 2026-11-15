import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportPreviewModal } from '../components/ExportPanel/ExportPreviewModal';
import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../engine/schema';
import { parseSvgToScene } from '../engine/svgScene';
import * as fontLoader from '../services/fontLoader';
import {
  analyzeExportParity,
  buildEditableSvgString,
  collectEmbeddedFontCssForExport,
} from '../services/exportSVG';
import { clearUploadedFonts, uploadFontFromBytes } from '../services/uploadedFonts';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function makeDocState(svgMarkup: string, transparentBackground = false): {
  template: LoadedTemplateV1;
  docState: SvgEditorDocumentStateV1;
} {
  const scene = parseSvgToScene(svgMarkup, 'Test Art Deco');
  const template: LoadedTemplateV1 = {
    id: 'test-export-preview',
    name: scene.title,
    designVersion: '1',
    exportFilename: 'Art-Deco-Proof',
    originalScene: scene,
    sourceInfo: {
      fileName: 'art-deco.svg',
      fileType: 'svg',
      fileSizeBytes: svgMarkup.length,
      textCount: 1,
      shapeCount: 1,
      groupCount: 1,
      imageCount: 0,
      warnings: [],
    },
  };
  const docState: SvgEditorDocumentStateV1 = {
    designVersion: '1',
    scene,
    transparentBackground,
  };
  return { template, docState };
}

function makeFakeTtfBytes(): Uint8Array {
  const buf = new ArrayBuffer(128);
  const view = new DataView(buf);
  view.setUint32(0, 0x00010000, false);
  return new Uint8Array(buf);
}

describe('Pre-Download High-Resolution SVG Preview Modal & Export Parity', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    clearUploadedFonts();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
    clearUploadedFonts();
    vi.restoreAllMocks();
  });

  it('collectEmbeddedFontCssForExport collects per-tspan bold and italic variants inside <text> and <textPath>', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
        <defs><path id="arc" d="M 50 200 A 200 200 0 0 1 550 200" /></defs>
        <text font-family="Playfair Display" font-size="24">
          <textPath href="#arc">
            <tspan>DEC</tspan>
            <tspan dx="8" font-weight="700" font-style="italic">31</tspan>
          </textPath>
        </text>
      </svg>
    `;
    const { docState } = makeDocState(svg);
    const spy = vi
      .spyOn(fontLoader, 'buildEmbeddedLocalFontCss')
      .mockResolvedValue('/* embedded */');

    const css = await collectEmbeddedFontCssForExport(docState, { embedFonts: true });
    expect(css).toBe('/* embedded */');
    expect(spy).toHaveBeenCalledTimes(1);
    const reqs = spy.mock.calls[0][0];
    expect(reqs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'Playfair Display', weight: '400', style: 'normal' }),
        expect.objectContaining({ family: 'Playfair Display', weight: '700', style: 'italic' }),
      ])
    );
  });

  it('buildEditableSvgString omits explicit background rect when transparentBackground is enabled', () => {
    const rawArtDeco = fs.readFileSync(
      path.join(FIXTURES_DIR, 'design-1-art-deco.svg'),
      'utf8'
    );
    const { docState: opaqueDoc } = makeDocState(rawArtDeco, false);
    const { docState: transparentDoc } = makeDocState(rawArtDeco, true);

    const opaqueSvg = buildEditableSvgString(opaqueDoc);
    const transparentSvg = buildEditableSvgString(transparentDoc);

    expect(opaqueSvg).toContain('fill="#111318"');
    expect(transparentSvg).not.toContain('fill="#111318"');
  });

  it('analyzeExportParity detects Google Font embedding off, unembedded uploaded fonts, and missing fonts accurately', async () => {
    const bundledSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <text x="20" y="60" font-family="Cinzel" font-size="32">Hello</text>
      </svg>
    `;
    const { docState: bundledDoc } = makeDocState(bundledSvg);
    expect(analyzeExportParity(bundledDoc, { embedFonts: true }).isFullParity).toBe(true);
    const noEmbed = analyzeExportParity(bundledDoc, { embedFonts: false });
    expect(noEmbed.isFullParity).toBe(false);
    expect(noEmbed.notes[0]).toContain('Google Font embedding is off');

    // Uploaded session font parity check
    const mockFontFace = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      return { load: vi.fn().mockResolvedValue(this) };
    });
    vi.stubGlobal('FontFace', mockFontFace);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: vi.fn(), check: vi.fn(() => false), ready: Promise.resolve() },
    });

    await uploadFontFromBytes({
      fileName: 'CustomBrand.ttf',
      bytes: makeFakeTtfBytes(),
      options: { familyName: 'CustomBrand' },
    });
    const uploadedSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <text x="20" y="60" font-family="CustomBrand" font-size="32">Hello</text>
      </svg>
    `;
    const { docState: uploadedDoc } = makeDocState(uploadedSvg);
    const defaultParity = analyzeExportParity(uploadedDoc, {
      embedFonts: true,
      embedUploadedFonts: false,
    });
    expect(defaultParity.isFullParity).toBe(false);
    expect(defaultParity.unembeddedUploadedFonts).toEqual(['CustomBrand']);

    const optedInParity = analyzeExportParity(uploadedDoc, {
      embedFonts: true,
      embedUploadedFonts: true,
    });
    expect(optedInParity.isFullParity).toBe(true);
  });

  it('renders high-resolution preview modal with zoom scaling (100%/200%/300%), rootAttrs parity, Export Output vs Editor Canvas switch, and Escape close', async () => {
    const rawArtDeco = fs.readFileSync(
      path.join(FIXTURES_DIR, 'design-1-art-deco.svg'),
      'utf8'
    );
    const { template, docState } = makeDocState(rawArtDeco);

    vi.spyOn(fontLoader, 'buildEmbeddedLocalFontCss').mockResolvedValue('');
    const onToggleTransparent = vi.fn();
    const onOpenHelp = vi.fn();
    const onCloseModal = vi.fn();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ExportPreviewModal
          template={template}
          docState={docState}
          onToggleTransparent={onToggleTransparent}
          onOpenHelp={onOpenHelp}
          onCloseModal={onCloseModal}
        />
      );
    });

    const dialog = container.querySelector('[role="dialog"][aria-label="High-resolution SVG preview"]');
    expect(dialog).not.toBeNull();
    expect(container.textContent).toContain('Pre-Download High-Resolution Preview');
    expect(container.textContent).toContain('800 × 1100');
    expect(container.textContent).toContain('Final SVG output matches the editor canvas.');
    expect(container.textContent).toContain('Download Editable SVG');

    // Verify rootAttrs parity on rendered <svg> preview
    const previewSvg = container.querySelector('svg[role="img"]');
    expect(previewSvg).not.toBeNull();
    expect(previewSvg?.getAttribute('data-marketplace-sku')).toBe('art-deco-01');
    expect(previewSvg?.innerHTML).toContain('<textPath');
    expect(previewSvg?.innerHTML).toContain('THE GATSBY GALA');

    // Verify "Embed uploaded fonts in export" is OFF by default
    const checkboxes = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    expect(checkboxes[0].checked).toBe(true); // Embed Google Fonts
    expect(checkboxes[1].checked).toBe(false); // Embed uploaded fonts
    expect(checkboxes[2].checked).toBe(false); // Transparent background

    // Click 200% zoom and check high-res dimensions (800*2 x 1100*2 = 1600 x 2200px)
    const btn200 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '200%'
    );
    expect(btn200).toBeDefined();
    await act(async () => {
      btn200!.click();
    });
    expect(container.textContent).toContain('1600 × 2200px');
    expect(container.textContent).toContain('200% zoom');

    // Click 300% zoom -> 2400 x 3300px
    const btn300 = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '300%'
    );
    await act(async () => {
      btn300!.click();
    });
    expect(container.textContent).toContain('2400 × 3300px');
    expect(container.textContent).toContain('300% zoom');

    // Switch tab to Editor Canvas and confirm tab selection state updates
    const canvasTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (b) => b.textContent?.trim() === 'Editor Canvas'
    );
    expect(canvasTab).toBeDefined();
    await act(async () => {
      (canvasTab as HTMLButtonElement).click();
    });
    expect(canvasTab?.getAttribute('aria-selected')).toBe('true');

    // Pressing Escape closes the modal
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });
});
