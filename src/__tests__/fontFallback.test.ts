import { describe, expect, it } from 'vitest';
import {
  resolveFontFamily,
  SUPPORTED_FONT_CATALOG,
  SUPPORTED_FONT_NAME_SET,
  SYSTEM_FONT_FALLBACK_MAP,
} from '../engine/fonts';
import {
  collectTextNodesWithAncestors,
  getTextNodeProperties,
  parseSvgToScene,
  serializeSceneToSvg,
} from '../engine/svgScene';
import { getFontDefinition } from '../services/fontLoader';

describe('Smart font fallback mapping table (Task 3)', () => {
  it('maps the 5 common system fonts to their bundled open-license alternatives', () => {
    expect(SYSTEM_FONT_FALLBACK_MAP.georgia).toBe('Cormorant Garamond');
    expect(SYSTEM_FONT_FALLBACK_MAP.impact).toBe('Bebas Neue');
    expect(SYSTEM_FONT_FALLBACK_MAP['courier new']).toBe('JetBrains Mono');
    expect(SYSTEM_FONT_FALLBACK_MAP['times new roman']).toBe('Playfair Display');
    expect(SYSTEM_FONT_FALLBACK_MAP.arial).toBe('Inter');

    expect(resolveFontFamily('Georgia')).toMatchObject({
      originalFamily: 'Georgia',
      resolvedFamily: 'Cormorant Garamond',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
    expect(resolveFontFamily('Impact')).toMatchObject({
      originalFamily: 'Impact',
      resolvedFamily: 'Bebas Neue',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
    expect(resolveFontFamily('Courier New')).toMatchObject({
      originalFamily: 'Courier New',
      resolvedFamily: 'JetBrains Mono',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
    expect(resolveFontFamily('Times New Roman')).toMatchObject({
      originalFamily: 'Times New Roman',
      resolvedFamily: 'Playfair Display',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
    expect(resolveFontFamily('Arial')).toMatchObject({
      originalFamily: 'Arial',
      resolvedFamily: 'Inter',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
  });

  it('handles case-insensitive and quoted CSS font-family stacks', () => {
    expect(resolveFontFamily("'GEORGIA', serif")).toMatchObject({
      originalFamily: 'GEORGIA',
      resolvedFamily: 'Cormorant Garamond',
      wasFallback: true,
      fallbackSource: 'mapped',
    });

    expect(resolveFontFamily(' "times new roman" , Georgia, serif ')).toMatchObject({
      originalFamily: 'times new roman',
      resolvedFamily: 'Playfair Display',
      wasFallback: true,
      fallbackSource: 'mapped',
    });
  });

  it('bundles only open-license fonts and excludes proprietary Microsoft system fonts', () => {
    for (const family of ['Bebas Neue', 'JetBrains Mono', 'Inter']) {
      expect(SUPPORTED_FONT_NAME_SET.has(family)).toBe(true);
      const entry = SUPPORTED_FONT_CATALOG.find((f) => f.family === family);
      expect(entry?.license).toContain('Open Font License');
      expect(getFontDefinition(family)).toBeDefined();
    }

    for (const systemFont of ['Georgia', 'Impact', 'Courier New', 'Times New Roman', 'Arial']) {
      expect(SUPPORTED_FONT_NAME_SET.has(systemFont)).toBe(false);
    }
  });

  it('applies fallback metadata automatically while preserving original font on SVG export', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
        <text x="40" y="60" font-family="Georgia" font-size="24">Georgia Line</text>
        <text x="40" y="120" font-family="Impact" font-size="36">IMPACT LINE</text>
        <text x="40" y="180" font-family="Courier New" font-size="16">CODE_01</text>
        <text x="40" y="240" font-family="Times New Roman" font-size="24">Times Line</text>
        <text x="40" y="300" font-family="Arial" font-size="18">Arial Line</text>
      </svg>
    `;

    const scene = parseSvgToScene(svg, 'Fallback Test');
    const textEntries = collectTextNodesWithAncestors(scene.nodes);
    expect(textEntries).toHaveLength(5);

    const expected = [
      { original: 'Georgia', fallback: 'Cormorant Garamond' },
      { original: 'Impact', fallback: 'Bebas Neue' },
      { original: 'Courier New', fallback: 'JetBrains Mono' },
      { original: 'Times New Roman', fallback: 'Playfair Display' },
      { original: 'Arial', fallback: 'Inter' },
    ];

    textEntries.forEach(({ node, ancestors }, idx) => {
      const props = getTextNodeProperties(node, scene.cssRules, ancestors);
      expect(props.isFontFallback).toBe(true);
      expect(props.originalFontFamily).toBe(expected[idx].original);
      expect(props.fontFamily).toBe(expected[idx].original);
      expect(props.fallbackPreviewFamily).toBe(expected[idx].fallback);
    });

    // Serializing back to SVG must preserve the original font-family attributes
    const exported = serializeSceneToSvg(scene);
    for (const item of expected) {
      expect(exported).toContain(item.original);
    }
  });
});
