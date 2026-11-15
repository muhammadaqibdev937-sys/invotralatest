import React from 'react';
import {
  buildTransformString,
  parseInlineStyleMap,
  SvgSceneDocument,
  SvgSceneNode,
  SvgStaticNode,
} from '../../engine/svgScene';
import {
  getUploadedFontEngineEntry,
  isFontAvailableInBrowser,
  resolveFontFamily,
} from '../../engine/fonts';
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
  gradientunits: 'gradientUnits',
  'gradient-transform': 'gradientTransform',
  gradienttransform: 'gradientTransform',
  'spread-method': 'spreadMethod',
  spreadmethod: 'spreadMethod',
  'pattern-units': 'patternUnits',
  patternunits: 'patternUnits',
  'pattern-transform': 'patternTransform',
  patterntransform: 'patternTransform',
  'pattern-content-units': 'patternContentUnits',
  patterncontentunits: 'patternContentUnits',
  'clip-path-units': 'clipPathUnits',
  clippathunits: 'clipPathUnits',
  'mask-units': 'maskUnits',
  maskunits: 'maskUnits',
  'mask-content-units': 'maskContentUnits',
  maskcontentunits: 'maskContentUnits',
  'marker-start': 'markerStart',
  'marker-mid': 'markerMid',
  'marker-end': 'markerEnd',
  'marker-width': 'markerWidth',
  markerwidth: 'markerWidth',
  'marker-height': 'markerHeight',
  markerheight: 'markerHeight',
  'marker-units': 'markerUnits',
  markerunits: 'markerUnits',
  'ref-x': 'refX',
  refx: 'refX',
  'ref-y': 'refY',
  refy: 'refY',
  'preserve-aspect-ratio': 'preserveAspectRatio',
  preserveaspectratio: 'preserveAspectRatio',
  viewbox: 'viewBox',
  'vector-effect': 'vectorEffect',
  'shape-rendering': 'shapeRendering',
  'color-interpolation': 'colorInterpolation',
  'color-interpolation-filters': 'colorInterpolationFilters',
  colorinterpolationfilters: 'colorInterpolationFilters',
  'flood-color': 'floodColor',
  floodcolor: 'floodColor',
  'flood-opacity': 'floodOpacity',
  floodopacity: 'floodOpacity',
  'lighting-color': 'lightingColor',
  lightingcolor: 'lightingColor',
  'std-deviation': 'stdDeviation',
  stddeviation: 'stdDeviation',
  'base-frequency': 'baseFrequency',
  basefrequency: 'baseFrequency',
  'num-octaves': 'numOctaves',
  numoctaves: 'numOctaves',
  'x-channel-selector': 'xChannelSelector',
  xchannelselector: 'xChannelSelector',
  'y-channel-selector': 'yChannelSelector',
  ychannelselector: 'yChannelSelector',
  'filter-units': 'filterUnits',
  filterunits: 'filterUnits',
  'primitive-units': 'primitiveUnits',
  primitiveunits: 'primitiveUnits',
  'stitch-tiles': 'stitchTiles',
  stitchtiles: 'stitchTiles',
  'edge-mode': 'edgeMode',
  edgemode: 'edgeMode',
  surfacescale: 'surfaceScale',
  specularconstant: 'specularConstant',
  specularexponent: 'specularExponent',
  diffuseconstant: 'diffuseConstant',
  kernelmatrix: 'kernelMatrix',
  tablevalues: 'tableValues',
  'start-offset': 'startOffset',
  startoffset: 'startOffset',
  'text-length': 'textLength',
  textlength: 'textLength',
  'length-adjust': 'lengthAdjust',
  lengthadjust: 'lengthAdjust',
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

export function getCssFontFallback(rawFamily: string): string {
  const first = rawFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  const def = getFontDefinition(first);
  if (def) {
    const fallback =
      def.category === 'Script' ? 'cursive' : def.category === 'Sans' ? 'sans-serif' : 'serif';
    return `"${def.family}", ${fallback}`;
  }
  const uploaded = getUploadedFontEngineEntry(first);
  if (uploaded) {
    const fallback =
      uploaded.category === 'Script'
        ? 'cursive'
        : uploaded.category === 'Sans'
        ? 'sans-serif'
        : 'serif';
    return `"${uploaded.family}", ${fallback}`;
  }
  const resolved = resolveFontFamily(rawFamily);
  const bundledDef = getFontDefinition(resolved.resolvedFamily);
  const fallback =
    bundledDef?.category === 'Script'
      ? 'cursive'
      : bundledDef?.category === 'Sans'
      ? 'sans-serif'
      : 'serif';
  if (!first) {
    return `"${resolved.resolvedFamily}", ${fallback}`;
  }
  const browserHasOriginal = isFontAvailableInBrowser(first);
  return browserHasOriginal
    ? `"${first}", "${resolved.resolvedFamily}", ${fallback}`
    : `"${resolved.resolvedFamily}", "${first}", ${fallback}`;
}

export function svgAttrsToReactProps(
  attrs: Record<string, string>,
  options?: { keepTransform?: boolean; fontPreviewFamily?: string }
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const attrStyleFallback: Record<string, string> = {};

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

    if (lower === 'mix-blend-mode') {
      attrStyleFallback.mixBlendMode = rawVal;
      continue;
    }

    if (lower === 'isolation') {
      attrStyleFallback.isolation = rawVal;
      continue;
    }

    const reactKey = SVG_ATTR_TO_REACT[lower] || rawKey;
    if (reactKey === 'fontFamily') {
      props[reactKey] = getCssFontFallback(rawVal);
    } else {
      props[reactKey] = rawVal;
    }
  }

  if (Object.keys(attrStyleFallback).length > 0) {
    props.style = {
      ...attrStyleFallback,
      ...((props.style as Record<string, string>) || {}),
    };
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
  editingNodeId?: string | null;
  transparentBackground?: boolean;
  onNodePointerDown?: (e: React.PointerEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeDoubleClick?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeContextMenu?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  interactive?: boolean;
}

function nodeContainsId(node: SvgSceneNode, targetId: string | null | undefined): boolean {
  if (!targetId) return false;
  if (node.id === targetId) return true;
  if (!node.children || node.children.length === 0) return false;
  for (const child of node.children) {
    if (nodeContainsId(child, targetId)) return true;
  }
  return false;
}

function buildSceneNodeProps(
  node: SvgSceneNode,
  options: RenderSceneOptions,
  includeKey = true
): Record<string, unknown> {
  const isPreviewed = options.previewFontOverride?.nodeId === node.id;
  const previewFam = isPreviewed ? options.previewFontOverride?.fontFamily : undefined;

  const props = svgAttrsToReactProps(node.attrs, {
    fontPreviewFamily: previewFam,
  });

  if (includeKey) {
    props.key = node.id;
  }
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

  return props;
}

function renderTextChildren(
  node: SvgSceneNode,
  props: Record<string, unknown>,
  options: RenderSceneOptions
): React.ReactNode {
  const isPreviewed = options.previewFontOverride?.nodeId === node.id;
  const previewFam = isPreviewed ? options.previewFontOverride?.fontFamily : undefined;
  const isDirectEditing = options.editingNodeId === node.id && !node.textPath;
  props.xmlSpace = 'preserve';
  props.style = {
    ...((props.style as Record<string, string>) || {}),
    whiteSpace: 'pre',
    ...(isDirectEditing ? { opacity: '0', pointerEvents: 'none' } : {}),
  };
  if (node.textPath) {
    const tpProps = svgAttrsToReactProps(node.textPath.attrs, {
      fontPreviewFamily: previewFam,
    });
    tpProps.key = `${node.id}_tp`;
    const tpChildren =
      node.textPath.tspans && node.textPath.tspans.length > 0
        ? node.textPath.tspans.map((ts) => {
            const tsProps = svgAttrsToReactProps(ts.attrs, {
              fontPreviewFamily: previewFam,
            });
            tsProps.key = ts.id;
            return React.createElement('tspan', tsProps, ts.text || ' ');
          })
        : [node.textPath.textContent || ' '];
    const textPathEl = React.createElement('textPath', tpProps, ...tpChildren);
    return React.createElement('text', props, textPathEl);
  }
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

  const props = buildSceneNodeProps(node, options, true);

  if (node.tag === 'g') {
    const inlineDefs = (node.inlineDefs ?? []).map((defNode, idx) =>
      renderStaticSvgNode(defNode, `${node.id}_def_${idx}`)
    );
    const children = (node.children ?? []).map((child) => renderSceneNode(child, options));
    return React.createElement('g', props, ...inlineDefs, ...children);
  }

  if (node.tag === 'text') {
    return renderTextChildren(node, props, options);
  }

  return React.createElement(node.tag, props);
}

interface MemoSceneNodeProps {
  node: SvgSceneNode;
  transparentBackground: boolean;
  previewFontOverride: { nodeId: string; fontFamily: string } | null;
  editingNodeId: string | null;
  interactive: boolean;
  onNodePointerDown?: (e: React.PointerEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeDoubleClick?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
  onNodeContextMenu?: (e: React.MouseEvent<SVGElement>, node: SvgSceneNode) => void;
}

const MemoSceneNode: React.FC<MemoSceneNodeProps> = React.memo(
  ({
    node,
    transparentBackground,
    previewFontOverride,
    editingNodeId,
    interactive,
    onNodePointerDown,
    onNodeDoubleClick,
    onNodeContextMenu,
  }) => {
    if (!node.visible) return null;
    if (transparentBackground && node.isBackground) return null;

    if (node.tag === 'preserved' && node.staticNode) {
      return React.createElement(
        'g',
        {
          'data-scene-id': node.id,
          'data-scene-tag': 'preserved',
          style: { pointerEvents: 'none' },
        },
        renderStaticSvgNode(node.staticNode, `${node.id}_static`)
      );
    }

    const options: RenderSceneOptions = {
      previewFontOverride,
      editingNodeId,
      transparentBackground,
      interactive,
      onNodePointerDown,
      onNodeDoubleClick,
      onNodeContextMenu,
    };

    const props = buildSceneNodeProps(node, options, false);

    if (node.tag === 'g') {
      const inlineDefs = (node.inlineDefs ?? []).map((defNode, idx) =>
        renderStaticSvgNode(defNode, `${node.id}_def_${idx}`)
      );
      const children = (node.children ?? []).map((child) => (
        <MemoSceneNode
          key={child.id}
          node={child}
          transparentBackground={transparentBackground}
          previewFontOverride={previewFontOverride}
          editingNodeId={editingNodeId}
          interactive={interactive}
          onNodePointerDown={onNodePointerDown}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
        />
      ));
      return React.createElement('g', props, ...inlineDefs, ...children);
    }

    if (node.tag === 'text') {
      return renderTextChildren(node, props, options);
    }

    return React.createElement(node.tag, props);
  },
  (prev, next) => {
    if (prev.node !== next.node) return false;
    if (prev.transparentBackground !== next.transparentBackground) return false;
    if (prev.interactive !== next.interactive) return false;
    if (prev.onNodePointerDown !== next.onNodePointerDown) return false;
    if (prev.onNodeDoubleClick !== next.onNodeDoubleClick) return false;
    if (prev.onNodeContextMenu !== next.onNodeContextMenu) return false;

    if (prev.editingNodeId !== next.editingNodeId) {
      const prevHits = nodeContainsId(prev.node, prev.editingNodeId);
      const nextHits = nodeContainsId(next.node, next.editingNodeId);
      if (prevHits || nextHits) return false;
    }

    if (prev.previewFontOverride !== next.previewFontOverride) {
      const prevFamHits = nodeContainsId(prev.node, prev.previewFontOverride?.nodeId);
      const nextFamHits = nodeContainsId(next.node, next.previewFontOverride?.nodeId);
      if (
        prevFamHits ||
        nextFamHits ||
        (prev.previewFontOverride?.fontFamily !== next.previewFontOverride?.fontFamily &&
          (prevFamHits || nextFamHits))
      ) {
        return false;
      }
    }

    return true;
  }
);

MemoSceneNode.displayName = 'MemoSceneNode';

interface SvgSceneContentProps {
  scene: SvgSceneDocument;
  transparentBackground?: boolean;
  previewFontOverride?: { nodeId: string; fontFamily: string } | null;
  editingNodeId?: string | null;
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
    editingNodeId = null,
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

        {scene.nodes.map((node) => (
          <MemoSceneNode
            key={node.id}
            node={node}
            transparentBackground={transparentBackground}
            previewFontOverride={previewFontOverride}
            editingNodeId={editingNodeId}
            interactive={interactive}
            onNodePointerDown={onNodePointerDown}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
          />
        ))}
      </>
    );
  }
);

SvgSceneContent.displayName = 'SvgSceneContent';
