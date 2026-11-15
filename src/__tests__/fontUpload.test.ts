import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearFontAvailabilityCache,
  isFontAvailableInBrowser,
} from '../engine/fonts';
import {
  applyTextEditToNode,
  parseSvgToScene,
  scanSceneFontUsage,
  updateNodeInTree,
} from '../engine/svgScene';
import { SvgEditorDocumentStateV1 } from '../engine/schema';
import {
  buildEditableSvgString,
  collectEmbeddedFontCssForExport,
} from '../services/exportSVG';
import {
  clearUploadedFonts,
  FontUploadError,
  getUploadedFonts,
  MAX_UPLOAD_FONT_BYTES,
  uploadFontFromBytes,
  validateFontUpload,
} from '../services/uploadedFonts';

function makeFontBytes(magic: number[], totalLen = 64): Uint8Array {
  const bytes = new Uint8Array(totalLen);
  magic.forEach((b, i) => {
    bytes[i] = b;
  });
  return bytes;
}

describe('Font Upload validation, FontFace loading, banner update & export option', () => {
  afterEach(() => {
    clearUploadedFonts();
    clearFontAvailabilityCache();
    vi.restoreAllMocks();
  });

  it('accepts valid .ttf, .otf, and .woff2 magic bytes and loads into session registry', async () => {
    const ttf = await uploadFontFromBytes({
      fileName: 'Custom_Serif.ttf',
      bytes: makeFontBytes([0x00, 0x01, 0x00, 0x00]),
      options: { registerFontFace: async () => {} },
    });
    expect(ttf.extension).toBe('.ttf');
    expect(ttf.family).toBe('Custom Serif');

    const appleTtf = await uploadFontFromBytes({
      fileName: 'AppleTrue.ttf',
      bytes: makeFontBytes([0x74, 0x72, 0x75, 0x65]),
      options: { registerFontFace: async () => {} },
    });
    expect(appleTtf.extension).toBe('.ttf');

    const otf = await uploadFontFromBytes({
      fileName: 'DecoDisplay.otf',
      bytes: makeFontBytes([0x4f, 0x54, 0x54, 0x4f]),
      options: { registerFontFace: async () => {} },
    });
    expect(otf.extension).toBe('.otf');
    expect(otf.cssFormat).toBe('opentype');

    const woff2 = await uploadFontFromBytes({
      fileName: 'ModernSans.woff2',
      bytes: makeFontBytes([0x77, 0x4f, 0x46, 0x32]),
      options: { registerFontFace: async () => {} },
    });
    expect(woff2.extension).toBe('.woff2');
    expect(woff2.cssFormat).toBe('woff2');

    expect(getUploadedFonts()).toHaveLength(4);
  });

  it('rejects disallowed extensions, empty files, oversized files (>10 MB), and spoofed magic bytes', () => {
    // Disallowed extensions
    expect(() => validateFontUpload('legacy.woff', makeFontBytes([0x77, 0x4f, 0x46, 0x46]))).toThrowError(
      FontUploadError
    );
    expect(() => validateFontUpload('icon.svg', makeFontBytes([0x3c, 0x73, 0x76, 0x67]))).toThrowError(
      /Only \.ttf, \.otf, and \.woff2/i
    );
    expect(() => validateFontUpload('notafont.png', makeFontBytes([0x89, 0x50, 0x4e, 0x47]))).toThrowError(
      FontUploadError
    );

    // Empty file
    expect(() => validateFontUpload('empty.ttf', new Uint8Array(0), 0)).toThrowError(
      /empty/i
    );

    // Oversized (> 10 MB)
    expect(() =>
      validateFontUpload('huge.otf', makeFontBytes([0x4f, 0x54, 0x54, 0x4f]), MAX_UPLOAD_FONT_BYTES + 1)
    ).toThrowError(/10 MB/i);

    // Mismatched magic bytes (e.g. PNG header renamed .ttf, or OTF header in .woff2)
    expect(() =>
      validateFontUpload('fake.ttf', makeFontBytes([0x89, 0x50, 0x4e, 0x47]))
    ).toThrowError(/signature/i);
    expect(() =>
      validateFontUpload('wrong.otf', makeFontBytes([0x77, 0x4f, 0x46, 0x32]))
    ).toThrowError(/signature/i);
    expect(() =>
      validateFontUpload('wrong.woff2', makeFontBytes([0x00, 0x01, 0x00, 0x00]))
    ).toThrowError(/signature/i);
  });

  it('handles FontFace load failures cleanly without crashing or registering broken fonts', async () => {
    await expect(
      uploadFontFromBytes({
        fileName: 'Corrupt.woff2',
        bytes: makeFontBytes([0x77, 0x4f, 0x46, 0x32]),
        options: {
          registerFontFace: async () => {
            throw new DOMException('Invalid font table', 'SyntaxError');
          },
        },
      })
    ).rejects.toThrowError(/Could not load the font binary/i);

    expect(getUploadedFonts()).toHaveLength(0);
  });

  it('updates summary banner and availability cache when an uploaded font is applied to missing-font layers', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
        <text x="100" y="120" font-family="BrandMissingDisplay" font-size="36">Main Title</text>
        <text x="100" y="200" font-family="Cormorant Garamond" font-size="20">Subtitle</text>
      </svg>
    `;

    const scene = parseSvgToScene(svg, 'Upload Test');
    const before = scanSceneFontUsage(scene, () => false);
    expect(before.missingCount).toBe(1);
    expect(before.missingFonts).toEqual(['BrandMissingDisplay']);
    expect(before.summaryText).toContain('1 missing: BrandMissingDisplay');

    const record = await uploadFontFromBytes({
      fileName: 'BrandDisplayPro.woff2',
      bytes: makeFontBytes([0x77, 0x4f, 0x46, 0x32]),
      options: { registerFontFace: async () => {} },
    });

    const missingNodeIds = before.entries.find((e) => e.isMissing)?.affectedNodeIds ?? [];
    expect(missingNodeIds).toHaveLength(1);

    // Apply uploaded font to affected layers
    let nextNodes = scene.nodes;
    for (const id of missingNodeIds) {
      nextNodes = updateNodeInTree(nextNodes, id, (node, ancestors) =>
        applyTextEditToNode(node, { fontFamily: record.family }, scene.cssRules, ancestors)
      );
    }

    const updatedScene = { ...scene, nodes: nextNodes };
    const after = scanSceneFontUsage(updatedScene, () => false);
    expect(after.missingCount).toBe(0);
    expect(after.missingFonts).toEqual([]);
    expect(after.summaryText).not.toContain('missing');
    expect(isFontAvailableInBrowser(record.family)).toBe(true);
  });

  it('does NOT embed uploaded fonts into exported SVG by default, and embeds only when explicitly enabled', async () => {
    const record = await uploadFontFromBytes({
      fileName: 'PrivateClientFont.otf',
      bytes: makeFontBytes([0x4f, 0x54, 0x54, 0x4f]),
      options: { registerFontFace: async () => {} },
    });

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
        <text x="100" y="120" font-family="${record.family}" font-size="36">Client Headline</text>
      </svg>
    `;
    const scene = parseSvgToScene(svg, 'Export Opt-In Test');
    const docState: SvgEditorDocumentStateV1 = {
      designVersion: '1',
      scene,
      transparentBackground: false,
    };

    // Default export (embedUploadedFonts omitted / false)
    const defaultCss = await collectEmbeddedFontCssForExport(docState, { embedFonts: false });
    expect(defaultCss).toBeUndefined();
    const defaultSvg = buildEditableSvgString(docState, defaultCss);
    expect(defaultSvg).not.toContain('@font-face');
    expect(defaultSvg).not.toContain('data:font/otf;base64');

    // Explicit opt-in (embedUploadedFonts: true)
    const optedInCss = await collectEmbeddedFontCssForExport(docState, {
      embedFonts: false,
      embedUploadedFonts: true,
    });
    expect(optedInCss).toContain("@font-face { font-family: 'PrivateClientFont'");
    expect(optedInCss).toContain('data:font/otf;base64,');

    const optedInSvg = buildEditableSvgString(docState, optedInCss);
    expect(optedInSvg).toContain('data:font/otf;base64,');
  });
});
