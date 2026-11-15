import React from 'react';
import {
  buildTransformString,
  parseInlineStyleMap,
  SvgSceneDocument,
  SvgSceneNode,
  SvgStaticNode,
} from '../../engine/svgScene';
import { resolveFontFamily } from '../../engine/fonts';
import { getFontDefinition } from '../../services/fontLoader';

const SVG_ATTR_TO_REACT: Record<string, string> = {
  class: 'className',
  'xlink:href': 'href',
  'xml:space': 'xmlSpace',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity',
  'stroke-miterlimit': 'strokeMiterlimit',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-path': 'clipPath',
  'clip-rule': 'clipRule',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-style': 'fontStyle',
  'letter-spacing': 'letterSpacing',
  'word-spacing': 'wordSpacing',
  'text-anchor': 'textAnchor',
  'dominant-baseline': 'dominantBaseline',
  'alignment-baseline': 'alignmentBaseline',
  'text-decoration': 'textDecoration',
  'writing-mode': 'writingMode',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'gradient-units': 'gradientUnits',
  'gradient-transform': 'gradientTransform',
  'pattern-units': 'patternUnits',
  'pattern-transform': 'patternTransform',
  'pattern-content-units': 'patternContentUnits',
  'clip-path-units': 'clipPathUnits',
  'mask-units': 'maskUnits',
  'mask-content-units': 'maskContentUnits',
  'marker-start': 'markerStart',
  'marker-mid': 'markerMid',
  'marker-end': 'markerEnd',
  'marker-width': 'markerWidth',
  'marker-height': 'markerHeight',
  'marker-units': 'markerUnits',
  'ref-x': 'refX',
  'ref-y': 'refY',
  'preserve-aspect-ratio': 'preserveAspectRatio',
  'vector-effect': 'vectorEffect',
  'shape-rendering': 'shapeRendering',
  'color-interpolation': 'colorInterpolation',
  'color-interpolation-filters': 'colorInterpolationFilters',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'lighting-color': 'lightingColor',
  'std-deviation': 'stdDeviation',
  'base-frequency': 'baseFrequency',
  'num-octaves': 'numOctaves',
  'paint-order': 'paintOrder',
  tabindex: 'tabIndex',
};

const SKIP_ATTRS = new Set([
  'xmlns',
  'xmlns:xlink',
  'data-locked',
  'data-label',
  'inkscape:label',
  'transform',
  'display',
  'visibility',
]);

function cssKeyToCamel(key: string): string {
  if (key.startsWith('--')) return key;
  return key.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function inlineStyleToReactObject(styleStr: string | undefined): React.CSSProperties | undefined {
  if (!styleStr) return undefined;
  const map = parseInlineStyleMap(styleStr);
  const entries = Object.entries(map);
  if (entries.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (k === 'display' || k === 'visibility') continue;
    out[cssKeyToCamel(k)] = v;
  }
  return Object.keys(out).length > 0 ? (out as React.CSSProperties) : undefined;
}

function getCssFontFallback(rawFamily: string): string {
  const first = rawFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  const def = getFontDefinition(first);
  if (def) {
    const fallback =
      def.category === 'Script' ? 'cursive' : def.category === 'Sans' ? 'sans-serif' : 'serif';
    return `"${def.family}", ${fallback}`;
  }
  const resolved = resolveFontFamily(rawFamily);
  const bundledDef = getFontDefinition(resolved.resolvedFamily);
  const fallback =
    bundledDef?.category === 'Script'
      ? 'cursive'
      : bundledDef?.category === 'Sans'
      ? 'sans-serif'
      : 'serif';
  return first
    ? `"${first}", "${resolved.resolvedFamily}", ${fallback}`
    : `"${resolved.resolvedFamily}", ${fallback}`;
}

export function svgAttrsToReactProps(
  attrs: Record<string, string>,
  options?: { keepTransform?: boolean; fontPreviewFamily?: string }
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    const lower = rawKey.toLowerCase();
    if (!options?.keepTransform && SKIP_ATTRS.has(lower)) continue;
    if (options?.keepTransform && lower !== 'transform' && SKIP_ATTRS.has(lower)) continue;
    // Skip namespaces prefixes React doesn't accept cleanly
    if (lower.includes(':') && lower !== 'xlink:href' && lower !== 'xml:space') continue;

    if (lower === 'style') {
      const styleObj = inlineStyleToReactObject(rawVal);
      if (styleObj) props.style = styleObj;
      continue;
    }

    const reactKey = SVG_ATTR_TO_REACT[lower] || rawKey;
    if (reactKey === 'fontFamily') {
      props[reactKey] = getCssFontFallback(rawVal);
    } else {
      props[reactKey] = rawVal;
    }
  }

  if (options?.fontPreviewFamily) {
    const cssFam = getCssFontFallback(options.fontPreviewFamily);
    props.fontFamily = cssFam;
    if (props.style && typeof props.style === 'object') {
      props.style = { ...(props.style as Record<string, string>), fontFamily: cssFam };
    }
  }

  return props;
}

export function renderStaticSvgNode(node: SvgStaticNode, key: string): React.ReactNode {
  const tag = node.tag.toLowerCase();
  const props = svgAttrsToReactProps(node.attrs, { keepTransform: true });
  props.key = key;

  if (tag === 'style') {
    return React.createElement('style', { key, type: node.attrs.type || 'text/css' }, node.textContent ?? '');
  }

  const children = node.children.map((child, idx) =>
    renderStaticSvgNode(child, `${key}_${idx}`)
  );

  if (children.length > 0) {
    return React.createElement(node.tag, props, ...children);
  }
  if (node.textContent !== undefined) {
    return React.createElement(node.tag, props, node.textContent);
  }
  return React.createElement(node.tag, props);
}

interface RenderSceneOptions {
  previewFontOverride?: { nodeId: string; fontFamily: string } | null;
  transparentBackground?: boolean;
  onNodePointerDown?: (e: React.PointerEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeDoubleClick?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeContextMenu?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  interactive?: boolean;
}

export function renderSceneNode(
  node: SvgSceneNode,
  options: RenderSceneOptions = {}
): React.ReactNode {
  if (!node.visible) return null;
  if (options.transparentBackground && node.isBackground) return null;

  if (node.tag === 'preserved' && node.staticNode) {
    return React.createElement(
      'g',
      {
        key: node.id,
        'data-scene-id': node.id,
        'data-scene-tag': 'preserved',
        style: { pointerEvents: 'none' },
      },
      renderStaticSvgNode(node.staticNode, `${node.id}_static`)
    );
  }

  const isPreviewed = options.previewFontOverride?.nodeId === node.id;
  const previewFam = isPreviewed ? options.previewFontOverride?.fontFamily : undefined;

  const props = svgAttrsToReactProps(node.attrs, {
    fontPreviewFamily: previewFam,
  });

  props.key = node.id;
  props['data-scene-id'] = node.id;
  props['data-scene-tag'] = node.tag;

  const transformStr = buildTransformString(node.transform);
  if (transformStr) {
    props.transform = transformStr;
  }

  if (options.interactive) {
    if (node.isBackground) {
      props.style = {
        ...((props.style as Record<string, string>) || {}),
        cursor: node.locked ? 'default' : 'move',
      };
    } else if (node.locked) {
      props.style = {
        ...((props.style as Record<string, string>) || {}),
        cursor: 'not-allowed',
      };
    } else {
      props.style = {
        ...((props.style as Record<string, string>) || {}),
        cursor: node.tag === 'text' ? 'move' : 'pointer',
      };
    }

    if (options.onNodePointerDown) {
      props.onPointerDown = (e: React.PointerEvent<SVGElement>) =>
        options.onNodePointerDown!(e, node);
    }
    if (options.onNodeDoubleClick) {
      props.onDoubleClick = (e: React.MouseEvent<SVGElement>) =>
        options.onNodeDoubleClick!(e, node);
    }
    if (options.onNodeContextMenu) {
      props.onContextMenu = (e: React.MouseEvent<SVGElement>) =>
        options.onNodeContextMenu!(e, node);
    }
  }

  if (node.tag === 'g') {
    const children = (node.children ?? []).map((child) => renderSceneNode(child, options));
    return React.createElement('g', props, ...children);
  }

  if (node.tag === 'text') {
    props.xmlSpace = 'preserve';
    props.style = {
      ...((props.style as Record<string, string>) || {}),
      whiteSpace: 'pre',
    };
    if (node.tspans && node.tspans.length > 0) {
      const tspanEls = node.tspans.map((ts) => {
        const tsProps = svgAttrsToReactProps(ts.attrs, {
          fontPreviewFamily: previewFam,
        });
        tsProps.key = ts.id;
        return React.createElement('tspan', tsProps, ts.text || ' ');
      });
      return React.createElement('text', props, ...tspanEls);
    }
    return React.createElement('text', props, node.textContent || ' ');
  }

  return React.createElement(node.tag, props);
}

interface SvgSceneContentProps {
  scene: SvgSceneDocument;
  transparentBackground?: boolean;
  previewFontOverride?: { nodeId: string; fontFamily: string } | null;
  interactive?: boolean;
  onNodePointerDown?: (e: React.PointerEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeDoubleClick?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeContextMenu?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
}

export const SvgSceneContent: React.FC<SvgSceneContentProps> = React.memo(
  ({
    scene,
    transparentBackground = false,
    previewFontOverride = null,
    interactive = false,
    onNodePointerDown,
    onNodeDoubleClick,
    onNodeContextMenu,
  }) => {
    return (
      <>
        {scene.defsNodes.map((defNode, idx) => renderStaticSvgNode(defNode, `def_${idx}`))}

        {!transparentBackground && !scene.hasExplicitBackground && (
          <rect
            data-canvas-bg="true"
            x={scene.vbX}
            y={scene.vbY}
            width={scene.vbW}
            height={scene.vbH}
            fill={scene.backgroundColor}
          />
        )}

        {scene.nodes.map((node) =>
          renderSceneNode(node, {
            previewFontOverride,
            transparentBackground,
            interactive,
            onNodePointerDown,
            onNodeDoubleClick,
            onNodeContextMenu,
          })
        )}
      </>
    );
  }
);

SvgSceneContent.displayName = 'SvgSceneContent';
