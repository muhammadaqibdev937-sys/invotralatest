import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearFontAvailabilityCache,
  isFontAvailableInBrowser,
  summarizeFontUsage,
} from '../engine/fonts';
import { parseSvgToScene, scanSceneFontUsage } from '../engine/svgScene';

describe('Canvas measureText font availability detection', () => {
  afterEach(() => {
    clearFontAvailabilityCache();
    vi.restoreAllMocks();
  });

  it('returns true when measured width differs from generic baselines and caches result', () => {
    let measureCalls = 0;
    let currentFont = '';
    const mockCtx = {
      set font(val: string) {
        currentFont = val;
      },
      get font() {
        return currentFont;
      },
      measureText: vi.fn(() => {
        measureCalls += 1;
        // Return distinct width when testing Georgia against serif baseline
        if (currentFont.includes('"Georgia"')) {
          return { width: 412.5 } as TextMetrics;
        }
        return { width: 350.0 } as TextMetrics;
      }),
    };

    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );

    expect(isFontAvailableInBrowser('"Georgia", serif')).toBe(true);
    const firstCallCount = measureCalls;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second lookup for same font (even different casing/quotes) should hit cache
    expect(isFontAvailableInBrowser('georgia')).toBe(true);
    expect(measureCalls).toBe(firstCallCount);
    spy.mockRestore();
  });

  it('returns false when measured widths match all generic baselines', () => {
    const mockCtx = {
      font: '',
      measureText: vi.fn(() => ({ width: 300.0 } as TextMetrics)),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );

    expect(isFontAvailableInBrowser('NonExistentFantasyFont')).toBe(false);
  });

  it('returns false safely without throwing when 2d context is null or throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isFontAvailableInBrowser('Georgia')).toBe(false);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('Canvas disabled');
    });
    expect(isFontAvailableInBrowser('Georgia')).toBe(false);
  });
});

describe('Document font usage scan summary', () => {
  it('scans all text fonts once and builds concise summary like "3 fonts, 1 missing: Georgia"', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
        <text x="20" y="40" font-family="Playfair Display" font-size="28">Title</text>
        <text x="20" y="80" font-family="Lato" font-size="16">Subtitle</text>
        <text x="20" y="120" font-family="Georgia" font-size="18">Body 1</text>
        <text x="20" y="160" font-family="Georgia, serif" font-size="18">Body 2</text>
      </svg>
    `;
    const scene = parseSvgToScene(svg, 'Test Invitation');
    const summary = scanSceneFontUsage(scene, () => false);

    expect(summary.totalFonts).toBe(3);
    expect(summary.bundledCount).toBe(2);
    expect(summary.missingCount).toBe(1);
    expect(summary.missingFonts).toEqual(['Georgia']);
    expect(summary.summaryText).toBe('3 fonts, 1 missing: Georgia');

    const georgiaEntry = summary.entries.find((e) => e.originalFamily === 'Georgia');
    expect(georgiaEntry?.affectedNodeIds.length).toBe(2);
  });

  it('treats browser-available unbundled fonts as available rather than missing', () => {
    const summary = summarizeFontUsage(
      [
        { rawFont: 'Playfair Display', nodeId: 'n1' },
        { rawFont: 'Georgia', nodeId: 'n2' },
      ],
      (family) => family.toLowerCase() === 'georgia'
    );

    expect(summary.totalFonts).toBe(2);
    expect(summary.bundledCount).toBe(1);
    expect(summary.browserAvailableCount).toBe(1);
    expect(summary.missingCount).toBe(0);
    expect(summary.summaryText).toContain('all available');
  });
});
