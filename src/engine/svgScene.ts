import { resolveFontFamily } from './fonts';
import { sanitizeSvgDocument } from './sanitizeSvg';

export type SvgSupportedTag =
  | 'g'
  | 'text'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polygon'
  | 'polyline'
  | 'path'
  | 'image'
  | 'use'
  | 'preserved';

export interface SvgStaticNode {
  tag: string;
  attrs: Record<string, string>;
  textContent?: string;
  children: SvgStaticNode[];
}

export interface SvgTspanNode {
  id: string;
  text: string;
  attrs: Record<string, string>;
}

export interface SvgTransformState {
  tx: number;
  ty: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  pivotX?: number;
  pivotY?: number;
  baseTransform?: string;
}

export interface SvgSceneNode {
  id: string;
  tag: SvgSupportedTag;
  rawTag?: string;
  label: string;
  visible: boolean;
  locked: boolean;
  attrs: Record<string, string>;
  children?: SvgSceneNode[];
  textContent?: string;
  tspans?: SvgTspanNode[];
  staticNode?: SvgStaticNode;
  transform: SvgTransformState;
  isBackground?: boolean;
  isAddedByUser?: boolean;
  isPreservedUnsupported?: boolean;
}

export interface SvgColorSwatch {
  id: string;
  label: string;
  color: string;
  usageCount: number;
  nodeIds: string[];
}

export interface SvgSceneDocument {
  title: string;
  viewBox: string;
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  widthAttr?: string;
  heightAttr?: string;
  preserveAspectRatio?: string;
  rootAttrs: Record<string, string>;
  defsNodes: SvgStaticNode[];
  cssRules: Record<string, Record<string, string>>;
  nodes: SvgSceneNode[];
  backgroundColor: string;
  hasExplicitBackground: boolean;
  warnings: string[];
}

const VISUAL_TAGS = new Set<string>([
  'g',
  'text',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polygon',
  'polyline',
  'path',
  'image',
  'use',
]);

const DEFS_CONTAINER_TAGS = new Set<string>([
  'defs',
  'style',
  'lineargradient',
  'radialgradient',
  'clippath',
  'mask',
  'pattern',
  'filter',
  'symbol',
  'marker',
  'title',
  'desc',
  'metadata',
]);

const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#F0F8FF',
  antiquewhite: '#FAEBD7',
  aqua: '#00FFFF',
  aquamarine: '#7FFFD4',
  azure: '#F0FFFF',
  beige: '#F5F5DC',
  bisque: '#FFE4C4',
  black: '#000000',
  blanchedalmond: '#FFEBCD',
  blue: '#0000FF',
  blueviolet: '#8A2BE2',
  brown: '#A52A2A',
  burlywood: '#DEB887',
  cadetblue: '#5F9EA0',
  chartreuse: '#7FFF00',
  chocolate: '#D2691E',
  coral: '#FF7F50',
  cornflowerblue: '#6495ED',
  cornsilk: '#FFF8DC',
  cream: '#FFFDD0',
  crimson: '#DC143C',
  cyan: '#00FFFF',
  darkblue: '#00008B',
  darkcyan: '#008B8B',
  darkgoldenrod: '#B8860B',
  darkgray: '#A9A9A9',
  darkgreen: '#006400',
  darkgrey: '#A9A9A9',
  darkkhaki: '#BDB76B',
  darkmagenta: '#8B008B',
  darkolivegreen: '#556B2F',
  darkorange: '#FF8C00',
  darkorchid: '#9932CC',
  darkred: '#8B0000',
  darksalmon: '#E9967A',
  darkseagreen: '#8FBC8F',
  darkslateblue: '#483D8B',
  darkslategray: '#2F4F4F',
  darkslategrey: '#2F4F4F',
  darkturquoise: '#00CED1',
  darkviolet: '#9400D3',
  deeppink: '#FF1493',
  deepskyblue: '#00BFFF',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1E90FF',
  firebrick: '#B22222',
  floralwhite: '#FFFAF0',
  forestgreen: '#228B22',
  fuchsia: '#FF00FF',
  gainsboro: '#DCDCDC',
  ghostwhite: '#F8F8FF',
  gold: '#FFD700',
  goldenrod: '#DAA520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#ADFF2F',
  grey: '#808080',
  honeydew: '#F0FFF0',
  hotpink: '#FF69B4',
  indianred: '#CD5C5C',
  indigo: '#4B0082',
  ivory: '#FFFFF0',
  khaki: '#F0E68C',
  lavender: '#E6E6FA',
  lavenderblush: '#FFF0F5',
  lawngreen: '#7CFC00',
  lemonchiffon: '#FFFACD',
  lightblue: '#ADD8E6',
  lightcoral: '#F08080',
  lightcyan: '#E0FFFF',
  lightgoldenrodyellow: '#FAFAD2',
  lightgray: '#D3D3D3',
  lightgreen: '#90EE90',
  lightgrey: '#D3D3D3',
  lightpink: '#FFB6C1',
  lightsalmon: '#FFA07A',
  lightseagreen: '#20B2AA',
  lightskyblue: '#87CEFA',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#B0C4DE',
  lightyellow: '#FFFFE0',
  lime: '#00FF00',
  limegreen: '#32CD32',
  linen: '#FAF0E6',
  magenta: '#FF00FF',
  maroon: '#800000',
  mediumaquamarine: '#66CDAA',
  mediumblue: '#0000CD',
  mediumorchid: '#BA55D3',
  mediumpurple: '#9370DB',
  mediumseagreen: '#3CB371',
  mediumslateblue: '#7B68EE',
  mediumspringgreen: '#00FA9A',
  mediumturquoise: '#48D1CC',
  mediumvioletred: '#C71585',
  midnightblue: '#191970',
  mintcream: '#F5FFFA',
  mistyrose: '#FFE4E1',
  moccasin: '#FFE4B5',
  navajowhite: '#FFDEAD',
  navy: '#000080',
  oldlace: '#FDF5E6',
  olive: '#808000',
  olivedrab: '#6B8E23',
  orange: '#FFA500',
  orangered: '#FF4500',
  orchid: '#DA70D6',
  palegoldenrod: '#EEE8AA',
  palegreen: '#98FB98',
  paleturquoise: '#AFEEEE',
  palevioletred: '#DB7093',
  papayawhip: '#FFEFD5',
  peachpuff: '#FFDAB9',
  peru: '#CD853F',
  pink: '#FFC0CB',
  plum: '#DDA0DD',
  powderblue: '#B0E0E6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#FF0000',
  rosybrown: '#BC8F8F',
  royalblue: '#4169E1',
  saddlebrown: '#8B4513',
  salmon: '#FA8072',
  sandybrown: '#F4A460',
  seagreen: '#2E8B57',
  seashell: '#FFF5EE',
  sienna: '#A0522D',
  silver: '#C0C0C0',
  skyblue: '#87CEEB',
  slateblue: '#6A5ACD',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#FFFAFA',
  springgreen: '#00FF7F',
  steelblue: '#4682B4',
  tan: '#D2B48C',
  teal: '#008080',
  thistle: '#D8BFD8',
  tomato: '#FF6347',
  turquoise: '#40E0D0',
  violet: '#EE82EE',
  wheat: '#F5DEB3',
  white: '#FFFFFF',
  whitesmoke: '#F5F5F5',
  yellow: '#FFFF00',
  yellowgreen: '#9ACD32',
};

export function createIdentityTransform(): SvgTransformState {
  return { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 };
}

export function generateUniqueNodeId(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function parseInlineStyleMap(styleStr: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!styleStr) return out;
  for (const part of styleStr.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

export function serializeInlineStyleMap(map: Record<string, string>): string {
  return Object.entries(map)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

function hslToHex(hDeg: number, sPct: number, lPct: number): string {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const s = Math.min(1, Math.max(0, sPct / 100));
  const l = Math.min(1, Math.max(0, lPct / 100));
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (c: number) => Math.round(Math.min(255, Math.max(0, c * 255))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function normalizeColorToHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s*!important\s*$/i, '').trim();
  const lower = trimmed.toLowerCase();
  if (
    !trimmed ||
    lower === 'none' ||
    lower === 'transparent' ||
    lower === 'currentcolor' ||
    lower === 'inherit' ||
    lower.startsWith('url(')
  ) {
    return null;
  }
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  if (/^#[0-9a-f]{4}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return `#${trimmed.slice(1, 7)}`.toUpperCase();

  // Support comma and space-separated rgb()/rgba() including percentage channels
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i
  );
  if (rgbMatch) {
    const parseChannel = (token: string) => {
      const val = token.endsWith('%')
        ? Math.round((parseFloat(token) / 100) * 255)
        : Math.round(parseFloat(token));
      return Math.min(255, Math.max(0, Number.isFinite(val) ? val : 0))
        .toString(16)
        .padStart(2, '0');
    };
    return `#${parseChannel(rgbMatch[1])}${parseChannel(rgbMatch[2])}${parseChannel(rgbMatch[3])}`.toUpperCase();
  }

  // Support hsl()/hsla()
  const hslMatch = trimmed.match(
    /^hsla?\(\s*([-\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i
  );
  if (hslMatch) {
    return hslToHex(
      parseFloat(hslMatch[1]) || 0,
      parseFloat(hslMatch[2]) || 0,
      parseFloat(hslMatch[3]) || 0
    );
  }

  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  return null;
}

function parseLengthToPx(raw: string | null | undefined, fallback: number): number {
  if (!raw) return fallback;
  const trimmed = raw.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (trimmed.endsWith('in')) return Math.round(num * 300);
  if (trimmed.endsWith('cm')) return Math.round((num / 2.54) * 300);
  if (trimmed.endsWith('mm')) return Math.round((num / 25.4) * 300);
  if (trimmed.endsWith('pt')) return Math.round((num / 72) * 300);
  return num;
}

function parseCssRulesFromSvg(svgRoot: SVGSVGElement): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  const styles = Array.from(svgRoot.querySelectorAll('style'));
  for (const styleEl of styles) {
    const css = (styleEl.textContent || '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@font-face\s*\{[^}]*\}/gi, '')
      .replace(/@keyframes\s+[^{]+\{[\s\S]*?\}\s*\}/gi, '');
    const blockRe = /([^{}]+)\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(css)) !== null) {
      const selectorText = m[1].trim();
      if (!selectorText || selectorText.startsWith('@')) continue;
      const selectors = selectorText.split(',').map((s) => s.trim());
      const props = parseInlineStyleMap(m[2]);
      for (const sel of selectors) {
        if (sel) {
          rules[sel] = { ...(rules[sel] || {}), ...props };
        }
      }
    }
  }
  return rules;
}

function parseTransformAttribute(raw: string | null | undefined): SvgTransformState {
  const identity = createIdentityTransform();
  if (!raw || !raw.trim()) return identity;
  let rest = raw.trim();

  let tx = 0;
  let ty = 0;
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;
  let pivotX: number | undefined;
  let pivotY: number | undefined;

  // 1. Check optional leading translate(tx[, ty]) that is NOT immediately followed by rotate/scale + inverse translate
  const pivotStartRe =
    /^translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)\s+(?=(?:rotate\(|scale\())/i;
  const leadTranslateRe = /^translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)\s*(.*)$/i;

  if (!pivotStartRe.test(rest)) {
    const leadM = rest.match(leadTranslateRe);
    if (leadM) {
      tx = parseFloat(leadM[1]) || 0;
      ty = parseFloat(leadM[2] ?? '0') || 0;
      rest = (leadM[3] || '').trim();
      if (!rest) {
        return { tx, ty, scaleX: 1, scaleY: 1, rotation: 0 };
      }
    }
  }

  // 2. Match pivoted rotate/scale group produced by buildTransformString:
  //    translate(px, py) [rotate(deg)] [scale(sx, sy)] translate(-px, -py) [tail]
  const pivotGroupRe =
    /^translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)\s*(?:rotate\(\s*([-\d.]+)\s*\)\s*)?(?:scale\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)\s*)?translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)(?:\s*(.*))?$/i;
  const pivotM = rest.match(pivotGroupRe);
  if (pivotM && (pivotM[3] !== undefined || pivotM[4] !== undefined)) {
    const px = parseFloat(pivotM[1]) || 0;
    const py = parseFloat(pivotM[2] ?? '0') || 0;
    const npx = parseFloat(pivotM[6]) || 0;
    const npy = parseFloat(pivotM[7] ?? '0') || 0;
    if (Math.abs(px + npx) < 0.5 && Math.abs(py + npy) < 0.5) {
      const sx = pivotM[4] !== undefined ? parseFloat(pivotM[4]) : 1;
      const sy = pivotM[5] !== undefined ? parseFloat(pivotM[5]) : sx;
      return {
        tx,
        ty,
        pivotX: px,
        pivotY: py,
        rotation: pivotM[3] !== undefined ? parseFloat(pivotM[3]) || 0 : 0,
        scaleX: Number.isFinite(sx) ? sx : 1,
        scaleY: Number.isFinite(sy) ? sy : 1,
        baseTransform: pivotM[8]?.trim() || undefined,
      };
    }
  }

  // 3. Match unpivoted rotate(deg [cx cy]) and/or scale(sx[, sy])
  const unpivotedRe =
    /^(?:rotate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+)[\s,]+([-\d.]+))?\s*\)\s*)?(?:scale\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)\s*)?(.*)$/i;
  const unpivM = rest.match(unpivotedRe);
  if (unpivM && (unpivM[1] !== undefined || unpivM[4] !== undefined)) {
    rotation = unpivM[1] !== undefined ? parseFloat(unpivM[1]) || 0 : 0;
    pivotX = unpivM[2] !== undefined ? parseFloat(unpivM[2]) : undefined;
    pivotY = unpivM[3] !== undefined ? parseFloat(unpivM[3]) : undefined;
    if (unpivM[4] !== undefined) {
      const sx = parseFloat(unpivM[4]);
      const sy = unpivM[5] !== undefined ? parseFloat(unpivM[5]) : sx;
      scaleX = Number.isFinite(sx) ? sx : 1;
      scaleY = Number.isFinite(sy) ? sy : 1;
    }
    const tail = unpivM[6]?.trim() || undefined;
    return {
      tx,
      ty,
      scaleX,
      scaleY,
      rotation,
      pivotX,
      pivotY,
      baseTransform: tail,
    };
  }

  return {
    tx,
    ty,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    baseTransform: rest || undefined,
  };
}

export function buildTransformString(t: SvgTransformState): string | undefined {
  const parts: string[] = [];
  const hasTranslate = Math.abs(t.tx) > 0.001 || Math.abs(t.ty) > 0.001;
  const hasRot = Math.abs(t.rotation) > 0.001;
  const hasScale = Math.abs(t.scaleX - 1) > 0.001 || Math.abs(t.scaleY - 1) > 0.001;

  if (hasTranslate) {
    parts.push(`translate(${round2(t.tx)} ${round2(t.ty)})`);
  }

  if (hasRot || hasScale) {
    const px = t.pivotX ?? 0;
    const py = t.pivotY ?? 0;
    if (Math.abs(px) > 0.001 || Math.abs(py) > 0.001) {
      parts.push(`translate(${round2(px)} ${round2(py)})`);
      if (hasRot) parts.push(`rotate(${round2(t.rotation)})`);
      if (hasScale) parts.push(`scale(${round2(t.scaleX)} ${round2(t.scaleY)})`);
      parts.push(`translate(${round2(-px)} ${round2(-py)})`);
    } else {
      if (hasRot) parts.push(`rotate(${round2(t.rotation)})`);
      if (hasScale) parts.push(`scale(${round2(t.scaleX)} ${round2(t.scaleY)})`);
    }
  }

  if (t.baseTransform?.trim()) {
    parts.push(t.baseTransform.trim());
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function humanizeId(raw: string): string {
  return raw
    .replace(/^(layer[-_]?|text[-_]?|field[-_]?)/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function defaultLabelForTag(tag: SvgSupportedTag): string {
  switch (tag) {
    case 'g':
      return 'Group';
    case 'text':
      return 'Text';
    case 'rect':
      return 'Rectangle';
    case 'circle':
      return 'Circle';
    case 'ellipse':
      return 'Ellipse';
    case 'line':
      return 'Line';
    case 'polygon':
      return 'Polygon';
    case 'polyline':
      return 'Polyline';
    case 'path':
      return 'Illustration Path';
    case 'image':
      return 'Embedded Image';
    case 'use':
      return 'Vector Symbol';
    case 'preserved':
      return 'Preserved Element';
  }
}

function isGenericId(rawId: string | null | undefined): boolean {
  if (!rawId) return true;
  return /^(rect|circle|ellipse|line|path|polygon|polyline|text|g|group|el|svg|layer|item)[-_]?\d+$/i.test(
    rawId.trim()
  );
}

function inferTextSemanticLabel(textSnippet: string, fontSize: number, rawId?: string | null): string {
  if (rawId && !isGenericId(rawId)) return humanizeId(rawId);
  const lower = textSnippet.toLowerCase();
  if (/\brsvp\b|reply|kindly respond|confirm/i.test(lower)) return 'RSVP Details';
  if (
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      lower
    ) ||
    /\d{1,2}(st|nd|rd|th)?,?\s+\d{4}/i.test(lower)
  ) {
    return 'Wedding Date';
  }
  if (/\b(street|avenue|road|blvd|garden|hall|manor|estate|hotel|chapel|church|venue|park|beach)\b/i.test(lower)) {
    return 'Venue';
  }
  if (/\b(wedding|celebration|save the date|invitation|cordially|together with)\b/i.test(lower)) {
    return 'Main Heading';
  }
  if (fontSize >= 56 && textSnippet.length > 0 && textSnippet.length <= 30) {
    return textSnippet;
  }
  if (textSnippet.length > 0) {
    return textSnippet.slice(0, 28);
  }
  return 'Text Layer';
}

function inferShapeSemanticLabel(
  svgTag: SvgSupportedTag,
  attrs: Record<string, string>,
  vbW: number,
  vbH: number,
  rawId?: string | null
): string {
  if (rawId && !isGenericId(rawId)) return humanizeId(rawId);
  if (svgTag === 'rect') {
    const w = parseFloat(attrs.width || '0') || 0;
    const h = parseFloat(attrs.height || '0') || 0;
    const hasNoFill = (attrs.fill || '').toLowerCase() === 'none';
    const hasStroke = Boolean(attrs.stroke && attrs.stroke.toLowerCase() !== 'none');
    if (w >= vbW * 0.72 && h >= vbH * 0.72 && hasNoFill && hasStroke) {
      return w >= vbW * 0.88 ? 'Outer Border' : 'Inner Frame';
    }
    if (h <= 10 && w >= vbW * 0.25) return 'Decorative Divider';
  }
  if (svgTag === 'line') {
    const x1 = parseFloat(attrs.x1 || '0') || 0;
    const x2 = parseFloat(attrs.x2 || '0') || 0;
    const y1 = parseFloat(attrs.y1 || '0') || 0;
    const y2 = parseFloat(attrs.y2 || '0') || 0;
    if (Math.abs(y1 - y2) <= 4 && Math.abs(x2 - x1) >= vbW * 0.2) {
      return 'Decorative Divider';
    }
  }
  if (svgTag === 'path') {
    const dLen = (attrs.d || '').length;
    if (dLen > 160) return 'Decorative Illustration';
  }
  return defaultLabelForTag(svgTag);
}

function extractElementAttrs(el: Element, excludeNames: Set<string>): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const lower = attr.name.toLowerCase();
    if (excludeNames.has(lower)) continue;
    // Skip internal ea metadata attributes from previous parses so re-uploads stay clean
    if (lower.startsWith('data-ea-')) continue;
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function convertDomToStaticNode(el: Element): SvgStaticNode {
  const tag = el.tagName;
  const attrs = extractElementAttrs(el, new Set());
  const children: SvgStaticNode[] = [];
  for (const child of Array.from(el.children)) {
    children.push(convertDomToStaticNode(child));
  }
  const textContent =
    children.length === 0 && el.textContent ? el.textContent : undefined;
  return { tag, attrs, textContent, children };
}

function getSimplePathBBox(d: string): { x: number; y: number; width: number; height: number } | null {
  // Fast lightweight parser for rectangular / polygon M/m/L/l/H/h/V/v/Z background paths
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens || tokens.length < 4) return null;
  let idx = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pointCount = 0;

  const record = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    pointCount++;
  };

  const readNum = (): number | null => {
    if (idx >= tokens.length || /^[a-zA-Z]$/.test(tokens[idx])) return null;
    const n = parseFloat(tokens[idx++]);
    return Number.isFinite(n) ? n : null;
  };

  while (idx < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[idx])) {
      cmd = tokens[idx++];
      if (cmd === 'Z' || cmd === 'z') {
        cx = sx;
        cy = sy;
        continue;
      }
      if (!/^[MmLlHhVv]$/.test(cmd)) {
        // Curved or complex path; skip simple rectangular bbox detection
        return null;
      }
    }

    if (cmd === 'M' || cmd === 'm') {
      const nx = readNum();
      const ny = readNum();
      if (nx === null || ny === null) return null;
      cx = cmd === 'm' ? cx + nx : nx;
      cy = cmd === 'm' ? cy + ny : ny;
      sx = cx;
      sy = cy;
      record(cx, cy);
      cmd = cmd === 'm' ? 'l' : 'L';
    } else if (cmd === 'L' || cmd === 'l') {
      const nx = readNum();
      const ny = readNum();
      if (nx === null || ny === null) return null;
      cx = cmd === 'l' ? cx + nx : nx;
      cy = cmd === 'l' ? cy + ny : ny;
      record(cx, cy);
    } else if (cmd === 'H' || cmd === 'h') {
      const nx = readNum();
      if (nx === null) return null;
      cx = cmd === 'h' ? cx + nx : nx;
      record(cx, cy);
    } else if (cmd === 'V' || cmd === 'v') {
      const ny = readNum();
      if (ny === null) return null;
      cy = cmd === 'v' ? cy + ny : ny;
      record(cx, cy);
    } else {
      return null;
    }
  }

  if (pointCount < 3 || !Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getPolygonBBox(pointsRaw: string): { x: number; y: number; width: number; height: number } | null {
  const nums = pointsRaw
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (nums.length < 6) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function isFullBleedBackdropElement(
  el: Element,
  vbX: number,
  vbY: number,
  vbW: number,
  vbH: number
): boolean {
  const tag = el.tagName.toLowerCase();
  const idLower = (el.getAttribute('id') || '').toLowerCase();
  if (el.hasAttribute('data-background')) return true;

  let box: { x: number; y: number; width: number; height: number } | null = null;
  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0') || 0;
    const y = parseFloat(el.getAttribute('y') || '0') || 0;
    const wAttr = el.getAttribute('width') || '0';
    const hAttr = el.getAttribute('height') || '0';
    const w = wAttr.endsWith('%') ? (parseFloat(wAttr) / 100) * vbW : parseFloat(wAttr) || 0;
    const h = hAttr.endsWith('%') ? (parseFloat(hAttr) / 100) * vbH : parseFloat(hAttr) || 0;
    box = { x, y, width: w, height: h };
  } else if (tag === 'path') {
    box = getSimplePathBBox(el.getAttribute('d') || '');
  } else if (tag === 'polygon') {
    box = getPolygonBBox(el.getAttribute('points') || '');
  } else {
    return false;
  }

  if (!box || box.width <= 0 || box.height <= 0) return false;

  // Must cover the viewport area (also handles bleed rectangles extending outside vbX/vbY)
  const coversLeft = box.x <= vbX + vbW * 0.05;
  const coversTop = box.y <= vbY + vbH * 0.05;
  const coversRight = box.x + box.width >= vbX + vbW * 0.95;
  const coversBottom = box.y + box.height >= vbY + vbH * 0.95;

  if (coversLeft && coversTop && coversRight && coversBottom) return true;
  if (
    idLower === 'background' ||
    idLower === 'bg' ||
    idLower === 'canvas-background' ||
    idLower.endsWith('-bg') ||
    idLower.endsWith('_bg')
  ) {
    return box.width >= vbW * 0.85 && box.height >= vbH * 0.85;
  }
  return false;
}

function isNodeVisible(attrs: Record<string, string>): boolean {
  if (attrs.display === 'none' || attrs.visibility === 'hidden') return false;
  const style = parseInlineStyleMap(attrs.style);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

export function getEffectiveNodeProp(
  node: { attrs: Record<string, string>; tag?: string },
  prop: string,
  cssRules: Record<string, Record<string, string>> = {},
  ancestors: SvgSceneNode[] = []
): string | null {
  const inline = parseInlineStyleMap(node.attrs.style);
  if (inline[prop] !== undefined) return inline[prop];
  if (node.attrs[prop] !== undefined) return node.attrs[prop];

  // Check CSS classes & id
  const classList = (node.attrs.class || '').split(/\s+/).filter(Boolean);
  for (const cls of classList) {
    const rule = cssRules[`.${cls}`];
    if (rule && rule[prop] !== undefined) return rule[prop];
  }
  if (node.attrs.id && cssRules[`#${node.attrs.id}`]?.[prop] !== undefined) {
    return cssRules[`#${node.attrs.id}`][prop];
  }
  if (node.tag && cssRules[node.tag]?.[prop] !== undefined) {
    return cssRules[node.tag][prop];
  }

  // Inherit from parent <g> nodes (nearest first)
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = ancestors[i];
    const ancInline = parseInlineStyleMap(anc.attrs.style);
    if (ancInline[prop] !== undefined) return ancInline[prop];
    if (anc.attrs[prop] !== undefined) return anc.attrs[prop];
    const ancClasses = (anc.attrs.class || '').split(/\s+/).filter(Boolean);
    for (const cls of ancClasses) {
      if (cssRules[`.${cls}`]?.[prop] !== undefined) return cssRules[`.${cls}`][prop];
    }
    if (anc.attrs.id && cssRules[`#${anc.attrs.id}`]?.[prop] !== undefined) {
      return cssRules[`#${anc.attrs.id}`][prop];
    }
  }

  return null;
}

export function setNodeStyleProp(
  node: { attrs: Record<string, string> },
  prop: string,
  value: string | null,
  forceStyle = false
): Record<string, string> {
  const nextAttrs = { ...node.attrs };
  const styleMap = parseInlineStyleMap(nextAttrs.style);

  if (value === null) {
    delete nextAttrs[prop];
    delete styleMap[prop];
  } else {
    nextAttrs[prop] = value;
    // Update inline style too whenever class/id/inline-style exists or forceStyle is set so CSS rules never block edits
    if (forceStyle || nextAttrs.class || nextAttrs.id || styleMap[prop] !== undefined) {
      styleMap[prop] = value;
    }
  }

  const serializedStyle = serializeInlineStyleMap(styleMap);
  if (serializedStyle) {
    nextAttrs.style = serializedStyle;
  } else {
    delete nextAttrs.style;
  }
  return nextAttrs;
}

export function parseSvgToScene(rawSvg: string, fallbackName = 'Custom Design'): SvgSceneDocument {
  const sanitized = sanitizeSvgDocument(rawSvg);
  const svgRoot = sanitized.rootElement;
  const warnings = [...sanitized.securityFindings];

  const rawViewBox = svgRoot.getAttribute('viewBox')?.trim() || '';
  const vbParts = rawViewBox.split(/[\s,]+/).map(Number);
  const widthAttr = svgRoot.getAttribute('width')?.trim() || undefined;
  const heightAttr = svgRoot.getAttribute('height')?.trim() || undefined;
  const parsedW = parseLengthToPx(widthAttr, 1500);
  const parsedH = parseLengthToPx(heightAttr, 2100);

  const vbX = vbParts.length === 4 && Number.isFinite(vbParts[0]) ? vbParts[0] : 0;
  const vbY = vbParts.length === 4 && Number.isFinite(vbParts[1]) ? vbParts[1] : 0;
  const vbW =
    vbParts.length === 4 && Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : parsedW;
  const vbH =
    vbParts.length === 4 && Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : parsedH;
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  const cssRules = parseCssRulesFromSvg(svgRoot);
  const rootTitleEl = svgRoot.querySelector(':scope > title');
  const title =
    svgRoot.getAttribute('data-name')?.trim() ||
    rootTitleEl?.textContent?.trim() ||
    fallbackName;

  const rootAttrs = extractElementAttrs(
    svgRoot,
    new Set(['viewbox', 'width', 'height', 'preserveaspectratio', 'xmlns', 'xmlns:xlink'])
  );
  const preserveAspectRatio = svgRoot.getAttribute('preserveAspectRatio')?.trim() || undefined;

  // Check if <svg> root itself specifies a CSS background / background-color
  let rootStyleBg: string | null = null;
  if (rootAttrs.style) {
    const rootStyleMap = parseInlineStyleMap(rootAttrs.style);
    const rawRootBg = rootStyleMap['background-color'] || rootStyleMap.background;
    const hexRootBg = normalizeColorToHex(rawRootBg);
    if (hexRootBg) {
      rootStyleBg = hexRootBg;
    }
    delete rootStyleMap['background-color'];
    delete rootStyleMap.background;
    const cleanedRootStyle = serializeInlineStyleMap(rootStyleMap);
    if (cleanedRootStyle) rootAttrs.style = cleanedRootStyle;
    else delete rootAttrs.style;
  }

  const usedIds = new Set<string>();
  const allocId = (preferred: string | null | undefined, prefix: string): string => {
    const clean = preferred ? preferred.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const base = clean || prefix;
    let candidate = base;
    let i = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}_${i++}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const defsNodes: SvgStaticNode[] = [];
  const nodes: SvgSceneNode[] = [];
  let backgroundColor = rootStyleBg ?? '#FFFFFF';
  let hasExplicitBackground = false;
  let seenForegroundElement = false;
  let counters: Record<string, number> = {};

  const nextCounter = (tag: string) => {
    counters[tag] = (counters[tag] || 0) + 1;
    return counters[tag];
  };

  const parseVisualElement = (
    el: Element,
    isTopLevel: boolean,
    ancestorNodes: SvgSceneNode[] = []
  ): SvgSceneNode[] => {
    const tag = el.tagName.toLowerCase();

    // Unwrap <a> wrapper elements safely so inner SVG shapes/text remain editable
    if (tag === 'a') {
      const unwrapped: SvgSceneNode[] = [];
      for (const child of Array.from(el.children)) {
        unwrapped.push(...parseVisualElement(child, isTopLevel, ancestorNodes));
      }
      return unwrapped;
    }

    if (DEFS_CONTAINER_TAGS.has(tag)) {
      if (isTopLevel) {
        defsNodes.push(convertDomToStaticNode(el));
      }
      return [];
    }

    if (!VISUAL_TAGS.has(tag)) {
      const staticEl = convertDomToStaticNode(el);
      const rawId = el.getAttribute('id')?.trim();
      const id = allocId(rawId, `preserved_${nextCounter('preserved')}`);
      warnings.push(`Preserved unsupported <${tag}> element in read-only mode.`);
      seenForegroundElement = true;
      return [
        {
          id,
          tag: 'preserved',
          rawTag: tag,
          label: rawId ? `${humanizeId(rawId)} (<${tag}>)` : `<${tag}> (Preserved)`,
          visible: true,
          locked: true,
          attrs: extractElementAttrs(el, new Set()),
          staticNode: staticEl,
          transform: createIdentityTransform(),
          isPreservedUnsupported: true,
        },
      ];
    }

    const svgTag = tag as SvgSupportedTag;
    const rawId = el.getAttribute('id')?.trim();
    const id = allocId(rawId, `${svgTag}_${nextCounter(svgTag)}`);

    const attrs = extractElementAttrs(el, new Set(['transform', 'data-locked']));
    const visible = isNodeVisible(attrs);
    // Clean display/visibility off attrs when tracked via node.visible
    if (!visible) {
      delete attrs.display;
      delete attrs.visibility;
      const st = parseInlineStyleMap(attrs.style);
      delete st.display;
      delete st.visibility;
      const nextSt = serializeInlineStyleMap(st);
      if (nextSt) attrs.style = nextSt;
      else delete attrs.style;
    }

    const locked = el.getAttribute('data-locked') === 'true';
    const transform = parseTransformAttribute(el.getAttribute('transform'));

    // Determine human-friendly label
    const childTitle = Array.from(el.children)
      .find((c) => c.tagName.toLowerCase() === 'title')
      ?.textContent?.trim();
    const explicitLabel =
      el.getAttribute('data-label')?.trim() ||
      el.getAttribute('inkscape:label')?.trim() ||
      childTitle;

    let isBackground = false;
    const canDetectBackground =
      !hasExplicitBackground &&
      (isTopLevel || !seenForegroundElement) &&
      visible &&
      isFullBleedBackdropElement(el, vbX, vbY, vbW, vbH);

    if (canDetectBackground) {
      const rawBgFill = getEffectiveNodeProp({ attrs, tag: svgTag }, 'fill', cssRules, ancestorNodes);
      const rawFillOpacity = getEffectiveNodeProp(
        { attrs, tag: svgTag },
        'fill-opacity',
        cssRules,
        ancestorNodes
      );
      const isTransparentFill =
        rawBgFill?.trim().toLowerCase() === 'none' ||
        rawBgFill?.trim().toLowerCase() === 'transparent' ||
        rawFillOpacity?.trim() === '0';

      if (!isTransparentFill) {
        const bgFill = normalizeColorToHex(rawBgFill);
        if (bgFill) {
          backgroundColor = bgFill;
          hasExplicitBackground = true;
          isBackground = true;
        } else if (rawBgFill && /^url\(#/i.test(rawBgFill.trim())) {
          hasExplicitBackground = true;
          isBackground = true;
        } else if (rawBgFill === null) {
          // SVG shapes with omitted fill render solid black (#000000)
          backgroundColor = '#000000';
          hasExplicitBackground = true;
          isBackground = true;
        }
      }
    }

    if (svgTag === 'g') {
      const groupStub: SvgSceneNode = {
        id,
        tag: 'g',
        label: rawId || 'Group',
        visible,
        locked,
        attrs,
        transform,
      };
      const children: SvgSceneNode[] = [];
      for (const child of Array.from(el.children)) {
        children.push(...parseVisualElement(child, false, [...ancestorNodes, groupStub]));
      }
      let inferredGroupLabel = '';
      if (!explicitLabel && isGenericId(rawId)) {
        const textCountInGroup = children.filter((c) => c.tag === 'text').length;
        const pathCountInGroup = children.filter((c) => c.tag === 'path' || c.tag === 'circle' || c.tag === 'ellipse').length;
        if (textCountInGroup === 0 && pathCountInGroup >= 3) {
          inferredGroupLabel = 'Floral & Illustration Group';
        } else if (textCountInGroup === 0 && pathCountInGroup > 0) {
          inferredGroupLabel = 'Vector Icon / Decoration';
        }
      }
      const label =
        explicitLabel ||
        (rawId && !isGenericId(rawId) ? humanizeId(rawId) : '') ||
        inferredGroupLabel ||
        `Group ${nextCounter('group_lbl')}`;
      return [
        {
          id,
          tag: 'g',
          label,
          visible,
          locked,
          attrs,
          children,
          transform,
        },
      ];
    }

    if (svgTag === 'text') {
      const tspans: SvgTspanNode[] = [];
      let directText = '';

      // Walk childNodes in document order to preserve tspans and direct text
      const childNodes = Array.from(el.childNodes);
      const hasTspanChild = childNodes.some(
        (n) => n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName.toLowerCase() === 'tspan'
      );

      if (hasTspanChild) {
        childNodes.forEach((child, idx) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const childEl = child as Element;
            const cTag = childEl.tagName.toLowerCase();
            if (cTag === 'tspan') {
              const tAttrs = extractElementAttrs(childEl, new Set());
              tspans.push({
                id: `${id}_ts_${idx}`,
                text: childEl.textContent ?? '',
                attrs: tAttrs,
              });
            } else if (cTag === 'textpath') {
              tspans.push({
                id: `${id}_ts_${idx}`,
                text: childEl.textContent ?? '',
                attrs: {},
              });
            }
          } else if (child.nodeType === Node.TEXT_NODE) {
            const txt = (child.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (txt) {
              tspans.push({
                id: `${id}_ts_${idx}`,
                text: txt,
                attrs: {},
              });
            }
          }
        });
      } else {
        const rawTextParts: string[] = [];
        for (const child of childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            rawTextParts.push(child.textContent ?? '');
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const cTag = (child as Element).tagName.toLowerCase();
            if (cTag !== 'title' && cTag !== 'desc' && cTag !== 'metadata') {
              rawTextParts.push(child.textContent ?? '');
            }
          }
        }
        const joined = rawTextParts.join('');
        directText =
          attrs['xml:space'] === 'preserve'
            ? joined
            : joined.replace(/\s+/g, ' ').trim();
      }

      const fullSnippet = (
        hasTspanChild ? tspans.map((t) => t.text).join(' ') : directText
      )
        .replace(/\s+/g, ' ')
        .trim();

      const rawSizeNum = parseFloat((attrs['font-size'] || '36').replace(/px|pt|em/gi, '')) || 36;
      const label =
        explicitLabel || inferTextSemanticLabel(fullSnippet, rawSizeNum, rawId);

      return [
        {
          id,
          tag: 'text',
          label,
          visible,
          locked,
          attrs,
          tspans: hasTspanChild ? tspans : undefined,
          textContent: hasTspanChild ? undefined : directText,
          transform,
        },
      ];
    }

    if (!isBackground) {
      seenForegroundElement = true;
    }

    const label =
      explicitLabel ||
      (isBackground ? 'Background' : '') ||
      inferShapeSemanticLabel(svgTag, attrs, vbW, vbH, rawId);

    return [
      {
        id,
        tag: svgTag,
        label,
        visible,
        locked,
        attrs,
        transform,
        isBackground: isBackground || undefined,
      },
    ];
  };

  for (const child of Array.from(svgRoot.children)) {
    nodes.push(...parseVisualElement(child, true));
  }

  return {
    title,
    viewBox,
    vbX,
    vbY,
    vbW,
    vbH,
    widthAttr,
    heightAttr,
    preserveAspectRatio,
    rootAttrs,
    defsNodes,
    cssRules,
    nodes,
    backgroundColor,
    hasExplicitBackground,
    warnings,
  };
}

// ─── Tree Inspection & Query Helpers ───

export function collectAllNodes(nodes: SvgSceneNode[]): SvgSceneNode[] {
  const result: SvgSceneNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...collectAllNodes(node.children));
    }
  }
  return result;
}

export function collectTextNodesWithAncestors(
  nodes: SvgSceneNode[],
  ancestors: SvgSceneNode[] = []
): Array<{ node: SvgSceneNode; ancestors: SvgSceneNode[] }> {
  const result: Array<{ node: SvgSceneNode; ancestors: SvgSceneNode[] }> = [];
  for (const node of nodes) {
    if (node.tag === 'text') {
      result.push({ node, ancestors });
    }
    if (node.children) {
      result.push(...collectTextNodesWithAncestors(node.children, [...ancestors, node]));
    }
  }
  return result;
}

export function findNodeWithAncestors(
  nodes: SvgSceneNode[],
  targetId: string,
  ancestors: SvgSceneNode[] = []
): { node: SvgSceneNode; ancestors: SvgSceneNode[]; parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === targetId) {
      return {
        node,
        ancestors,
        parentId: ancestors.length > 0 ? ancestors[ancestors.length - 1].id : null,
        index: i,
      };
    }
    if (node.children) {
      const found = findNodeWithAncestors(node.children, targetId, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
}

export function getTextNodeProperties(
  node: SvgSceneNode,
  cssRules: Record<string, Record<string, string>> = {},
  ancestors: SvgSceneNode[] = []
): {
  fullText: string;
  lines: string[];
  hasMultipleTspans: boolean;
  fontFamily: string;
  originalFontFamily: string;
  isFontFallback: boolean;
  fallbackPreviewFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  color: string;
  opacity: number;
  textAnchor: 'start' | 'middle' | 'end';
  letterSpacing: number;
  lineHeight: number;
  x: number;
  y: number;
} {
  const tspans = node.tspans ?? [];
  const firstTspan = tspans[0];

  const lines =
    tspans.length > 0
      ? tspans.map((t) => t.text)
      : [node.textContent ?? ''];
  const fullText = lines.join('\n');

  const resolveTextProp = (prop: string): string | null => {
    const onText = getEffectiveNodeProp(node, prop, cssRules, ancestors);
    if (onText) return onText;
    if (firstTspan) {
      const onSpan = getEffectiveNodeProp(
        { attrs: firstTspan.attrs, tag: 'tspan' },
        prop,
        cssRules,
        [...ancestors, node]
      );
      if (onSpan) return onSpan;
    }
    return null;
  };

  const rawFont = resolveTextProp('font-family');
  const resolvedFont = resolveFontFamily(rawFont);
  const originalFontFamily = rawFont
    ? rawFont.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    : resolvedFont.resolvedFamily;

  const rawSize = resolveTextProp('font-size');
  const parsedSize = rawSize ? parseFloat(rawSize.replace(/px|pt|em/gi, '')) : NaN;
  const fontSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 36;

  const rawWeight = (resolveTextProp('font-weight') || '400').trim().toLowerCase();
  const fontWeight = rawWeight === 'bold' ? '700' : rawWeight === 'normal' ? '400' : rawWeight;

  const rawStyle = (resolveTextProp('font-style') || 'normal').trim().toLowerCase();
  const fontStyle: 'normal' | 'italic' = rawStyle === 'italic' ? 'italic' : 'normal';

  const rawDecor = (resolveTextProp('text-decoration') || 'none').trim().toLowerCase();
  const textDecoration: 'none' | 'underline' | 'line-through' = rawDecor.includes('underline')
    ? 'underline'
    : rawDecor.includes('line-through')
    ? 'line-through'
    : 'none';

  const color = normalizeColorToHex(resolveTextProp('fill')) ?? '#28251F';

  const rawOpacity = parseFloat(resolveTextProp('opacity') || '1');
  const opacity = Number.isFinite(rawOpacity) ? Math.min(1, Math.max(0, rawOpacity)) : 1;

  const anchorRaw = (resolveTextProp('text-anchor') || 'start').trim().toLowerCase();
  const textAnchor: 'start' | 'middle' | 'end' =
    anchorRaw === 'middle' || anchorRaw === 'end' ? anchorRaw : 'start';

  const rawSpacing = resolveTextProp('letter-spacing');
  const parsedSpacing = rawSpacing ? parseFloat(rawSpacing.replace(/px|em/gi, '')) : NaN;
  const letterSpacing = Number.isFinite(parsedSpacing) ? parsedSpacing : 0;

  let lineHeight = 1.3;
  if (tspans.length >= 2) {
    const dy1 = parseFloat(tspans[1].attrs.dy || '');
    const y0 = parseFloat(tspans[0].attrs.y || '');
    const y1 = parseFloat(tspans[1].attrs.y || '');
    const delta =
      Number.isFinite(dy1) && dy1 > 0
        ? dy1
        : Number.isFinite(y1 - y0) && y1 > y0
        ? y1 - y0
        : NaN;
    if (Number.isFinite(delta) && delta > 0) {
      lineHeight = Math.round(Math.min(2.6, Math.max(0.9, delta / fontSize)) * 100) / 100;
    }
  }

  const x = parseFloat(node.attrs.x ?? firstTspan?.attrs.x ?? '0') || 0;
  const y = parseFloat(node.attrs.y ?? firstTspan?.attrs.y ?? '0') || 0;

  return {
    fullText,
    lines,
    hasMultipleTspans: tspans.length > 1,
    fontFamily: resolvedFont.wasFallback ? originalFontFamily : resolvedFont.resolvedFamily,
    originalFontFamily,
    isFontFallback: Boolean(rawFont) && resolvedFont.wasFallback,
    fallbackPreviewFamily: resolvedFont.resolvedFamily,
    fontSize,
    fontWeight,
    fontStyle,
    textDecoration,
    color,
    opacity,
    textAnchor,
    letterSpacing,
    lineHeight,
    x,
    y,
  };
}

export interface TextEditPatch {
  text?: string;
  tspanIndex?: number;
  tspanText?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  color?: string;
  opacity?: number;
  textAnchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
  lineHeight?: number;
}

export function applyTextEditToNode(
  node: SvgSceneNode,
  patch: TextEditPatch,
  cssRules: Record<string, Record<string, string>> = {},
  ancestors: SvgSceneNode[] = []
): SvgSceneNode {
  if (node.tag !== 'text') return node;
  let nextAttrs = { ...node.attrs };
  let nextTspans = node.tspans ? node.tspans.map((t) => ({ ...t, attrs: { ...t.attrs } })) : undefined;
  let nextTextContent = node.textContent;
  const props = getTextNodeProperties(node, cssRules, ancestors);

  // Edit single tspan text directly
  if (patch.tspanIndex !== undefined && patch.tspanText !== undefined && nextTspans?.[patch.tspanIndex]) {
    nextTspans[patch.tspanIndex].text = patch.tspanText;
  }

  // Edit full text (preserving existing tspans & positions/styles line-by-line)
  if (patch.text !== undefined) {
    const newLines = patch.text.split('\n');
    const step = round2(props.fontSize * props.lineHeight);
    const baseX = nextAttrs.x ?? nextTspans?.[0]?.attrs.x ?? '0';

    if (nextTspans && nextTspans.length > 0) {
      const updated: SvgTspanNode[] = [];
      const count = Math.max(1, newLines.length);
      for (let i = 0; i < count; i++) {
        const lineText = newLines[i] ?? '';
        if (i < nextTspans.length) {
          updated.push({ ...nextTspans[i], text: lineText });
        } else {
          const templateSpan = nextTspans[nextTspans.length - 1];
          const clonedAttrs = { ...templateSpan.attrs };
          if (!clonedAttrs.x) clonedAttrs.x = baseX;
          delete clonedAttrs.y;
          clonedAttrs.dy = String(step);
          updated.push({
            id: `${node.id}_ts_${Date.now().toString(36)}_${i}`,
            text: lineText,
            attrs: clonedAttrs,
          });
        }
      }
      nextTspans = updated;
    } else if (newLines.length > 1) {
      nextTextContent = undefined;
      nextTspans = newLines.map((lineText, idx) => ({
        id: `${node.id}_ts_${idx}`,
        text: lineText,
        attrs: {
          x: baseX,
          dy: idx === 0 ? '0' : String(step),
        },
      }));
    } else {
      nextTextContent = patch.text;
    }
  }

  const hasCss = Object.keys(cssRules).length > 0;
  const syncTspanStyleProp = (prop: string, val: string | null) => {
    if (!nextTspans) return;
    nextTspans = nextTspans.map((t) => {
      const tStyle = parseInlineStyleMap(t.attrs.style);
      if (t.attrs[prop] !== undefined || tStyle[prop] !== undefined || t.attrs.class || t.attrs.id) {
        return { ...t, attrs: setNodeStyleProp({ attrs: t.attrs }, prop, val, hasCss) };
      }
      return t;
    });
  };

  if (patch.fontFamily !== undefined) {
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'font-family', patch.fontFamily, hasCss);
    syncTspanStyleProp('font-family', patch.fontFamily);
  }
  if (patch.fontSize !== undefined) {
    const val = String(round2(patch.fontSize));
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'font-size', val, hasCss);
    syncTspanStyleProp('font-size', val);
  }
  if (patch.fontWeight !== undefined) {
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'font-weight', patch.fontWeight, hasCss);
    syncTspanStyleProp('font-weight', patch.fontWeight);
  }
  if (patch.fontStyle !== undefined) {
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'font-style', patch.fontStyle, hasCss);
    syncTspanStyleProp('font-style', patch.fontStyle);
  }
  if (patch.textDecoration !== undefined) {
    const decVal = patch.textDecoration === 'none' ? null : patch.textDecoration;
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'text-decoration', decVal, hasCss);
    syncTspanStyleProp('text-decoration', decVal);
  }
  if (patch.color !== undefined) {
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'fill', patch.color, hasCss);
    syncTspanStyleProp('fill', patch.color);
  }
  if (patch.opacity !== undefined) {
    const clamped = Math.min(1, Math.max(0, round2(patch.opacity)));
    nextAttrs = setNodeStyleProp(
      { attrs: nextAttrs },
      'opacity',
      clamped === 1 ? null : String(clamped),
      hasCss
    );
  }
  if (patch.textAnchor !== undefined) {
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'text-anchor', patch.textAnchor, hasCss);
    syncTspanStyleProp('text-anchor', patch.textAnchor);
  }
  if (patch.letterSpacing !== undefined) {
    const val = String(round2(patch.letterSpacing));
    nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'letter-spacing', val, hasCss);
    syncTspanStyleProp('letter-spacing', val);
  }
  if (patch.lineHeight !== undefined && nextTspans && nextTspans.length >= 2) {
    const effectiveFontSize = patch.fontSize ?? props.fontSize;
    const step = round2(effectiveFontSize * patch.lineHeight);
    const y0 = parseFloat(nextTspans[0].attrs.y || '');
    const usesAbsY = Number.isFinite(y0) && nextTspans.slice(1).every((t) => Number.isFinite(parseFloat(t.attrs.y || '')));
    nextTspans = nextTspans.map((t, idx) => {
      if (idx === 0) return t;
      const tAttrs = { ...t.attrs };
      if (usesAbsY) {
        tAttrs.y = String(round2(y0 + idx * step));
      } else {
        tAttrs.dy = String(step);
      }
      return { ...t, attrs: tAttrs };
    });
  }

  // Update friendly label if it was derived from text
  let nextLabel = node.label;
  if (patch.text !== undefined || patch.tspanText !== undefined) {
    const firstLine = (
      nextTspans ? nextTspans.map((t) => t.text).join(' ') : nextTextContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    if (!node.attrs['data-label'] && !node.attrs.id && firstLine) {
      nextLabel = firstLine.slice(0, 28);
    }
  }

  return {
    ...node,
    label: nextLabel,
    attrs: nextAttrs,
    tspans: nextTspans,
    textContent: nextTextContent,
  };
}

// ─── Tree Immutable Operations ───

export function updateNodeInTree(
  nodes: SvgSceneNode[],
  targetId: string,
  updater: (node: SvgSceneNode, ancestors: SvgSceneNode[]) => SvgSceneNode,
  ancestors: SvgSceneNode[] = []
): SvgSceneNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === targetId) {
      const updated = updater(node, ancestors);
      if (updated !== node) changed = true;
      return updated;
    }
    if (node.children) {
      const nextChildren = updateNodeInTree(
        node.children,
        targetId,
        updater,
        [...ancestors, node]
      );
      if (nextChildren !== node.children) {
        changed = true;
        return { ...node, children: nextChildren };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

function cloneNodeTree(node: SvgSceneNode, offsetStep: number, isRootClone: boolean): SvgSceneNode {
  const newId = generateUniqueNodeId(node.tag);
  const nextAttrs = { ...node.attrs };
  if (nextAttrs.id) {
    nextAttrs.id = newId;
  }
  return {
    ...node,
    id: newId,
    label: isRootClone ? `${node.label} Copy` : node.label,
    locked: false,
    attrs: nextAttrs,
    isBackground: false,
    transform: isRootClone
      ? {
          ...node.transform,
          tx: round2(node.transform.tx + offsetStep),
          ty: round2(node.transform.ty + offsetStep),
        }
      : { ...node.transform },
    tspans: node.tspans?.map((t, i) => ({
      ...t,
      id: `${newId}_ts_${i}`,
      attrs: { ...t.attrs },
    })),
    children: node.children?.map((c) => cloneNodeTree(c, 0, false)),
  };
}

export function duplicateNodesInTree(
  nodes: SvgSceneNode[],
  targetIds: Set<string>,
  offsetStep = 24
): { nodes: SvgSceneNode[]; createdIds: string[] } {
  const createdIds: string[] = [];

  const walk = (list: SvgSceneNode[]): SvgSceneNode[] => {
    const out: SvgSceneNode[] = [];
    for (const node of list) {
      out.push(
        node.children
          ? { ...node, children: walk(node.children) }
          : node
      );
      if (targetIds.has(node.id)) {
        const cloned = cloneNodeTree(node, offsetStep, true);
        createdIds.push(cloned.id);
        out.push(cloned);
      }
    }
    return out;
  };

  return { nodes: walk(nodes), createdIds };
}

export function deleteNodesInTree(
  nodes: SvgSceneNode[],
  targetIds: Set<string>
): SvgSceneNode[] {
  const walk = (list: SvgSceneNode[]): SvgSceneNode[] => {
    const out: SvgSceneNode[] = [];
    for (const node of list) {
      if (targetIds.has(node.id) && !node.locked) {
        continue;
      }
      if (node.children) {
        out.push({ ...node, children: walk(node.children) });
      } else {
        out.push(node);
      }
    }
    return out;
  };
  return walk(nodes);
}

export function reorderNodeInTree(
  nodes: SvgSceneNode[],
  targetId: string,
  direction: 'forward' | 'backward' | 'front' | 'back'
): SvgSceneNode[] {
  const reorderList = (list: SvgSceneNode[]): { next: SvgSceneNode[]; handled: boolean } => {
    const idx = list.findIndex((n) => n.id === targetId);
    if (idx !== -1) {
      const next = [...list];
      const [item] = next.splice(idx, 1);
      let targetIdx = idx;
      if (direction === 'forward') targetIdx = Math.min(list.length - 1, idx + 1);
      else if (direction === 'backward') targetIdx = Math.max(0, idx - 1);
      else if (direction === 'front') targetIdx = list.length - 1;
      else if (direction === 'back') targetIdx = 0;

      if (targetIdx === idx) return { next: list, handled: true };
      next.splice(targetIdx, 0, item);
      return { next, handled: true };
    }

    for (let i = 0; i < list.length; i++) {
      const child = list[i];
      if (child.children) {
        const res = reorderList(child.children);
        if (res.handled) {
          if (res.next === child.children) return { next: list, handled: true };
          const next = [...list];
          next[i] = { ...child, children: res.next };
          return { next, handled: true };
        }
      }
    }
    return { next: list, handled: false };
  };

  return reorderList(nodes).next;
}

export function canReorderNode(
  nodes: SvgSceneNode[],
  targetId: string,
  direction: 'forward' | 'backward'
): boolean {
  const info = findNodeWithAncestors(nodes, targetId);
  if (!info) return false;
  const siblings =
    info.ancestors.length > 0
      ? info.ancestors[info.ancestors.length - 1].children ?? []
      : nodes;
  if (direction === 'forward') return info.index < siblings.length - 1;
  return info.index > 0;
}

export function groupNodesInTree(
  nodes: SvgSceneNode[],
  targetIds: Set<string>
): { nodes: SvgSceneNode[]; groupId: string | null } {
  if (targetIds.size < 2) return { nodes, groupId: null };

  // Find first sibling list containing >= 2 targetIds (prefer deepest or same parent)
  let createdGroupId: string | null = null;

  const tryGroupInList = (list: SvgSceneNode[]): SvgSceneNode[] | null => {
    const indices: number[] = [];
    list.forEach((n, idx) => {
      if (targetIds.has(n.id) && !n.locked) indices.push(idx);
    });
    if (indices.length >= 2) {
      const insertAt = indices[0];
      const groupedChildren = indices.map((i) => list[i]);
      const groupId = generateUniqueNodeId('group');
      createdGroupId = groupId;
      const groupNode: SvgSceneNode = {
        id: groupId,
        tag: 'g',
        label: 'Group',
        visible: true,
        locked: false,
        attrs: { id: groupId },
        children: groupedChildren,
        transform: createIdentityTransform(),
      };
      const indexSet = new Set(indices);
      const next: SvgSceneNode[] = [];
      list.forEach((n, idx) => {
        if (idx === insertAt) next.push(groupNode);
        if (!indexSet.has(idx)) next.push(n);
      });
      return next;
    }

    for (let i = 0; i < list.length; i++) {
      const child = list[i];
      if (child.children) {
        const res = tryGroupInList(child.children);
        if (res) {
          const next = [...list];
          next[i] = { ...child, children: res };
          return next;
        }
      }
    }
    return null;
  };

  const grouped = tryGroupInList(nodes);
  if (grouped && createdGroupId) {
    return { nodes: grouped, groupId: createdGroupId };
  }

  // Fallback: if selected items are in different parents, collect them into a top-level group
  const collected: SvgSceneNode[] = [];
  const stripSelected = (list: SvgSceneNode[]): SvgSceneNode[] =>
    list.flatMap((n) => {
      if (targetIds.has(n.id) && !n.locked) {
        collected.push(n);
        return [];
      }
      if (n.children) {
        return [{ ...n, children: stripSelected(n.children) }];
      }
      return [n];
    });

  const stripped = stripSelected(nodes);
  if (collected.length < 2) return { nodes, groupId: null };
  const groupId = generateUniqueNodeId('group');
  const groupNode: SvgSceneNode = {
    id: groupId,
    tag: 'g',
    label: 'Group',
    visible: true,
    locked: false,
    attrs: { id: groupId },
    children: collected,
    transform: createIdentityTransform(),
  };
  return { nodes: [...stripped, groupNode], groupId };
}

export function ungroupNodeInTree(
  nodes: SvgSceneNode[],
  groupId: string
): { nodes: SvgSceneNode[]; childIds: string[] } {
  const childIds: string[] = [];

  const walk = (list: SvgSceneNode[]): SvgSceneNode[] => {
    const out: SvgSceneNode[] = [];
    for (const node of list) {
      if (node.id === groupId && node.tag === 'g' && !node.locked) {
        const groupTransformStr = buildTransformString(node.transform);
        for (const child of node.children ?? []) {
          childIds.push(child.id);
          // Compose parent group's transform onto each child so visual placement stays identical
          if (groupTransformStr) {
            const childStr = buildTransformString(child.transform);
            const combined = childStr ? `${groupTransformStr} ${childStr}` : groupTransformStr;
            out.push({
              ...child,
              transform: parseTransformAttribute(combined),
            });
          } else {
            out.push(child);
          }
        }
      } else if (node.children) {
        out.push({ ...node, children: walk(node.children) });
      } else {
        out.push(node);
      }
    }
    return out;
  };

  return { nodes: walk(nodes), childIds };
}

export function createNewTextNode(scene: SvgSceneDocument, initialText = 'Your Custom Text'): SvgSceneNode {
  const id = generateUniqueNodeId('text');
  const textNodes = collectTextNodesWithAncestors(scene.nodes);
  const sampleProps = textNodes[0]
    ? getTextNodeProperties(textNodes[0].node, scene.cssRules, textNodes[0].ancestors)
    : null;

  const fontSize = Math.max(24, Math.min(96, Math.round(scene.vbH * 0.036)));
  const x = Math.round(scene.vbX + scene.vbW / 2);
  const y = Math.round(scene.vbY + scene.vbH * 0.5);

  const bgHex = scene.backgroundColor.replace('#', '');
  const r = parseInt(bgHex.slice(0, 2), 16) || 255;
  const g = parseInt(bgHex.slice(2, 4), 16) || 255;
  const b = parseInt(bgHex.slice(4, 6), 16) || 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const defaultColor = sampleProps?.color || (lum < 0.45 ? '#FAF7F0' : '#28251F');
  const defaultFont = sampleProps?.fontFamily || 'Cormorant Garamond';

  return {
    id,
    tag: 'text',
    label: initialText.slice(0, 24),
    visible: true,
    locked: false,
    attrs: {
      id,
      x: String(x),
      y: String(y),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-family': defaultFont,
      'font-size': String(fontSize),
      'font-weight': '400',
      'font-style': 'normal',
      fill: defaultColor,
      'letter-spacing': '0',
    },
    textContent: initialText,
    transform: createIdentityTransform(),
    isAddedByUser: true,
  };
}

export interface SceneStats {
  totalElements: number;
  textCount: number;
  shapeCount: number;
  groupCount: number;
  imageCount: number;
}

export function getSceneStats(scene: SvgSceneDocument): SceneStats {
  const all = collectAllNodes(scene.nodes);
  let textCount = 0;
  let shapeCount = 0;
  let groupCount = 0;
  let imageCount = 0;

  for (const node of all) {
    if (node.tag === 'text') textCount++;
    else if (node.tag === 'g') groupCount++;
    else if (node.tag === 'image') imageCount++;
    else shapeCount++;
  }

  return {
    totalElements: all.length,
    textCount,
    shapeCount,
    groupCount,
    imageCount,
  };
}

export function findPrimaryBackgroundShapeWithAncestors(
  nodes: SvgSceneNode[],
  ancestors: SvgSceneNode[] = []
): { node: SvgSceneNode; ancestors: SvgSceneNode[] } | null {
  for (const node of nodes) {
    if (node.isBackground && node.tag !== 'image') {
      return { node, ancestors };
    }
    if (node.children) {
      const found = findPrimaryBackgroundShapeWithAncestors(node.children, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
}

export function hasBackgroundShapeNode(nodes: SvgSceneNode[]): boolean {
  return findPrimaryBackgroundShapeWithAncestors(nodes) !== null;
}

function updatePrimaryBackgroundShapesInTree(
  nodes: SvgSceneNode[],
  updater: (node: SvgSceneNode) => SvgSceneNode
): SvgSceneNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.isBackground && node.tag !== 'image') {
      const updated = updater(node);
      if (updated !== node) changed = true;
      return updated;
    }
    if (node.children) {
      const nextChildren = updatePrimaryBackgroundShapesInTree(node.children, updater);
      if (nextChildren !== node.children) {
        changed = true;
        return { ...node, children: nextChildren };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

export function updateSceneBackgroundColor(
  scene: SvgSceneDocument,
  hexColor: string
): SvgSceneDocument {
  const existingCfg = extractBackgroundConfig(scene);
  return applyBackgroundConfig(scene, {
    ...existingCfg,
    mode: 'solid',
    solidColor: hexColor,
  });
}

// ─── Advanced Background, Image, Layer Reorder & Clipboard Helpers ───

export interface BackgroundConfig {
  mode: 'solid' | 'linear' | 'radial';
  solidColor: string;
  gradStart: string;
  gradEnd: string;
  gradAngle: number;
  opacity: number;
}

const BG_GRADIENT_ID = 'ea-bg-gradient';

function findGradDefById(defsNodes: SvgStaticNode[], gradId: string): SvgStaticNode | null {
  for (const def of defsNodes) {
    const tag = def.tag.toLowerCase();
    if ((tag === 'lineargradient' || tag === 'radialgradient') && def.attrs.id === gradId) {
      return def;
    }
    if (def.children && def.children.length > 0) {
      const inner = findGradDefById(def.children, gradId);
      if (inner) return inner;
    }
  }
  return null;
}

function stripBgGradFromDefs(defsNodes: SvgStaticNode[]): SvgStaticNode[] {
  return defsNodes
    .filter((d) => d.attrs.id !== BG_GRADIENT_ID)
    .map((d) =>
      d.children && d.children.length > 0
        ? { ...d, children: stripBgGradFromDefs(d.children) }
        : d
    );
}

function extractStopColor(stop: SvgStaticNode | undefined): string | null {
  if (!stop) return null;
  const styleMap = parseInlineStyleMap(stop.attrs.style);
  return normalizeColorToHex(styleMap['stop-color'] || stop.attrs['stop-color']);
}

export function extractBackgroundConfig(scene: SvgSceneDocument): BackgroundConfig {
  const bgInfo = findPrimaryBackgroundShapeWithAncestors(scene.nodes);
  const bgNode = bgInfo?.node ?? null;
  const bgAncestors = bgInfo?.ancestors ?? [];

  const rawOpacity = bgNode
    ? parseFloat(getEffectiveNodeProp(bgNode, 'opacity', scene.cssRules, bgAncestors) || '1')
    : 1;
  const opacity = Number.isFinite(rawOpacity) ? Math.min(1, Math.max(0, rawOpacity)) : 1;

  const rawFill = bgNode
    ? getEffectiveNodeProp(bgNode, 'fill', scene.cssRules, bgAncestors)
    : null;
  const urlMatch = rawFill?.match(/url\(\s*['"]?#([^)'"]+)['"]?\s*\)/i);
  if (urlMatch) {
    const gradId = urlMatch[1];
    const grad = findGradDefById(scene.defsNodes, gradId);
    if (grad) {
      const stops = grad.children.filter((c) => c.tag.toLowerCase() === 'stop');
      const startColor = extractStopColor(stops[0]) ?? scene.backgroundColor;
      const endColor = extractStopColor(stops[stops.length - 1]) ?? '#EADCC6';
      const isRadial = grad.tag.toLowerCase() === 'radialgradient';
      const x1 = parseFloat(grad.attrs.x1 || '0') || 0;
      const y1 = parseFloat(grad.attrs.y1 || '0') || 0;
      const x2 = parseFloat(grad.attrs.x2 || '100') || 100;
      const y2 = parseFloat(grad.attrs.y2 || '100') || 100;
      const rad = Math.atan2(y2 - y1, x2 - x1);
      const gradAngle = Math.round(((rad * 180) / Math.PI + 360) % 360);
      return {
        mode: isRadial ? 'radial' : 'linear',
        solidColor: startColor,
        gradStart: startColor,
        gradEnd: endColor,
        gradAngle,
        opacity,
      };
    }
  }

  return {
    mode: 'solid',
    solidColor: scene.backgroundColor,
    gradStart: scene.backgroundColor,
    gradEnd: '#EADCC6',
    gradAngle: 135,
    opacity,
  };
}

export function applyBackgroundConfig(
  scene: SvgSceneDocument,
  cfg: BackgroundConfig
): SvgSceneDocument {
  let nextDefs = stripBgGradFromDefs(scene.defsNodes);
  const safeSolid = normalizeColorToHex(cfg.solidColor) ?? '#FFFFFF';
  const safeStart = normalizeColorToHex(cfg.gradStart) ?? safeSolid;
  const safeEnd = normalizeColorToHex(cfg.gradEnd) ?? '#EADCC6';
  let fillValue = safeSolid;

  if (cfg.mode !== 'solid') {
    fillValue = `url(#${BG_GRADIENT_ID})`;
    let gradNode: SvgStaticNode;
    if (cfg.mode === 'radial') {
      gradNode = {
        tag: 'radialGradient',
        attrs: { id: BG_GRADIENT_ID, cx: '50%', cy: '50%', r: '70%' },
        children: [
          { tag: 'stop', attrs: { offset: '0%', 'stop-color': safeStart }, children: [] },
          { tag: 'stop', attrs: { offset: '100%', 'stop-color': safeEnd }, children: [] },
        ],
      };
    } else {
      const rad = (cfg.gradAngle * Math.PI) / 180;
      const x1 = Math.round(50 - Math.cos(rad) * 50);
      const y1 = Math.round(50 - Math.sin(rad) * 50);
      const x2 = Math.round(50 + Math.cos(rad) * 50);
      const y2 = Math.round(50 + Math.sin(rad) * 50);
      gradNode = {
        tag: 'linearGradient',
        attrs: {
          id: BG_GRADIENT_ID,
          x1: `${x1}%`,
          y1: `${y1}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
        },
        children: [
          { tag: 'stop', attrs: { offset: '0%', 'stop-color': safeStart }, children: [] },
          { tag: 'stop', attrs: { offset: '100%', 'stop-color': safeEnd }, children: [] },
        ],
      };
    }
    const defsWrapperIdx = nextDefs.findIndex((d) => d.tag.toLowerCase() === 'defs');
    if (defsWrapperIdx >= 0) {
      nextDefs = nextDefs.map((d, i) =>
        i === defsWrapperIdx ? { ...d, children: [...d.children, gradNode] } : d
      );
    } else {
      nextDefs = [{ tag: 'defs', attrs: {}, children: [gradNode] }, ...nextDefs];
    }
  }

  const hasCss = Object.keys(scene.cssRules).length > 0;
  const existingBg = findPrimaryBackgroundShapeWithAncestors(scene.nodes)?.node;
  let nextNodes: SvgSceneNode[];
  if (existingBg) {
    nextNodes = updatePrimaryBackgroundShapesInTree(scene.nodes, (node) => {
      let attrs = setNodeStyleProp({ attrs: node.attrs }, 'fill', fillValue, hasCss);
      // Clear any hidden fill-opacity="0" on background shapes (or force '1' if CSS rule sets < 1)
      const inheritedFillOpacity = getEffectiveNodeProp(
        { attrs: { class: node.attrs.class || '', id: node.attrs.id || '' }, tag: node.tag },
        'fill-opacity',
        scene.cssRules
      );
      const cssHidesFillOpacity =
        inheritedFillOpacity !== null && parseFloat(inheritedFillOpacity) < 1;
      attrs = setNodeStyleProp({ attrs }, 'fill-opacity', cssHidesFillOpacity ? '1' : null, hasCss);
      attrs = setNodeStyleProp(
        { attrs },
        'opacity',
        cfg.opacity >= 0.999 ? null : String(round2(cfg.opacity)),
        hasCss
      );
      return { ...node, visible: true, attrs };
    });
  } else {
    const bgNode: SvgSceneNode = {
      id: 'canvas-background',
      tag: 'rect',
      label: 'Background',
      visible: true,
      locked: true,
      isBackground: true,
      attrs: {
        id: 'canvas-background',
        'data-background': 'true',
        x: String(scene.vbX),
        y: String(scene.vbY),
        width: String(scene.vbW),
        height: String(scene.vbH),
        fill: fillValue,
        ...(cfg.opacity < 0.999 ? { opacity: String(round2(cfg.opacity)) } : {}),
      },
      transform: createIdentityTransform(),
    };
    nextNodes = [bgNode, ...scene.nodes];
  }

  // Ensure root <svg> CSS background never overrides the editable background rect
  let nextRootAttrs = scene.rootAttrs;
  if (scene.rootAttrs.style) {
    const styleMap = parseInlineStyleMap(scene.rootAttrs.style);
    if (styleMap.background !== undefined || styleMap['background-color'] !== undefined) {
      delete styleMap.background;
      delete styleMap['background-color'];
      const cleaned = serializeInlineStyleMap(styleMap);
      nextRootAttrs = { ...scene.rootAttrs };
      if (cleaned) nextRootAttrs.style = cleaned;
      else delete nextRootAttrs.style;
    }
  }

  return {
    ...scene,
    rootAttrs: nextRootAttrs,
    defsNodes: nextDefs,
    hasExplicitBackground: true,
    backgroundColor: cfg.mode === 'solid' ? safeSolid : safeStart,
    nodes: nextNodes,
  };
}

export function createImageNode(
  scene: SvgSceneDocument,
  dataUrl: string,
  options: { width?: number; height?: number; label?: string; fullBleed?: boolean } = {}
): SvgSceneNode {
  const id = generateUniqueNodeId('image');
  let targetW = scene.vbW;
  let targetH = scene.vbH;
  let x = scene.vbX;
  let y = scene.vbY;

  if (!options.fullBleed) {
    const natW = options.width && options.width > 0 ? options.width : scene.vbW * 0.45;
    const natH = options.height && options.height > 0 ? options.height : scene.vbH * 0.35;
    const maxW = scene.vbW * 0.55;
    const maxH = scene.vbH * 0.55;
    const ratio = Math.min(maxW / natW, maxH / natH, 1.5);
    targetW = Math.max(40, Math.round(natW * ratio));
    targetH = Math.max(40, Math.round(natH * ratio));
    x = Math.round(scene.vbX + (scene.vbW - targetW) / 2);
    y = Math.round(scene.vbY + (scene.vbH - targetH) / 2);
  }

  return {
    id,
    tag: 'image',
    label: options.label || (options.fullBleed ? 'Background Image' : 'Image'),
    visible: true,
    locked: Boolean(options.fullBleed),
    attrs: {
      id,
      href: dataUrl,
      x: String(x),
      y: String(y),
      width: String(targetW),
      height: String(targetH),
      preserveAspectRatio: options.fullBleed ? 'xMidYMid slice' : 'xMidYMid meet',
    },
    transform: createIdentityTransform(),
    isBackground: options.fullBleed || undefined,
    isAddedByUser: true,
  };
}

export function replaceImageNodeSource(
  node: SvgSceneNode,
  dataUrl: string
): SvgSceneNode {
  if (node.tag !== 'image') return node;
  const nextAttrs: Record<string, string> = { ...node.attrs, href: dataUrl };
  delete nextAttrs['xlink:href'];
  return { ...node, attrs: nextAttrs };
}

export function moveNodeRelativeInTree(
  nodes: SvgSceneNode[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
): SvgSceneNode[] {
  if (sourceId === targetId) return nodes;
  // Prevent moving a parent into one of its own descendants
  const sourceInfo = findNodeWithAncestors(nodes, sourceId);
  if (!sourceInfo) return nodes;
  if (sourceInfo.node.children) {
    const descIds = new Set(collectAllNodes(sourceInfo.node.children).map((c) => c.id));
    if (descIds.has(targetId)) return nodes;
  }

  let extracted: SvgSceneNode | null = null;
  const removeSource = (list: SvgSceneNode[]): SvgSceneNode[] => {
    const out: SvgSceneNode[] = [];
    for (const item of list) {
      if (item.id === sourceId) {
        extracted = item;
        continue;
      }
      if (item.children) {
        out.push({ ...item, children: removeSource(item.children) });
      } else {
        out.push(item);
      }
    }
    return out;
  };

  const withoutSource = removeSource(nodes);
  if (!extracted) return nodes;

  const insertRelative = (list: SvgSceneNode[]): { next: SvgSceneNode[]; inserted: boolean } => {
    const out: SvgSceneNode[] = [];
    let inserted = false;
    for (const item of list) {
      if (item.id === targetId) {
        if (position === 'before') {
          out.push(extracted!, item);
        } else {
          out.push(item, extracted!);
        }
        inserted = true;
      } else if (item.children) {
        const res = insertRelative(item.children);
        if (res.inserted) {
          out.push({ ...item, children: res.next });
          inserted = true;
        } else {
          out.push(item);
        }
      } else {
        out.push(item);
      }
    }
    return { next: out, inserted };
  };

  const res = insertRelative(withoutSource);
  return res.inserted ? res.next : nodes;
}

export function cloneNodesForClipboard(
  nodes: SvgSceneNode[],
  targetIds: Set<string>
): SvgSceneNode[] {
  const picked: SvgSceneNode[] = [];
  for (const node of nodes) {
    if (targetIds.has(node.id) && !node.isBackground && !node.isPreservedUnsupported) {
      picked.push(JSON.parse(JSON.stringify(node)) as SvgSceneNode);
    } else if (node.children) {
      picked.push(...cloneNodesForClipboard(node.children, targetIds));
    }
  }
  return picked;
}

export function instantiateClipboardNodes(
  clipboard: SvgSceneNode[],
  offsetStep = 24
): { nodes: SvgSceneNode[]; createdIds: string[] } {
  const createdIds: string[] = [];
  const instantiated = clipboard.map((node) => {
    const cloned = cloneNodeTree(node, offsetStep, true);
    createdIds.push(cloned.id);
    return cloned;
  });
  return { nodes: instantiated, createdIds };
}

// ─── Color Palette Extraction for Colors Tab ───

export function extractSceneColorSwatches(
  scene: SvgSceneDocument
): SvgColorSwatch[] {
  const byHex = new Map<string, { usageCount: number; nodeIds: Set<string> }>();

  const recordHex = (raw: string | null, nodeId: string) => {
    const hex = normalizeColorToHex(raw);
    if (!hex) return;
    const entry = byHex.get(hex) ?? { usageCount: 0, nodeIds: new Set<string>() };
    entry.usageCount += 1;
    entry.nodeIds.add(nodeId);
    byHex.set(hex, entry);
  };

  const walk = (list: SvgSceneNode[], ancestors: SvgSceneNode[]) => {
    for (const node of list) {
      if (node.isBackground) continue;
      if (node.tag !== 'g') {
        recordHex(getEffectiveNodeProp(node, 'fill', scene.cssRules, ancestors), node.id);
        recordHex(getEffectiveNodeProp(node, 'stroke', scene.cssRules, ancestors), node.id);
      }
      if (node.children) {
        walk(node.children, [...ancestors, node]);
      }
    }
  };
  walk(scene.nodes, []);

  return Array.from(byHex.entries())
    .sort((a, b) => b[1].usageCount - a[1].usageCount)
    .slice(0, 12)
    .map(([color, info], idx) => ({
      id: `swatch_${idx}_${color.slice(1).toLowerCase()}`,
      label: `Color ${idx + 1} (${color})`,
      color,
      usageCount: info.usageCount,
      nodeIds: Array.from(info.nodeIds),
    }));
}

export function recolorNodesMatchingHex(
  nodes: SvgSceneNode[],
  fromHex: string,
  toHex: string,
  cssRules: Record<string, Record<string, string>>,
  options: { skipText?: boolean } = {}
): SvgSceneNode[] {
  const target = fromHex.toUpperCase();
  const hasCss = Object.keys(cssRules).length > 0;
  const walk = (list: SvgSceneNode[], ancestors: SvgSceneNode[]): SvgSceneNode[] =>
    list.map((node) => {
      if (node.isBackground) return node;
      let nextNode = node;
      if (node.tag !== 'g' && !(options.skipText && node.tag === 'text')) {
        const fillHex = normalizeColorToHex(
          getEffectiveNodeProp(node, 'fill', cssRules, ancestors)
        );
        const strokeHex = normalizeColorToHex(
          getEffectiveNodeProp(node, 'stroke', cssRules, ancestors)
        );
        let nextAttrs = nextNode.attrs;
        if (fillHex === target) {
          nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'fill', toHex, hasCss);
        }
        if (strokeHex === target) {
          nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'stroke', toHex, hasCss);
        }
        if (nextAttrs !== nextNode.attrs) {
          nextNode = { ...nextNode, attrs: nextAttrs };
        }
        if (nextNode.tspans) {
          nextNode = {
            ...nextNode,
            tspans: nextNode.tspans.map((ts) => {
              const tsFill = normalizeColorToHex(
                getEffectiveNodeProp(
                  { attrs: ts.attrs, tag: 'tspan' },
                  'fill',
                  cssRules,
                  [...ancestors, node]
                )
              );
              if (tsFill === target) {
                return {
                  ...ts,
                  attrs: setNodeStyleProp({ attrs: ts.attrs }, 'fill', toHex, hasCss),
                };
              }
              return ts;
            }),
          };
        }
      }
      if (nextNode.children) {
        nextNode = { ...nextNode, children: walk(nextNode.children, [...ancestors, node]) };
      }
      return nextNode;
    });

  return walk(nodes, []);
}

// ─── Editable SVG Serialization ───

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializeAttrs(attrs: Record<string, string>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null) continue;
    parts.push(`${key}="${escapeXml(String(val))}"`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function serializeStaticNode(node: SvgStaticNode, indent = '  '): string {
  const attrStr = serializeAttrs(node.attrs);
  if (node.tag.toLowerCase() === 'style' && node.textContent !== undefined) {
    const css = node.textContent.replace(/\]\]>/g, '');
    if (/[<&]/.test(css)) {
      return `${indent}<${node.tag}${attrStr}><![CDATA[\n${css}\n${indent}]]></${node.tag}>`;
    }
    return `${indent}<${node.tag}${attrStr}>${css}</${node.tag}>`;
  }
  if (node.children.length === 0) {
    if (node.textContent !== undefined) {
      return `${indent}<${node.tag}${attrStr}>${escapeXml(node.textContent)}</${node.tag}>`;
    }
    return `${indent}<${node.tag}${attrStr} />`;
  }
  const inner = node.children.map((c) => serializeStaticNode(c, `${indent}  `)).join('\n');
  return `${indent}<${node.tag}${attrStr}>\n${inner}\n${indent}</${node.tag}>`;
}

function serializeSceneNode(node: SvgSceneNode, indent = '  '): string {
  const attrs: Record<string, string> = { ...node.attrs };

  if (node.label && !attrs['data-label']) {
    attrs['data-label'] = node.label;
  }
  if (node.locked) {
    attrs['data-locked'] = 'true';
  } else {
    delete attrs['data-locked'];
  }
  if (!node.visible) {
    attrs.display = 'none';
  } else {
    delete attrs.display;
  }

  const transformStr = buildTransformString(node.transform);
  if (transformStr) {
    attrs.transform = transformStr;
  } else {
    delete attrs.transform;
  }

  const attrStr = serializeAttrs(attrs);

  if (node.tag === 'preserved' && node.staticNode) {
    return serializeStaticNode(node.staticNode, indent);
  }

  if (node.tag === 'g') {
    const childrenMarkup = (node.children ?? [])
      .map((c) => serializeSceneNode(c, `${indent}  `))
      .join('\n');
    return `${indent}<g${attrStr}>\n${childrenMarkup}\n${indent}</g>`;
  }

  if (node.tag === 'text') {
    const needsPreserveSpace =
      attrs['xml:space'] === 'preserve' ||
      (node.tspans && node.tspans.some((ts) => /  |^\s|\s$/.test(ts.text))) ||
      (!node.tspans && /  |^\s|\s$/.test(node.textContent ?? ''));
    if (needsPreserveSpace && !attrs['xml:space']) {
      attrs['xml:space'] = 'preserve';
    }
    const textAttrStr = serializeAttrs(attrs);
    if (node.tspans && node.tspans.length > 0) {
      const tspansMarkup = node.tspans
        .map((ts) => `<tspan${serializeAttrs(ts.attrs)}>${escapeXml(ts.text)}</tspan>`)
        .join('');
      return `${indent}<text${textAttrStr}>${tspansMarkup}</text>`;
    }
    return `${indent}<text${textAttrStr}>${escapeXml(node.textContent ?? '')}</text>`;
  }

  return `${indent}<${node.tag}${attrStr} />`;
}

export function serializeSceneToSvg(
  scene: SvgSceneDocument,
  options: {
    embeddedFontCss?: string;
    backgroundColor?: string;
    transparentBackground?: boolean;
  } = {}
): string {
  const rootAttrs: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: scene.viewBox,
    width: scene.widthAttr ?? String(scene.vbW),
    height: scene.heightAttr ?? String(scene.vbH),
    ...scene.rootAttrs,
  };
  if (scene.preserveAspectRatio) {
    rootAttrs.preserveAspectRatio = scene.preserveAspectRatio;
  }

  // Ensure xmlns:xlink if any xlink:href exists in serialized body
  const defsMarkup = scene.defsNodes.map((d) => serializeStaticNode(d, '  ')).join('\n');
  const nodesMarkup = scene.nodes.map((n) => serializeSceneNode(n, '  ')).join('\n');

  if (defsMarkup.includes('xlink:href') || nodesMarkup.includes('xlink:href')) {
    rootAttrs['xmlns:xlink'] = 'http://www.w3.org/1999/xlink';
  }

  const fontStyleBlock = options.embeddedFontCss
    ? `  <defs>\n    <style type="text/css">\n${options.embeddedFontCss}\n    </style>\n  </defs>`
    : '';

  const bgNeeded =
    !options.transparentBackground &&
    !scene.hasExplicitBackground &&
    Boolean(options.backgroundColor);

  const bgRect = bgNeeded
    ? `  <rect id="canvas-background" data-background="true" x="${scene.vbX}" y="${scene.vbY}" width="${scene.vbW}" height="${scene.vbH}" fill="${escapeXml(
        options.backgroundColor!
      )}" />`
    : '';

  const parts = [
    `<svg${serializeAttrs(rootAttrs)}>`,
    fontStyleBlock,
    defsMarkup,
    bgRect,
    nodesMarkup,
    '</svg>',
  ].filter(Boolean);

  return parts.join('\n');
}
