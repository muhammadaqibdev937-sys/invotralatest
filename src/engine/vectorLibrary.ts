import {
  createIdentityTransform,
  generateUniqueNodeId,
  SvgSceneDocument,
  SvgSceneNode,
} from './svgScene';

export interface VectorPresetItem {
  id: string;
  name: string;
  category: 'shapes' | 'borders' | 'icons' | 'floral';
  viewBox: string;
  previewPaths: Array<{
    tag: 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'path';
    attrs: Record<string, string>;
  }>;
  buildNode: (scene: SvgSceneDocument) => SvgSceneNode;
}

function getContrastInk(bgHex: string): string {
  const clean = bgHex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 255;
  const g = parseInt(clean.slice(2, 4), 16) || 255;
  const b = parseInt(clean.slice(4, 6), 16) || 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum < 0.45 ? '#E6D6B8' : '#28251F';
}

export const VECTOR_PRESETS: VectorPresetItem[] = [
  // ── SHAPES ──
  {
    id: 'shape-rect',
    name: 'Rectangle',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'rect', attrs: { x: '14', y: '22', width: '72', height: '56', fill: 'currentColor' } }],
    buildNode: (scene) => {
      const w = Math.round(scene.vbW * 0.28);
      const h = Math.round(scene.vbH * 0.16);
      const x = Math.round(scene.vbX + (scene.vbW - w) / 2);
      const y = Math.round(scene.vbY + (scene.vbH - h) / 2);
      const id = generateUniqueNodeId('rect');
      const color = getContrastInk(scene.backgroundColor);
      return {
        id,
        tag: 'rect',
        label: 'Rectangle',
        visible: true,
        locked: false,
        attrs: { id, x: String(x), y: String(y), width: String(w), height: String(h), fill: color, rx: '0' },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'shape-rounded-rect',
    name: 'Rounded Box',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'rect', attrs: { x: '14', y: '22', width: '72', height: '56', rx: '14', fill: 'currentColor' } }],
    buildNode: (scene) => {
      const w = Math.round(scene.vbW * 0.32);
      const h = Math.round(scene.vbH * 0.14);
      const x = Math.round(scene.vbX + (scene.vbW - w) / 2);
      const y = Math.round(scene.vbY + (scene.vbH - h) / 2);
      const rx = Math.max(12, Math.round(Math.min(w, h) * 0.14));
      const id = generateUniqueNodeId('rect');
      return {
        id,
        tag: 'rect',
        label: 'Rounded Rectangle',
        visible: true,
        locked: false,
        attrs: {
          id,
          x: String(x),
          y: String(y),
          width: String(w),
          height: String(h),
          rx: String(rx),
          fill: 'none',
          stroke: '#B5904B',
          'stroke-width': '4',
        },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'shape-circle',
    name: 'Circle',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'circle', attrs: { cx: '50', cy: '50', r: '34', fill: 'currentColor' } }],
    buildNode: (scene) => {
      const r = Math.round(Math.min(scene.vbW, scene.vbH) * 0.11);
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const id = generateUniqueNodeId('circle');
      return {
        id,
        tag: 'circle',
        label: 'Circle',
        visible: true,
        locked: false,
        attrs: { id, cx: String(cx), cy: String(cy), r: String(r), fill: '#B5904B' },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'shape-ellipse',
    name: 'Oval Seal',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'ellipse', attrs: { cx: '50', cy: '50', rx: '38', ry: '26', fill: 'currentColor' } }],
    buildNode: (scene) => {
      const rx = Math.round(scene.vbW * 0.16);
      const ry = Math.round(scene.vbH * 0.1);
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const id = generateUniqueNodeId('ellipse');
      return {
        id,
        tag: 'ellipse',
        label: 'Oval Seal',
        visible: true,
        locked: false,
        attrs: { id, cx: String(cx), cy: String(cy), rx: String(rx), ry: String(ry), fill: 'none', stroke: '#B5904B', 'stroke-width': '4' },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'shape-line',
    name: 'Divider Line',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'line', attrs: { x1: '12', y1: '50', x2: '88', y2: '50', stroke: 'currentColor', 'stroke-width': '6', 'stroke-linecap': 'round' } }],
    buildNode: (scene) => {
      const span = Math.round(scene.vbW * 0.44);
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const id = generateUniqueNodeId('line');
      return {
        id,
        tag: 'line',
        label: 'Divider Line',
        visible: true,
        locked: false,
        attrs: {
          id,
          x1: String(cx - span / 2),
          y1: String(cy),
          x2: String(cx + span / 2),
          y2: String(cy),
          stroke: '#B5904B',
          'stroke-width': '4',
          'stroke-linecap': 'round',
        },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'shape-diamond',
    name: 'Diamond',
    category: 'shapes',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'polygon', attrs: { points: '50,12 88,50 50,88 12,50', fill: 'currentColor' } }],
    buildNode: (scene) => {
      const r = Math.round(Math.min(scene.vbW, scene.vbH) * 0.1);
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const id = generateUniqueNodeId('polygon');
      return {
        id,
        tag: 'polygon',
        label: 'Diamond',
        visible: true,
        locked: false,
        attrs: {
          id,
          points: `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`,
          fill: '#B5904B',
        },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },

  // ── BORDERS & FRAMES ──
  {
    id: 'border-classic',
    name: 'Classic Border',
    category: 'borders',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'rect', attrs: { x: '14', y: '14', width: '72', height: '72', fill: 'none', stroke: 'currentColor', 'stroke-width': '4' } }],
    buildNode: (scene) => {
      const padX = Math.round(scene.vbW * 0.06);
      const padY = Math.round(scene.vbH * 0.05);
      const id = generateUniqueNodeId('border');
      return {
        id,
        tag: 'rect',
        label: 'Classic Border',
        visible: true,
        locked: false,
        attrs: {
          id,
          x: String(scene.vbX + padX),
          y: String(scene.vbY + padY),
          width: String(scene.vbW - padX * 2),
          height: String(scene.vbH - padY * 2),
          fill: 'none',
          stroke: '#B5904B',
          'stroke-width': '4',
        },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'border-arch',
    name: 'Arch Frame',
    category: 'borders',
    viewBox: '0 0 100 100',
    previewPaths: [{ tag: 'path', attrs: { d: 'M18,86 L18,46 A32,32 0 0 1 82,46 L82,86 Z', fill: 'none', stroke: 'currentColor', 'stroke-width': '4' } }],
    buildNode: (scene) => {
      const w = Math.round(scene.vbW * 0.78);
      const h = Math.round(scene.vbH * 0.82);
      const x = Math.round(scene.vbX + (scene.vbW - w) / 2);
      const y = Math.round(scene.vbY + (scene.vbH - h) / 2);
      const r = Math.round(w / 2);
      const archY = y + r;
      const d = `M ${x} ${y + h} L ${x} ${archY} A ${r} ${r} 0 0 1 ${x + w} ${archY} L ${x + w} ${y + h} Z`;
      const id = generateUniqueNodeId('arch');
      return {
        id,
        tag: 'path',
        label: 'Arch Frame',
        visible: true,
        locked: false,
        attrs: { id, d, fill: 'none', stroke: '#B5904B', 'stroke-width': '4' },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'border-ornate-divider',
    name: 'Ornate Divider',
    category: 'borders',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'path', attrs: { d: 'M10,50 L40,50 M60,50 L90,50 M50,42 L58,50 L50,58 L42,50 Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '3' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const half = Math.round(scene.vbW * 0.24);
      const gap = 22;
      const d = `M ${cx - half} ${cy} L ${cx - gap} ${cy} M ${cx + gap} ${cy} L ${cx + half} ${cy} M ${cx} ${cy - 10} L ${cx + 10} ${cy} L ${cx} ${cy + 10} L ${cx - 10} ${cy} Z`;
      const id = generateUniqueNodeId('divider');
      return {
        id,
        tag: 'path',
        label: 'Ornate Divider',
        visible: true,
        locked: false,
        attrs: { id, d, fill: '#B5904B', stroke: '#B5904B', 'stroke-width': '3', 'stroke-linecap': 'round' },
        transform: createIdentityTransform(),
        isAddedByUser: true,
      };
    },
  },

  // ── ICONS ──
  {
    id: 'icon-heart',
    name: 'Heart',
    category: 'icons',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'path', attrs: { d: 'M50 84 C50 84 14 60 14 34 C14 21 24 13 35 13 C42 13 48 18 50 23 C52 18 58 13 65 13 C76 13 86 21 86 34 C86 60 50 84 50 84 Z', fill: 'currentColor' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const s = Math.max(1, Math.round((Math.min(scene.vbW, scene.vbH) * 0.12) / 72));
      const id = generateUniqueNodeId('icon_heart');
      return {
        id,
        tag: 'path',
        label: 'Heart Icon',
        visible: true,
        locked: false,
        attrs: {
          id,
          d: 'M 0 34 C 0 34 -36 10 -36 -16 C -36 -29 -26 -37 -15 -37 C -8 -37 -2 -32 0 -27 C 2 -32 8 -37 15 -37 C 26 -37 36 -29 36 -16 C 36 10 0 34 0 34 Z',
          fill: '#B5904B',
        },
        transform: { tx: cx, ty: cy, scaleX: s, scaleY: s, rotation: 0 },
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'icon-sparkle',
    name: 'Star Sparkle',
    category: 'icons',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'path', attrs: { d: 'M50 10 Q54 46 90 50 Q54 54 50 90 Q46 54 10 50 Q46 46 50 10 Z', fill: 'currentColor' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const s = Math.max(1, Math.round((Math.min(scene.vbW, scene.vbH) * 0.12) / 80));
      const id = generateUniqueNodeId('icon_star');
      return {
        id,
        tag: 'path',
        label: 'Star Sparkle Icon',
        visible: true,
        locked: false,
        attrs: {
          id,
          d: 'M 0 -40 Q 4 -4 40 0 Q 4 4 0 40 Q -4 4 -40 0 Q -4 -4 0 -40 Z',
          fill: '#B5904B',
        },
        transform: { tx: cx, ty: cy, scaleX: s, scaleY: s, rotation: 0 },
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'icon-rings',
    name: 'Wedding Rings',
    category: 'icons',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'circle', attrs: { cx: '38', cy: '54', r: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '5' } },
      { tag: 'circle', attrs: { cx: '62', cy: '54', r: '22', fill: 'none', stroke: 'currentColor', 'stroke-width': '5' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const r = Math.round(Math.min(scene.vbW, scene.vbH) * 0.045);
      const offset = Math.round(r * 0.6);
      const gid = generateUniqueNodeId('icon_rings');
      return {
        id: gid,
        tag: 'g',
        label: 'Wedding Rings Icon',
        visible: true,
        locked: false,
        attrs: { id: gid },
        transform: createIdentityTransform(),
        isAddedByUser: true,
        children: [
          {
            id: `${gid}_l`,
            tag: 'circle',
            label: 'Left Ring',
            visible: true,
            locked: false,
            attrs: {
              id: `${gid}_l`,
              cx: String(cx - offset),
              cy: String(cy),
              r: String(r),
              fill: 'none',
              stroke: '#B5904B',
              'stroke-width': '5',
            },
            transform: createIdentityTransform(),
          },
          {
            id: `${gid}_r`,
            tag: 'circle',
            label: 'Right Ring',
            visible: true,
            locked: false,
            attrs: {
              id: `${gid}_r`,
              cx: String(cx + offset),
              cy: String(cy),
              r: String(r),
              fill: 'none',
              stroke: '#B5904B',
              'stroke-width': '5',
            },
            transform: createIdentityTransform(),
          },
        ],
      };
    },
  },

  // ── FLORAL / BOTANICAL ──
  {
    id: 'floral-sprig',
    name: 'Botanical Sprig',
    category: 'floral',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'path', attrs: { d: 'M20 82 Q45 52 78 18 M40 60 Q22 50 26 32 Q44 36 40 60 Z M54 44 Q72 52 76 34 Q58 30 54 44 Z M66 30 Q62 12 80 14 Q80 30 66 30 Z', fill: 'currentColor', stroke: 'currentColor', 'stroke-width': '2' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const s = Math.max(1.5, Math.round((Math.min(scene.vbW, scene.vbH) * 0.16) / 70));
      const id = generateUniqueNodeId('floral_sprig');
      return {
        id,
        tag: 'path',
        label: 'Botanical Sprig',
        visible: true,
        locked: false,
        attrs: {
          id,
          d: 'M -30 32 Q -5 2 28 -32 M -10 10 Q -28 0 -24 -18 Q -6 -14 -10 10 Z M 4 -6 Q 22 2 26 -16 Q 8 -20 4 -6 Z M 16 -20 Q 12 -38 30 -36 Q 30 -20 16 -20 Z',
          fill: '#748660',
          stroke: '#485A3C',
          'stroke-width': '2',
          'stroke-linecap': 'round',
        },
        transform: { tx: cx, ty: cy, scaleX: s, scaleY: s, rotation: 0 },
        isAddedByUser: true,
      };
    },
  },
  {
    id: 'floral-flower',
    name: 'Minimalist Blossom',
    category: 'floral',
    viewBox: '0 0 100 100',
    previewPaths: [
      { tag: 'path', attrs: { d: 'M50 14 C60 14 66 26 56 38 C72 28 84 36 84 48 C84 58 72 64 58 54 C68 68 62 84 50 84 C38 84 32 68 42 54 C28 64 16 58 16 48 C16 36 28 28 44 38 C34 26 40 14 50 14 Z', fill: 'currentColor' } },
    ],
    buildNode: (scene) => {
      const cx = Math.round(scene.vbX + scene.vbW / 2);
      const cy = Math.round(scene.vbY + scene.vbH / 2);
      const s = Math.max(1.5, Math.round((Math.min(scene.vbW, scene.vbH) * 0.14) / 72));
      const id = generateUniqueNodeId('floral_blossom');
      return {
        id,
        tag: 'path',
        label: 'Blossom Illustration',
        visible: true,
        locked: false,
        attrs: {
          id,
          d: 'M 0 -36 C 10 -36 16 -24 6 -12 C 22 -22 34 -14 34 -2 C 34 8 22 14 8 4 C 18 18 12 34 0 34 C -12 34 -18 18 -8 4 C -22 14 -34 8 -34 -2 C -34 -14 -22 -22 -6 -12 C -16 -24 -10 -36 0 -36 Z',
          fill: '#D8A1AC',
          stroke: '#B47987',
          'stroke-width': '2',
        },
        transform: { tx: cx, ty: cy, scaleX: s, scaleY: s, rotation: 0 },
        isAddedByUser: true,
      };
    },
  },
];
