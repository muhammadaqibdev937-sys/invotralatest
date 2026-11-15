import { describe, expect, it, vi } from 'vitest';
import { hasUnsafeUriScheme, sanitizeSvgDocument, SvgLoadError } from '../engine/sanitizeSvg';

describe('sanitizeSvgDocument (Task 5 Security)', () => {
  it('removes <script> elements and inline on* event handlers', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" onload="alert(1)">
        <script>alert("xss")</script>
        <g onclick="steal()">
          <rect x="10" y="10" width="100" height="50" fill="#111111" onmouseover="evil()" />
        </g>
        <defs>
          <script type="text/javascript">window.pwn = true;</script>
        </defs>
      </svg>
    `;
    const res = sanitizeSvgDocument(svg);
    expect(res.rootElement.querySelectorAll('script')).toHaveLength(0);
    expect(res.rootElement.hasAttribute('onload')).toBe(false);
    const g = res.rootElement.querySelector('g');
    expect(g?.hasAttribute('onclick')).toBe(false);
    const rect = res.rootElement.querySelector('rect');
    expect(rect?.hasAttribute('onmouseover')).toBe(false);
    expect(res.securityFindings.length).toBeGreaterThanOrEqual(4);
  });

  it('strips case, whitespace, control-char, entity, and percent-encoded javascript: URIs', () => {
    expect(hasUnsafeUriScheme('javascript:alert(1)')).toBe(true);
    expect(hasUnsafeUriScheme('JaVaScRiPt:alert(1)')).toBe(true);
    expect(hasUnsafeUriScheme('  java\n\t script:alert(1)')).toBe(true);
    expect(hasUnsafeUriScheme('java\u0007script:alert(1)')).toBe(true);
    expect(hasUnsafeUriScheme('%6a%61vascript:alert(1)')).toBe(true);
    expect(hasUnsafeUriScheme('data:text/html,<script>alert(1)</script>')).toBe(true);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 200">
        <a href="JaVa&#x09;ScRiPt:alert(1)">
          <text x="10" y="30">Link 1</text>
        </a>
        <a xlink:href="%6a%61vascript:alert(2)">
          <text x="10" y="60">Link 2</text>
        </a>
        <rect x="10" y="80" width="50" height="20" style="background: url(javascript:alert(3))" />
      </svg>
    `;
    const res = sanitizeSvgDocument(svg);
    const links = res.rootElement.querySelectorAll('a');
    expect(links[0].hasAttribute('href')).toBe(false);
    expect(links[1].hasAttribute('xlink:href')).toBe(false);
    expect(res.rootElement.querySelector('rect')?.hasAttribute('style')).toBe(false);
  });

  it('strips CSS @import and external url() inside <style> while keeping internal url(#id)', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <defs>
          <linearGradient id="g1"><stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="#fff"/></linearGradient>
          <style type="text/css">
            @import url("https://evil.example/evil.css");
            @im/*split*/port "https://evil.example/other.css";
            .bad { fill: url("https://evil.example/tracker.svg#x"); }
            .cssEsc { fill: \\75rl(https://evil.example/esc.png); }
            .good { fill: url(#g1); }
          </style>
        </defs>
        <rect class="good" x="0" y="0" width="100" height="100" />
      </svg>
    `;
    const res = sanitizeSvgDocument(svg);
    const styleText = res.rootElement.querySelector('style')?.textContent || '';
    expect(styleText).not.toMatch(/@import/i);
    expect(styleText).not.toContain('evil.example');
    expect(styleText).toContain('url(#g1)');
  });

  it('strips external refs on feImage and <use> while preserving internal #id refs', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 200">
        <defs>
          <symbol id="badge" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></symbol>
          <filter id="f1">
            <feImage id="extFe" href="https://evil.example/leak.png" />
            <feImage id="intFe" xlink:href="#badge" />
          </filter>
        </defs>
        <use id="extUse" href="https://evil.example/sprite.svg#icon" x="0" y="0" />
        <use id="intUse" xlink:href="#badge" x="20" y="20" />
        <image id="safeRaster" href="data:image/png;base64,iVBORw0KGgo=" x="0" y="0" width="10" height="10" />
        <image id="badSvgData" href="data:image/svg+xml;base64,PHN2Zz4=" x="0" y="0" width="10" height="10" />
      </svg>
    `;
    const res = sanitizeSvgDocument(svg);
    expect(res.rootElement.querySelector('#extFe')?.hasAttribute('href')).toBe(false);
    expect(res.rootElement.querySelector('#intFe')?.getAttribute('xlink:href')).toBe('#badge');
    expect(res.rootElement.querySelector('#extUse')?.hasAttribute('href')).toBe(false);
    expect(res.rootElement.querySelector('#intUse')?.getAttribute('xlink:href')).toBe('#badge');
    expect(res.rootElement.querySelector('#safeRaster')?.getAttribute('href')).toContain('data:image/png');
    expect(res.rootElement.querySelector('#badSvgData')?.hasAttribute('href')).toBe(false);
  });

  it('preserves valid Task 4 SVG features intact', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
        <defs>
          <path id="curve" d="M 20 200 Q 300 50 580 200" />
          <clipPath id="clip1"><rect x="0" y="0" width="300" height="400" /></clipPath>
          <mask id="mask1"><rect x="0" y="0" width="600" height="400" fill="#fff" /></mask>
          <pattern id="pat1" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2"/></pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
          <filter id="fx">
            <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
            <feGaussianBlur stdDeviation="2" />
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3" />
          </filter>
        </defs>
        <g transform="translate(10,20)" style="mix-blend-mode: multiply">
          <rect x="0" y="0" width="200" height="100" fill="url(#pat1)" clip-path="url(#clip1)" mask="url(#mask1)" filter="url(#fx)" stroke-dasharray="4 2" />
          <line x1="10" y1="10" x2="100" y2="10" marker-end="url(#arrow)" />
          <text font-size="24"><textPath href="#curve" startOffset="10%">Curved <tspan dx="4">Text</tspan></textPath></text>
        </g>
      </svg>
    `;
    const res = sanitizeSvgDocument(svg);
    expect(res.securityFindings).toHaveLength(0);
    expect(res.rootElement.querySelector('textPath')?.getAttribute('href')).toBe('#curve');
    expect(res.rootElement.querySelector('feTurbulence')).not.toBeNull();
    expect(res.rootElement.querySelector('feDisplacementMap')).not.toBeNull();
    expect(res.rootElement.querySelector('feGaussianBlur')).not.toBeNull();
    expect(res.rootElement.querySelector('feDropShadow')).not.toBeNull();
    expect(res.rootElement.querySelector('clipPath')).not.toBeNull();
    expect(res.rootElement.querySelector('mask')).not.toBeNull();
    expect(res.rootElement.querySelector('pattern')).not.toBeNull();
    expect(res.rootElement.querySelector('marker')).not.toBeNull();
  });

  it('throws SvgLoadError and logs on empty or malformed XML', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => sanitizeSvgDocument('')).toThrow(SvgLoadError);
    expect(() => sanitizeSvgDocument('<svg><unclosed></svg>')).toThrow(SvgLoadError);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
