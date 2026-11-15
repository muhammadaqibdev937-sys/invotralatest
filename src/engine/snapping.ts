export type GridPreset = 'fine' | 'medium' | 'wide';

export interface RectBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface SnapTarget {
  id: string;
  kind: 'element';
  box: RectBox;
}

export interface SnapGuideLine {
  axis: 'x' | 'y';
  position: number;
  spanStart: number;
  spanEnd: number;
  kind: 'center' | 'margin' | 'element' | 'grid';
}

export interface SnapComputationInput {
  draggedBox: RectBox;
  rawAnchorX: number;
  rawAnchorY: number;
  canvas: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  targets: SnapTarget[];
  gridStep: number;
  snapToElements: boolean;
  snapToGrid: boolean;
  threshold: number;
}

export interface SnapComputationResult {
  snappedX: number;
  snappedY: number;
  dx: number;
  dy: number;
  guides: SnapGuideLine[];
}

export function makeRectBox(left: number, top: number, width: number, height: number): RectBox {
  const safeW = Math.max(0, width);
  const safeH = Math.max(0, height);
  return {
    left,
    right: left + safeW,
    top,
    bottom: top + safeH,
    centerX: left + safeW / 2,
    centerY: top + safeH / 2,
    width: safeW,
    height: safeH,
  };
}

export function shiftRectBox(box: RectBox, dx: number, dy: number): RectBox {
  return {
    left: box.left + dx,
    right: box.right + dx,
    top: box.top + dy,
    bottom: box.bottom + dy,
    centerX: box.centerX + dx,
    centerY: box.centerY + dy,
    width: box.width,
    height: box.height,
  };
}

/**
 * Picks a clean grid step in SVG canvas units scaled proportionally to canvas dimensions.
 */
export function resolveGridStep(
  canvasWidth: number,
  canvasHeight: number,
  preset: GridPreset = 'medium'
): number {
  const minDim = Math.max(200, Math.min(canvasWidth, canvasHeight));
  const rawDivisions = preset === 'fine' ? 20 : preset === 'wide' ? 6 : 10;
  const approx = minDim / rawDivisions;

  // Snap step to a clean human-friendly interval
  const niceSteps = [10, 20, 25, 40, 50, 75, 100, 125, 150, 200, 250, 300];
  let best = niceSteps[0];
  let bestDist = Infinity;
  for (const s of niceSteps) {
    const dist = Math.abs(s - approx);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

/**
 * Generates grid coordinates centered symmetrically on the canvas center
 * so centerlines always sit exactly on the vertical & horizontal midpoints.
 */
export function computeCenteredGridLines(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  step: number
): { xs: number[]; ys: number[]; centerX: number; centerY: number } {
  const safeStep = Math.max(8, step);
  const centerX = canvasX + canvasWidth / 2;
  const centerY = canvasY + canvasHeight / 2;
  const maxX = canvasX + canvasWidth;
  const maxY = canvasY + canvasHeight;

  const xs: number[] = [centerX];
  for (let k = 1; centerX - k * safeStep > canvasX + 0.5 || centerX + k * safeStep < maxX - 0.5; k++) {
    const neg = centerX - k * safeStep;
    const pos = centerX + k * safeStep;
    if (neg > canvasX + 0.5) xs.unshift(neg);
    if (pos < maxX - 0.5) xs.push(pos);
  }

  const ys: number[] = [centerY];
  for (let k = 1; centerY - k * safeStep > canvasY + 0.5 || centerY + k * safeStep < maxY - 0.5; k++) {
    const neg = centerY - k * safeStep;
    const pos = centerY + k * safeStep;
    if (neg > canvasY + 0.5) ys.unshift(neg);
    if (pos < maxY - 0.5) ys.push(pos);
  }

  return { xs, ys, centerX, centerY };
}

interface AxisSnapCandidate {
  delta: number;
  score: number;
  kind: 'center' | 'margin' | 'element' | 'grid';
}

function findBestAxisDelta(
  dragPoints: number[],
  axisSpecs: Array<{ pos: number; kind: 'center' | 'margin' | 'element' | 'grid'; priorityBias: number }>,
  threshold: number
): AxisSnapCandidate | null {
  let best: AxisSnapCandidate | null = null;
  for (const dragVal of dragPoints) {
    for (const spec of axisSpecs) {
      const delta = spec.pos - dragVal;
      const dist = Math.abs(delta);
      if (dist > threshold) continue;
      const score = dist + spec.priorityBias;
      if (!best || score < best.score) {
        best = { delta, score, kind: spec.kind };
      }
    }
  }
  return best;
}

/**
 * Computes snapped coordinates and active visual alignment guide lines
 * for a dragged element (text or vector graphic) against canvas center,
 * safe margins, other canvas elements, and centered grid lines.
 */
export function computeSnapPosition(input: SnapComputationInput): SnapComputationResult {
  const {
    draggedBox,
    rawAnchorX,
    rawAnchorY,
    canvas,
    targets,
    gridStep,
    snapToElements,
    snapToGrid,
    threshold,
  } = input;

  const centerX = canvas.x + canvas.width / 2;
  const centerY = canvas.y + canvas.height / 2;
  const marginX = Math.round(Math.min(canvas.width, canvas.height) * 0.05);
  const marginY = marginX;

  const xSpecs: Array<{
    pos: number;
    kind: 'center' | 'margin' | 'element' | 'grid';
    priorityBias: number;
    targetBox?: RectBox;
  }> = [];
  const ySpecs: Array<{
    pos: number;
    kind: 'center' | 'margin' | 'element' | 'grid';
    priorityBias: number;
    targetBox?: RectBox;
  }> = [];

  if (snapToElements) {
    // Canvas centerlines get highest magnetic priority
    xSpecs.push({ pos: centerX, kind: 'center', priorityBias: -0.75 });
    ySpecs.push({ pos: centerY, kind: 'center', priorityBias: -0.75 });

    // Canvas safe margins (5% inset)
    xSpecs.push({ pos: canvas.x + marginX, kind: 'margin', priorityBias: 0.25 });
    xSpecs.push({ pos: canvas.x + canvas.width - marginX, kind: 'margin', priorityBias: 0.25 });
    ySpecs.push({ pos: canvas.y + marginY, kind: 'margin', priorityBias: 0.25 });
    ySpecs.push({ pos: canvas.y + canvas.height - marginY, kind: 'margin', priorityBias: 0.25 });

    // Other text & graphic elements on the canvas (edges + centers)
    for (const target of targets) {
      xSpecs.push({ pos: target.box.left, kind: 'element', priorityBias: 0, targetBox: target.box });
      xSpecs.push({ pos: target.box.centerX, kind: 'element', priorityBias: -0.25, targetBox: target.box });
      xSpecs.push({ pos: target.box.right, kind: 'element', priorityBias: 0, targetBox: target.box });

      ySpecs.push({ pos: target.box.top, kind: 'element', priorityBias: 0, targetBox: target.box });
      ySpecs.push({ pos: target.box.centerY, kind: 'element', priorityBias: -0.25, targetBox: target.box });
      ySpecs.push({ pos: target.box.bottom, kind: 'element', priorityBias: 0, targetBox: target.box });
    }
  }

  if (snapToGrid && gridStep >= 8) {
    const { xs, ys } = computeCenteredGridLines(
      canvas.x,
      canvas.y,
      canvas.width,
      canvas.height,
      gridStep
    );
    for (const gx of xs) {
      if (Math.abs(gx - centerX) > 0.5) {
        xSpecs.push({ pos: gx, kind: 'grid', priorityBias: 0.8 });
      } else if (!snapToElements) {
        xSpecs.push({ pos: gx, kind: 'center', priorityBias: 0 });
      }
    }
    for (const gy of ys) {
      if (Math.abs(gy - centerY) > 0.5) {
        ySpecs.push({ pos: gy, kind: 'grid', priorityBias: 0.8 });
      } else if (!snapToElements) {
        ySpecs.push({ pos: gy, kind: 'center', priorityBias: 0 });
      }
    }
  }

  const dragXPoints = [draggedBox.centerX, draggedBox.left, draggedBox.right];
  const dragYPoints = [draggedBox.centerY, draggedBox.top, draggedBox.bottom];

  const bestX = findBestAxisDelta(dragXPoints, xSpecs, threshold);
  const bestY = findBestAxisDelta(dragYPoints, ySpecs, threshold);

  const dx = bestX ? Math.round(bestX.delta * 10) / 10 : 0;
  const dy = bestY ? Math.round(bestY.delta * 10) / 10 : 0;

  const snappedBox = shiftRectBox(draggedBox, dx, dy);
  const guides: SnapGuideLine[] = [];
  const seenGuides = new Set<string>();
  const matchEps = 0.75;
  const elementPad = 14;

  // Collect matching X guides after snapping
  if (bestX) {
    const snappedXs = [snappedBox.left, snappedBox.centerX, snappedBox.right];
    for (const spec of xSpecs) {
      if (snappedXs.some((vx) => Math.abs(vx - spec.pos) <= matchEps)) {
        let spanStart = canvas.y;
        let spanEnd = canvas.y + canvas.height;
        if (spec.kind === 'element' && spec.targetBox) {
          spanStart = Math.max(canvas.y, Math.min(snappedBox.top, spec.targetBox.top) - elementPad);
          spanEnd = Math.min(
            canvas.y + canvas.height,
            Math.max(snappedBox.bottom, spec.targetBox.bottom) + elementPad
          );
        }
        const key = `x:${Math.round(spec.pos * 10)}:${spec.kind}`;
        if (!seenGuides.has(key)) {
          seenGuides.add(key);
          guides.push({
            axis: 'x',
            position: spec.pos,
            spanStart,
            spanEnd,
            kind: spec.kind,
          });
        }
      }
    }
  }

  // Collect matching Y guides after snapping
  if (bestY) {
    const snappedYs = [snappedBox.top, snappedBox.centerY, snappedBox.bottom];
    for (const spec of ySpecs) {
      if (snappedYs.some((vy) => Math.abs(vy - spec.pos) <= matchEps)) {
        let spanStart = canvas.x;
        let spanEnd = canvas.x + canvas.width;
        if (spec.kind === 'element' && spec.targetBox) {
          spanStart = Math.max(canvas.x, Math.min(snappedBox.left, spec.targetBox.left) - elementPad);
          spanEnd = Math.min(
            canvas.x + canvas.width,
            Math.max(snappedBox.right, spec.targetBox.right) + elementPad
          );
        }
        const key = `y:${Math.round(spec.pos * 10)}:${spec.kind}`;
        if (!seenGuides.has(key)) {
          seenGuides.add(key);
          guides.push({
            axis: 'y',
            position: spec.pos,
            spanStart,
            spanEnd,
            kind: spec.kind,
          });
        }
      }
    }
  }

  return {
    snappedX: Math.round(rawAnchorX + dx),
    snappedY: Math.round(rawAnchorY + dy),
    dx,
    dy,
    guides,
  };
}

const NON_GRAPHIC_TAGS = new Set([
  'defs',
  'style',
  'clippath',
  'mask',
  'pattern',
  'lineargradient',
  'radialgradient',
  'title',
  'desc',
  'metadata',
  'filter',
]);

/**
 * Tags direct renderable vector elements inside `#artwork-layer` with deterministic
 * `data-ea-gfx-id` attributes and applies saved `(dx, dy)` canvas-space offsets so
 * interactive canvas preview and SVG/PNG/PDF exports remain identical.
 */
export function applyGraphicOffsetsToSvgMarkup(
  innerMarkup: string,
  graphicOffsets?: Record<string, { dx: number; dy: number }>,
  tagElements = true
): string {
  const hasOffsets = Boolean(graphicOffsets && Object.keys(graphicOffsets).length > 0);
  if (typeof DOMParser === 'undefined' || (!hasOffsets && !tagElements)) {
    return innerMarkup;
  }

  const wrapperXml = `<svg xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`;
  const parser = new DOMParser();
  const doc = parser.parseFromString(wrapperXml, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return innerMarkup;

  const root = doc.documentElement;
  let gfxIndex = 0;

  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase();
    if (NON_GRAPHIC_TAGS.has(tag)) continue;

    const gfxId = `gfx_${gfxIndex}`;
    gfxIndex += 1;

    if (tagElements) {
      child.setAttribute('data-ea-gfx-id', gfxId);
    }

    const offset = graphicOffsets?.[gfxId];
    if (offset && (Math.abs(offset.dx) > 0.01 || Math.abs(offset.dy) > 0.01)) {
      const existing = child.getAttribute('transform')?.trim();
      const nextTransform = existing
        ? `translate(${offset.dx} ${offset.dy}) ${existing}`
        : `translate(${offset.dx} ${offset.dy})`;
      child.setAttribute('transform', nextTransform);
    }
  }

  const serializer = new XMLSerializer();
  return Array.from(root.childNodes)
    .map((node) => serializer.serializeToString(node))
    .join('\n');
}

export type AlignMode =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'
  | 'center-both';

export type AlignReference = 'canvas' | 'selection';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface AlignableEntry {
  id: string;
  box: RectBox;
}

export interface AlignDelta {
  id: string;
  dx: number;
  dy: number;
}

/**
 * Computes (dx, dy) canvas-space translation deltas to align elements to the
 * left, horizontal center, right, top, vertical center, bottom, or both
 * vertical & horizontal center relative to the canvas or the combined selection.
 */
export function computeAlignDeltas(
  entries: AlignableEntry[],
  canvas: { x: number; y: number; width: number; height: number },
  mode: AlignMode,
  relativeTo: AlignReference = 'canvas'
): AlignDelta[] {
  if (entries.length === 0) return [];

  let refLeft = canvas.x;
  let refRight = canvas.x + canvas.width;
  let refTop = canvas.y;
  let refBottom = canvas.y + canvas.height;
  let refCenterX = canvas.x + canvas.width / 2;
  let refCenterY = canvas.y + canvas.height / 2;

  if (relativeTo === 'selection' && entries.length >= 2) {
    refLeft = Math.min(...entries.map((e) => e.box.left));
    refRight = Math.max(...entries.map((e) => e.box.right));
    refTop = Math.min(...entries.map((e) => e.box.top));
    refBottom = Math.max(...entries.map((e) => e.box.bottom));
    refCenterX = (refLeft + refRight) / 2;
    refCenterY = (refTop + refBottom) / 2;
  }

  const deltas: AlignDelta[] = [];
  for (const { id, box } of entries) {
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = refLeft - box.left;
    else if (mode === 'center-h') dx = refCenterX - box.centerX;
    else if (mode === 'right') dx = refRight - box.right;
    else if (mode === 'top') dy = refTop - box.top;
    else if (mode === 'center-v') dy = refCenterY - box.centerY;
    else if (mode === 'bottom') dy = refBottom - box.bottom;
    else if (mode === 'center-both') {
      dx = refCenterX - box.centerX;
      dy = refCenterY - box.centerY;
    }

    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      deltas.push({
        id,
        dx: Math.round(dx * 10) / 10,
        dy: Math.round(dy * 10) / 10,
      });
    }
  }
  return deltas;
}

/**
 * Evenly distributes 3+ elements along the horizontal or vertical axis between
 * the outermost centers.
 */
export function computeDistributeDeltas(
  entries: AlignableEntry[],
  axis: DistributeAxis
): AlignDelta[] {
  if (entries.length < 3) return [];
  const sorted = [...entries].sort((a, b) =>
    axis === 'horizontal' ? a.box.centerX - b.box.centerX : a.box.centerY - b.box.centerY
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startCoord = axis === 'horizontal' ? first.box.centerX : first.box.centerY;
  const endCoord = axis === 'horizontal' ? last.box.centerX : last.box.centerY;
  const step = (endCoord - startCoord) / (sorted.length - 1);

  const deltas: AlignDelta[] = [];
  sorted.forEach((entry, idx) => {
    if (idx === 0 || idx === sorted.length - 1) return;
    const targetCenter = startCoord + idx * step;
    const currentCenter = axis === 'horizontal' ? entry.box.centerX : entry.box.centerY;
    const delta = targetCenter - currentCenter;
    if (Math.abs(delta) > 0.05) {
      const rounded = Math.round(delta * 10) / 10;
      deltas.push({
        id: entry.id,
        dx: axis === 'horizontal' ? rounded : 0,
        dy: axis === 'vertical' ? rounded : 0,
      });
    }
  });
  return deltas;
}

