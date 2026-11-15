import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SvgSceneContent } from '../components/Canvas/SvgSceneRenderer';
import { sanitizeSvgDocument } from '../engine/sanitizeSvg';
import {
  applyTextEditToNode,
  collectAllNodes,
  findNodeWithAncestors,
  formatNodeCapabilityNotice,
  getNodeTspans,
  parseSvgToScene,
  serializeSceneToSvg,
  SvgSceneDocument,
  SvgSceneNode,
  updateNodeInTree,
} from '../engine/svgScene';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

function countDomElementsAndAttrs(svgMarkup: string): { elements: number; attrs: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const all = [doc.documentElement, ...Array.from(doc.documentElement.querySelectorAll('*'))];
  let attrs = 0;
  for (const el of all) {
    attrs += el.attributes.length;
  }
  return { elements: all.length, attrs };
}

function importRenderExport(svgMarkup: string): {
  sanitized: ReturnType<typeof sanitizeSvgDocument>;
  scene: SvgSceneDocument;
  renderedMarkup: string;
  exportedSvg: string;
} {
  const sanitized = sanitizeSvgDocument(svgMarkup);
  const serializedClean = new XMLSerializer().serializeToString(sanitized.rootElement);
  const scene = parseSvgToScene(serializedClean, 'compat-test');
  const renderedMarkup = renderToStaticMarkup(
    React.createElement(
      'svg',
      { viewBox: scene.viewBox },
      React.createElement(SvgSceneContent, { scene })
    )
  );
  const exportedSvg = serializeSceneToSvg(scene, {
    backgroundColor: scene.backgroundColor,
    transparentBackground: false,
  });
  return { sanitized, scene, renderedMarkup, exportedSvg };
}

function collectNodeSignature(el: Element): string {
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(';');
  const children = Array.from(el.children).map(collectNodeSignature).join(',');
  return `${el.tagName.toLowerCase()}[${attrs}](${children})`;
}

describe('Task 4: SVG Compatibility & Round-Trip Suite', () => {
  const fixtureNames = [
    'design-1-art-deco.svg',
    'design-2-cyberpunk.svg',
    'design-3-botanical-badge.svg',
    'design-4-dashboard.svg',
  ];

  it.each(fixtureNames)(
    'sanitizer preserves 100% of elements and attributes on %s with 0 findings',
    (name) => {
      const raw = loadFixture(name);
      const before = countDomElementsAndAttrs(raw);
      const sanitized = sanitizeSvgDocument(raw);
      const after = countDomElementsAndAttrs(
        new XMLSerializer().serializeToString(sanitized.rootElement)
      );

      expect(sanitized.securityFindings).toHaveLength(0);
      expect(after.elements).toBe(before.elements);
      expect(after.attrs).toBe(before.attrs);
    }
  );

  it('design-1-art-deco: preserves textPath (direct + tspan dx/dy), pattern, clipPath, stroke-dasharray, nested transforms, and unknown attrs across import/render/edit/export', () => {
    const raw = loadFixture('design-1-art-deco.svg');
    const { scene, renderedMarkup, exportedSvg } = importRenderExport(raw);

    // Render checks
    expect(renderedMarkup).toContain('<textPath');
    expect(renderedMarkup).toContain('href="#decoTopArc"');
    expect(renderedMarkup).toContain('href="#decoBottomArc"');
    expect(renderedMarkup).toContain('startOffset="50%"');
    expect(renderedMarkup).toContain('<pattern id="decoFanPattern"');
    expect(renderedMarkup).toContain('<clipPath id="decoArchClip"');
    expect(renderedMarkup).toContain('stroke-dasharray="14 6 4 6"');
    expect(renderedMarkup).toContain('data-custom-group="frame-arch"');
    expect(renderedMarkup).toContain('data-role="curved-header"');

    // Edit direct textPath node and verify curve survives
    const textNodes = collectAllNodes(scene.nodes).filter((n) => n.tag === 'text');
    const topArcNode = textNodes.find((n) => n.textPath && !n.textPath.tspans);
    const bottomArcNode = textNodes.find((n) => n.textPath && n.textPath.tspans);
    expect(topArcNode).toBeDefined();
    expect(bottomArcNode).toBeDefined();

    let nextNodes = updateNodeInTree(scene.nodes, topArcNode!.id, (node) =>
      applyTextEditToNode(node, { text: 'MIDNIGHT SOIREE' }, scene.cssRules)
    );
    nextNodes = updateNodeInTree(nextNodes, bottomArcNode!.id, (node) =>
      applyTextEditToNode(node, { tspanIndex: 0, tspanText: 'JANUARY' }, scene.cssRules)
    );

    const editedScene: SvgSceneDocument = { ...scene, nodes: nextNodes };
    const editedRendered = renderToStaticMarkup(
      React.createElement(
        'svg',
        { viewBox: editedScene.viewBox },
        React.createElement(SvgSceneContent, { scene: editedScene })
      )
    );
    const editedExport = serializeSceneToSvg(editedScene);

    expect(editedRendered).toContain('<textPath');
    expect(editedRendered).toContain('MIDNIGHT SOIREE');
    expect(editedRendered).toContain('JANUARY');
    expect(editedRendered).toContain('dx="12"');

    expect(editedExport).toContain('<textPath href="#decoTopArc" startOffset="50%" text-anchor="middle">MIDNIGHT SOIREE</textPath>');
    expect(editedExport).toContain('<textPath xlink:href="#decoBottomArc" startOffset="50%" text-anchor="middle">');
    expect(editedExport).toContain('<tspan dy="-6">JANUARY</tspan>');
    expect(editedExport).toContain('<tspan dx="12" font-weight="700">31</tspan>');
    expect(exportedSvg).toContain('data-marketplace-sku="art-deco-01"');
  });

  it('design-2-cyberpunk: preserves filters, mask, nested <defs><clipPath> inside <g>, mix-blend-mode CSS rendering, tspan dx, and stroke-dasharray', () => {
    const raw = loadFixture('design-2-cyberpunk.svg');
    const { scene, renderedMarkup, exportedSvg } = importRenderExport(raw);

    // Filter primitives & mask
    expect(renderedMarkup).toContain('<feGaussianBlur');
    expect(renderedMarkup).toContain('stdDeviation="6"');
    expect(renderedMarkup).toContain('<feDropShadow');
    expect(renderedMarkup).toContain('<feTurbulence');
    expect(renderedMarkup).toContain('baseFrequency="0.03 0.15"');
    expect(renderedMarkup).toContain('<feDisplacementMap');
    expect(renderedMarkup).toContain('xChannelSelector="R"');
    expect(renderedMarkup).toContain('<mask id="scanlineMask"');

    // Nested defs inside <g>
    const groupWithInlineDefs = collectAllNodes(scene.nodes).find(
      (n) => n.tag === 'g' && (n.inlineDefs?.length ?? 0) > 0
    );
    expect(groupWithInlineDefs).toBeDefined();
    expect(renderedMarkup).toMatch(/<clipPath[^>]*id="nestedHexClip"/);
    expect(exportedSvg).toMatch(/<clipPath[^>]*id="nestedHexClip"/);

    // mix-blend-mode mapped cleanly to CSS style in render output, preserved as attr/style in export
    expect(renderedMarkup).toContain('mix-blend-mode:screen');
    expect(renderedMarkup).toContain('mix-blend-mode:lighten');
    expect(renderedMarkup).not.toContain('mix-blend-mode="screen"');
    expect(exportedSvg).toContain('mix-blend-mode="screen"');
    expect(exportedSvg).toContain('mix-blend-mode: lighten');

    // tspan dx and stroke-dasharray
    expect(renderedMarkup).toContain('dx="10"');
    expect(renderedMarkup).toContain('stroke-dasharray="10 4"');
    expect(exportedSvg).toContain('data-theme="neon-noir"');
  });

  it('design-3-botanical-badge: preserves symbol/use, nested pattern & mask defs inside <g>, curved textPath editing, and stroke-dasharray', () => {
    const raw = loadFixture('design-3-botanical-badge.svg');
    const { scene, renderedMarkup, exportedSvg } = importRenderExport(raw);

    expect(renderedMarkup).toContain('<symbol id="botanicalLeaf"');
    expect(renderedMarkup).toContain('<use href="#botanicalLeaf"');
    expect(renderedMarkup).toMatch(/<pattern[^>]*id="nestedDotPattern"/);
    expect(renderedMarkup).toMatch(/<mask[^>]*id="nestedRingMask"/);
    expect(exportedSvg).toMatch(/<pattern[^>]*id="nestedDotPattern"/);
    expect(exportedSvg).toMatch(/<mask[^>]*id="nestedRingMask"/);
    expect(renderedMarkup).toContain('stroke-dasharray="6 4"');
    expect(exportedSvg).toContain('data-badge-series="botanical"');
    expect(exportedSvg).toContain('data-group-kind="seal"');

    // Edit curved textPath with child tspans and ensure getNodeTspans returns them
    const bottomBadgeText = collectAllNodes(scene.nodes).find(
      (n) => n.tag === 'text' && (getNodeTspans(n)?.length ?? 0) > 1
    );
    expect(bottomBadgeText).toBeDefined();
    expect(getNodeTspans(bottomBadgeText!)).toHaveLength(2);

    const editedNodes = updateNodeInTree(scene.nodes, bottomBadgeText!.id, (node) =>
      applyTextEditToNode(node, { tspanIndex: 1, tspanText: '1988' }, scene.cssRules)
    );
    const editedExport = serializeSceneToSvg({ ...scene, nodes: editedNodes });
    expect(editedExport).toContain('<textPath href="#badgeCircleBottom" startOffset="50%" text-anchor="middle">');
    expect(editedExport).toContain('<tspan dx="8" font-weight="700">1988</tspan>');
  });

  it('design-4-dashboard: preserves marker, nested marker/symbol/filter directly inside <g>, use, tspan dx, nested transforms, and stroke-dasharray', () => {
    const raw = loadFixture('design-4-dashboard.svg');
    const { scene, renderedMarkup, exportedSvg } = importRenderExport(raw);

    expect(renderedMarkup).toContain('<marker id="arrowEnd"');
    expect(renderedMarkup).toContain('marker-end="url(#arrowEnd)"');
    expect(renderedMarkup).toContain('marker-start="url(#dotStart)"');
    expect(renderedMarkup).toContain('marker-mid="url(#nestedTickMarker)"');
    expect(renderedMarkup).toMatch(/<marker[^>]*id="nestedTickMarker"/);
    expect(renderedMarkup).toMatch(/<symbol[^>]*id="nestedSparkIcon"/);
    expect(renderedMarkup).toMatch(/<filter[^>]*id="nestedSoftBlur"/);
    expect(exportedSvg).toMatch(/<marker[^>]*id="nestedTickMarker"/);
    expect(exportedSvg).toMatch(/<symbol[^>]*id="nestedSparkIcon"/);
    expect(exportedSvg).toMatch(/<filter[^>]*id="nestedSoftBlur"/);
    expect(renderedMarkup).toContain('<use href="#nestedSparkIcon"');
    expect(renderedMarkup).toContain('dx="16"');
    expect(renderedMarkup).toContain('stroke-dasharray="8 5"');
    expect(exportedSvg).toContain('data-layout="analytics-v2"');
    expect(exportedSvg).toContain('data-widget="kpi-card"');
    expect(exportedSvg).toContain('data-metric-title="revenue"');

    // Nested <g> transform preservation
    const innerGroup = collectAllNodes(scene.nodes).find(
      (n) => n.tag === 'g' && n.transform.tx === 40 && n.transform.ty === 160
    );
    expect(innerGroup).toBeDefined();
  });

  it.each(fixtureNames)(
    'round-trips <defs> content and unknown custom attributes unchanged on %s',
    (name) => {
      const raw = loadFixture(name);
      const parser = new DOMParser();
      const beforeDoc = parser.parseFromString(raw, 'image/svg+xml');
      const beforeTopDefs = beforeDoc.documentElement.querySelector(':scope > defs');

      const { exportedSvg } = importRenderExport(raw);
      const afterDoc = parser.parseFromString(exportedSvg, 'image/svg+xml');
      const afterTopDefs = afterDoc.documentElement.querySelector(':scope > defs');

      expect(Boolean(afterTopDefs)).toBe(Boolean(beforeTopDefs));
      if (beforeTopDefs && afterTopDefs) {
        expect(collectNodeSignature(afterTopDefs)).toBe(collectNodeSignature(beforeTopDefs));
      }

      // Verify all custom data-* attributes on root and nodes survived
      for (const attr of Array.from(beforeDoc.documentElement.attributes)) {
        if (attr.name.startsWith('data-')) {
          expect(afterDoc.documentElement.getAttribute(attr.name)).toBe(attr.value);
        }
      }
      const beforeCustom = beforeDoc.documentElement.querySelectorAll('[data-custom-group],[data-role],[data-group-kind],[data-widget],[data-metric-title]');
      for (const el of Array.from(beforeCustom)) {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.startsWith('data-')) {
            expect(exportedSvg).toContain(`${attr.name}="${attr.value}"`);
          }
        }
      }
    }
  );

  it('generates subtle capability notice for filter, mask, clip-path, pattern, textPath, and use layers', () => {
    const findNodeNotice = (scene: SvgSceneDocument, predicate: (n: SvgSceneNode) => boolean) => {
      const target = collectAllNodes(scene.nodes).find(predicate);
      expect(target).toBeDefined();
      const info = findNodeWithAncestors(scene.nodes, target!.id);
      return formatNodeCapabilityNotice(target!, scene, info?.ancestors ?? []);
    };

    const artDeco = importRenderExport(loadFixture('design-1-art-deco.svg')).scene;
    expect(findNodeNotice(artDeco, (n) => Boolean(n.attrs.fill?.includes('decoFanPattern')))).toBe(
      'This layer uses pattern; editing may be limited.'
    );
    expect(findNodeNotice(artDeco, (n) => Boolean(n.attrs['clip-path']))).toBe(
      'This layer uses clip-path; editing may be limited.'
    );
    expect(findNodeNotice(artDeco, (n) => Boolean(n.textPath))).toBe(
      'This layer uses textPath; editing may be limited.'
    );

    const cyber = importRenderExport(loadFixture('design-2-cyberpunk.svg')).scene;
    expect(findNodeNotice(cyber, (n) => Boolean(n.attrs.mask))).toBe(
      'This layer uses mask; editing may be limited.'
    );
    expect(findNodeNotice(cyber, (n) => Boolean(n.attrs.filter))).toBe(
      'This layer uses filter; editing may be limited.'
    );

    const botanical = importRenderExport(loadFixture('design-3-botanical-badge.svg')).scene;
    expect(findNodeNotice(botanical, (n) => n.tag === 'use')).toBe(
      'This layer uses use; editing may be limited.'
    );

    // Plain rectangle without advanced features has no capability notice
    const plainBg = collectAllNodes(artDeco.nodes).find((n) => n.isBackground);
    expect(plainBg).toBeDefined();
    expect(formatNodeCapabilityNotice(plainBg!, artDeco, [])).toBeNull();
  });
});
