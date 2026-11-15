import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  ClipboardPaste,
  Copy,
  Crosshair,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCw,
  Trash2,
  Type,
  Unlock,
  X,
} from 'lucide-react';
import {
  computeCenteredGridLines,
  computeSnapPosition,
  GridPreset,
  makeRectBox,
  RectBox,
  resolveGridStep,
  shiftRectBox,
  SnapGuideLine,
  SnapTarget,
} from '../../engine/snapping';
import {
  canReorderNode,
  collectAllNodes,
  findNodeWithAncestors,
  getNodeTspans,
  getTextNodeProperties,
  resolveTransformPivotPatch,
  SvgSceneDocument,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
} from '../../engine/svgScene';
import {
  getCssFontFallback,
  SvgSceneContent,
  svgAttrsToReactProps,
} from '../Canvas/SvgSceneRenderer';
import { LiveTextControl } from '../Editor/LiveTextControl';

export interface FontPreviewOverride {
  nodeId: string;
  fontFamily: string;
}

interface InvitationCanvasProps {
  designId: string;
  scene: SvgSceneDocument;
  transparentBackground: boolean;
  selectedIds: string[];
  toolMode: 'select' | 'pan';
  isPreviewMode?: boolean;
  previewOverride?: FontPreviewOverride | null;
  snapEnabled?: boolean;
  showGrid?: boolean;
  gridPreset?: GridPreset;
  hasClipboard?: boolean;
  onChangeToolMode: (mode: 'select' | 'pan') => void;
  onSelectNodes: (ids: string[]) => void;
  onSelectBackground?: () => void;
  onUpdateNodeTransform: (
    nodeId: string,
    patch: Partial<SvgTransformState>,
    coalesce?: boolean
  ) => void;
  onBatchUpdateTransforms?: (
    updates: Array<{ nodeId: string; patch: Partial<SvgTransformState> }>,
    coalesce?: boolean
  ) => void;
  onUpdateTextNode?: (nodeId: string, patch: TextEditPatch, coalesce?: boolean) => void;
  onCommitTextBoundary?: () => void;
  onDoubleClickTextNode?: (nodeId: string) => void;
  onDirectTextEdit?: (nodeId: string) => void;
  onCopyNodes?: (ids: string[]) => void;
  onPasteNodes?: () => void;
  onDuplicateNodes?: (ids: string[]) => void;
  onDeleteNodes?: (ids: string[]) => void;
  onToggleLock?: (nodeId: string) => void;
  onToggleVisibility?: (nodeId: string) => void;
  onReorderNode?: (nodeId: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  onFlipNode?: (nodeId: string, axis: 'x' | 'y') => void;
  onCenterNode?: (nodeId: string) => void;
  onRegisterBoxReader?: (reader: (ids: string[]) => Record<string, RectBox>) => void | (() => void);
  onRegisterPivotReader?: (
    reader: (id: string) => { x: number; y: number } | null
  ) => void | (() => void);
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200] as const;

type ResizeHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

function domRectToCanvasBox(
  elRect: DOMRect,
  svgRect: DOMRect,
  vbX: number,
  vbY: number,
  vbW: number,
  vbH: number
): RectBox | null {
  if (svgRect.width <= 0 || svgRect.height <= 0) return null;
  if (elRect.width <= 0 && elRect.height <= 0) return null;
  const scaleX = vbW / svgRect.width;
  const scaleY = vbH / svgRect.height;
  return makeRectBox(
    vbX + (elRect.left - svgRect.left) * scaleX,
    vbY + (elRect.top - svgRect.top) * scaleY,
    Math.max(4, elRect.width * scaleX),
    Math.max(4, elRect.height * scaleY)
  );
}

function boxesEqual(a: Record<string, RectBox>, b: Record<string, RectBox>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    const ba = a[k];
    const bb = b[k];
    if (!bb) return false;
    if (
      Math.abs(ba.left - bb.left) > 0.05 ||
      Math.abs(ba.top - bb.top) > 0.05 ||
      Math.abs(ba.width - bb.width) > 0.05 ||
      Math.abs(ba.height - bb.height) > 0.05
    ) {
      return false;
    }
  }
  return true;
}

export const InvitationCanvas: React.FC<InvitationCanvasProps> = ({
  designId,
  scene,
  transparentBackground,
  selectedIds,
  toolMode,
  isPreviewMode = false,
  previewOverride = null,
  snapEnabled = true,
  showGrid = false,
  gridPreset = 'medium',
  hasClipboard = false,
  onChangeToolMode,
  onSelectNodes,
  onSelectBackground,
  onUpdateNodeTransform,
  onBatchUpdateTransforms,
  onUpdateTextNode,
  onCommitTextBoundary,
  onDoubleClickTextNode,
  onDirectTextEdit,
  onCopyNodes,
  onPasteNodes,
  onDuplicateNodes,
  onDeleteNodes,
  onToggleLock,
  onToggleVisibility,
  onReorderNode,
  onFlipNode,
  onCenterNode,
  onRegisterBoxReader,
  onRegisterPivotReader,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const directEditorRef = useRef<HTMLDivElement>(null);

  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [fitScale, setFitScale] = useState<number>(0.34);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
  const [selectionBoxes, setSelectionBoxes] = useState<Record<string, RectBox>>({});
  const [activeRotationReadout, setActiveRotationReadout] = useState<number | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textPathCaret, setTextPathCaret] = useState<{
    nodeId: string;
    start: number;
    end: number;
  } | null>(null);
  const [textPathCaretCoords, setTextPathCaretCoords] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    rot: number;
    cx: number;
    cy: number;
    color: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

  const sceneNodesRef = useRef(scene.nodes);
  sceneNodesRef.current = scene.nodes;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const editingTextIdRef = useRef(editingTextId);
  editingTextIdRef.current = editingTextId;
  const lastEditBoxRef = useRef<{ nodeId: string; box: RectBox } | null>(null);
  const panOffsetRef = useRef(panOffset);
  panOffsetRef.current = panOffset;

  const pinchDistRef = useRef<number | null>(null);

  const interactionRef = useRef<
    | {
        kind: 'pan';
        startClientX: number;
        startClientY: number;
        origPanX: number;
        origPanY: number;
      }
    | {
        kind: 'move';
        nodeId: string;
        rawNodeId: string;
        pointerButton: number;
        shiftKey: boolean;
        wasAlreadySelected: boolean;
        startClientX: number;
        startClientY: number;
        origTx: number;
        origTy: number;
        origBox: RectBox;
        targets: SnapTarget[];
        peers: Array<{ nodeId: string; origTx: number; origTy: number }>;
        moved: boolean;
      }
    | {
        kind: 'resize';
        handle: ResizeHandleId;
        nodeId: string;
        startClientX: number;
        startClientY: number;
        origTransform: SvgTransformState;
        pivotX: number;
        pivotY: number;
        centerX: number;
        centerY: number;
        baseW: number;
        baseH: number;
      }
    | {
        kind: 'rotate';
        nodeId: string;
        pivotX: number;
        pivotY: number;
        centerX: number;
        centerY: number;
        origRotation: number;
        startAngleDeg: number;
      }
    | null
  >(null);

  const { vbX, vbY, vbW, vbH, viewBox } = scene;
  const primaryId = selectedIds[0] ?? null;

  const gridStep = useMemo(() => resolveGridStep(vbW, vbH, gridPreset), [vbW, vbH, gridPreset]);
  const gridLines = useMemo(
    () => computeCenteredGridLines(vbX, vbY, vbW, vbH, gridStep),
    [vbX, vbY, vbW, vbH, gridStep]
  );

  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    setZoomMode('fit');
    setZoomPercent(100);
    setActiveGuides([]);
    setEditingTextId(null);
    setContextMenu(null);
  }, [designId]);

  useEffect(() => {
    if (editingTextId && (isPreviewMode || !selectedIds.includes(editingTextId))) {
      setEditingTextId(null);
      onCommitTextBoundary?.();
    }
  }, [isPreviewMode, editingTextId, selectedIds, onCommitTextBoundary]);

  useEffect(() => {
    if (!editingTextId) return;
    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && directEditorRef.current?.contains(target)) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && directEditorRef.current?.contains(active)) {
        active.blur();
      } else {
        onCommitTextBoundary?.();
      }
      setEditingTextId(null);
    };
    window.addEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    };
  }, [editingTextId, onCommitTextBoundary]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  // Hold Space for temporary drag-to-pan
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !isTypingTarget(e.target) &&
        !isTypingTarget(document.activeElement)
      ) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    const onBlur = () => setSpacePressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const computeFitScale = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const padX = window.innerWidth < 768 ? 28 : 80;
    const padY = window.innerWidth < 768 ? 48 : 96;
    const availW = Math.max(180, rect.width - padX);
    const availH = Math.max(180, rect.height - padY);
    const next = Math.min(availW / vbW, availH / vbH, 1.5);
    setFitScale(Math.max(0.08, next));
  }, [vbW, vbH]);

  useEffect(() => {
    computeFitScale();
    const observer = new ResizeObserver(() => computeFitScale());
    if (viewportRef.current) observer.observe(viewportRef.current);
    window.addEventListener('resize', computeFitScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeFitScale);
    };
  }, [computeFitScale]);

  const effectiveScale = zoomMode === 'fit' ? fitScale : fitScale * (zoomPercent / 100);
  const displayWidth = Math.max(40, Math.round(vbW * effectiveScale));
  const displayHeight = Math.max(40, Math.round(vbH * effectiveScale));

  const findSceneDomElement = useCallback((svgEl: SVGSVGElement, id: string): Element | null => {
    const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    try {
      return svgEl.querySelector(`[data-scene-id="${escaped}"]`);
    } catch {
      return null;
    }
  }, []);

  const readNodeBoxes = useCallback(
    (ids: string[]): Record<string, RectBox> => {
      const svgEl = svgRef.current;
      if (!svgEl || ids.length === 0) return {};
      const svgRect = svgEl.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return {};
      const next: Record<string, RectBox> = {};
      for (const id of ids) {
        const targetEl = findSceneDomElement(svgEl, id);
        if (!targetEl) continue;
        const box = domRectToCanvasBox(
          targetEl.getBoundingClientRect(),
          svgRect,
          vbX,
          vbY,
          vbW,
          vbH
        );
        if (box) next[id] = box;
      }
      return next;
    },
    [findSceneDomElement, vbX, vbY, vbW, vbH]
  );

  const readNodeLocalCenter = useCallback(
    (id: string): { x: number; y: number } | null => {
      const svgEl = svgRef.current;
      if (!svgEl) return null;
      const svgRect = svgEl.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return null;
      const targetEl = findSceneDomElement(svgEl, id);
      if (!targetEl) return null;

      const info = findNodeWithAncestors(sceneNodesRef.current, id);
      const node = info?.node;

      if (typeof (targetEl as SVGGraphicsElement).getBBox === 'function') {
        try {
          const bbox = (targetEl as SVGGraphicsElement).getBBox();
          if (
            Number.isFinite(bbox.x) &&
            Number.isFinite(bbox.y) &&
            Number.isFinite(bbox.width) &&
            Number.isFinite(bbox.height) &&
            (bbox.width > 0 || bbox.height > 0)
          ) {
            let cx = bbox.x + bbox.width / 2;
            let cy = bbox.y + bbox.height / 2;
            if (node?.transform.baseTransform && typeof DOMMatrix !== 'undefined') {
              try {
                const m = new DOMMatrix(node.transform.baseTransform);
                const pts = [
                  m.transformPoint(new DOMPoint(bbox.x, bbox.y)),
                  m.transformPoint(new DOMPoint(bbox.x + bbox.width, bbox.y)),
                  m.transformPoint(new DOMPoint(bbox.x, bbox.y + bbox.height)),
                  m.transformPoint(new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height)),
                ];
                const xs = pts.map((p) => p.x);
                const ys = pts.map((p) => p.y);
                cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                cy = (Math.min(...ys) + Math.max(...ys)) / 2;
              } catch {
                // Keep raw getBBox center if baseTransform isn't a valid CSS/SVG matrix
              }
            }
            return { x: cx, y: cy };
          }
        } catch {
          // Fall through to CTM / rect fallback
        }
      }

      const elRect = targetEl.getBoundingClientRect();
      if (elRect.width > 0 || elRect.height > 0) {
        const clientCenterX = elRect.left + elRect.width / 2;
        const clientCenterY = elRect.top + elRect.height / 2;
        const parentEl = targetEl.parentElement as SVGGraphicsElement | null;
        if (parentEl && typeof parentEl.getScreenCTM === 'function') {
          try {
            const parentCtm = parentEl.getScreenCTM();
            if (parentCtm) {
              const pt = new DOMPoint(clientCenterX, clientCenterY).matrixTransform(
                parentCtm.inverse()
              );
              return {
                x: pt.x - (node?.transform.tx ?? 0),
                y: pt.y - (node?.transform.ty ?? 0),
              };
            }
          } catch {
            // Fall through to root box conversion
          }
        }
        const box = domRectToCanvasBox(elRect, svgRect, vbX, vbY, vbW, vbH);
        if (box) {
          return {
            x: box.centerX - (node?.transform.tx ?? 0),
            y: box.centerY - (node?.transform.ty ?? 0),
          };
        }
      }

      return null;
    },
    [findSceneDomElement, vbX, vbY, vbW, vbH]
  );

  useEffect(() => {
    if (!onRegisterBoxReader) return;
    return onRegisterBoxReader(readNodeBoxes);
  }, [onRegisterBoxReader, readNodeBoxes]);

  useEffect(() => {
    if (!onRegisterPivotReader) return;
    return onRegisterPivotReader(readNodeLocalCenter);
  }, [onRegisterPivotReader, readNodeLocalCenter]);

  const measureBoxes = useCallback(() => {
    if (isPreviewMode || (selectedIds.length === 0 && !editingTextId)) {
      setSelectionBoxes((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const idsToMeasure =
      editingTextId && !selectedIds.includes(editingTextId)
        ? [...selectedIds, editingTextId]
        : selectedIds;
    const next = readNodeBoxes(idsToMeasure);
    setSelectionBoxes((prev) => (boxesEqual(prev, next) ? prev : next));
  }, [isPreviewMode, selectedIds, editingTextId, readNodeBoxes]);

  useLayoutEffect(() => {
    measureBoxes();
  }, [measureBoxes, scene, fitScale, zoomMode, zoomPercent, panOffset, previewOverride]);

  useLayoutEffect(() => {
    if (isPreviewMode || !editingTextId) {
      setTextPathCaretCoords(null);
      return;
    }
    const editInfo = findNodeWithAncestors(scene.nodes, editingTextId);
    if (!editInfo || !editInfo.node.textPath) {
      setTextPathCaretCoords(null);
      return;
    }
    const svgEl = svgRef.current;
    if (!svgEl) {
      setTextPathCaretCoords(null);
      return;
    }
    const textEl = findSceneDomElement(svgEl, editingTextId) as SVGTextContentElement | null;
    if (!textEl || typeof textEl.getStartPositionOfChar !== 'function') {
      setTextPathCaretCoords(null);
      return;
    }
    const props = getTextNodeProperties(editInfo.node, scene.cssRules, editInfo.ancestors);
    const caretIdx =
      textPathCaret?.nodeId === editingTextId
        ? Math.max(0, textPathCaret.start)
        : props.fullText.length;
    try {
      const totalChars = textEl.getNumberOfChars();
      if (totalChars <= 0) {
        setTextPathCaretCoords(null);
        return;
      }
      const clampedIdx = Math.min(caretIdx, totalChars);
      const isAtEnd = clampedIdx >= totalChars;
      const charIdx = isAtEnd ? totalChars - 1 : clampedIdx;
      const pt = isAtEnd
        ? textEl.getEndPositionOfChar(charIdx)
        : textEl.getStartPositionOfChar(charIdx);
      const rot =
        typeof textEl.getRotationOfChar === 'function'
          ? textEl.getRotationOfChar(charIdx)
          : 0;
      const h = Math.max(12, props.fontSize);
      const caretColor =
        props.color && props.color !== 'none' ? props.color : '#18181B';
      setTextPathCaretCoords({
        x1: pt.x,
        y1: pt.y - h * 0.85,
        x2: pt.x,
        y2: pt.y + h * 0.2,
        rot: Number.isFinite(rot) ? rot : 0,
        cx: pt.x,
        cy: pt.y,
        color: caretColor,
      });
    } catch {
      setTextPathCaretCoords(null);
    }
  }, [isPreviewMode, editingTextId, textPathCaret, scene, findSceneDomElement]);

  const collectSnapTargets = useCallback(
    (excludeIds: Set<string>): SnapTarget[] => {
      const svgEl = svgRef.current;
      if (!svgEl) return [];
      const svgRect = svgEl.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return [];

      const targets: SnapTarget[] = [];
      const allNodes = collectAllNodes(scene.nodes);

      for (const n of allNodes) {
        if (!n.visible || n.isBackground || n.tag === 'g' || excludeIds.has(n.id)) continue;
        const domEl = svgEl.querySelector(`[data-scene-id="${n.id}"]`);
        if (!domEl) continue;
        const box = domRectToCanvasBox(
          domEl.getBoundingClientRect(),
          svgRect,
          vbX,
          vbY,
          vbW,
          vbH
        );
        if (!box) continue;
        if (box.width < 3 && box.height < 3) continue;
        if (box.width >= vbW * 0.9 && box.height >= vbH * 0.9) continue;
        targets.push({ id: n.id, kind: 'element', box });
      }
      return targets;
    },
    [scene.nodes, vbX, vbY, vbW, vbH]
  );

  const clientToSvgCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svgEl = svgRef.current;
      if (!svgEl) return null;
      const rect = svgEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return {
        x: vbX + ((clientX - rect.left) / rect.width) * vbW,
        y: vbY + ((clientY - rect.top) / rect.height) * vbH,
      };
    },
    [vbX, vbY, vbW, vbH]
  );

  const effectiveToolMode = spacePressed ? 'pan' : toolMode;

  const startPan = (clientX: number, clientY: number, captureTarget?: Element, pointerId?: number) => {
    if (captureTarget && pointerId !== undefined) {
      captureTarget.setPointerCapture?.(pointerId);
    }
    interactionRef.current = {
      kind: 'pan',
      startClientX: clientX,
      startClientY: clientY,
      origPanX: panOffset.x,
      origPanY: panOffset.y,
    };
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const targetEl = e.target as Element | null;
    if (
      targetEl?.closest?.(
        '[data-canvas-toolbar="true"], [role="menu"], button, input, select, textarea, a'
      )
    ) {
      return;
    }
    // Middle mouse button or primary click in Pan tool pans the canvas
    if (e.button === 1 || (effectiveToolMode === 'pan' && e.button === 0)) {
      e.preventDefault();
      startPan(e.clientX, e.clientY, e.currentTarget, e.pointerId);
      return;
    }
    if (e.target === viewportRef.current) {
      onSelectNodes([]);
    }
  };

  const resolveClickableNodeId = useCallback((clickedNode: SvgSceneNode): string => {
    // If clicked element is inside a user-created group (`group_*`), select the group unless already inside it
    const info = findNodeWithAncestors(sceneNodesRef.current, clickedNode.id);
    if (!info) return clickedNode.id;
    const userGroupAncestor = info.ancestors.find(
      (anc) => anc.id.startsWith('group_') && !anc.locked
    );
    if (userGroupAncestor && !selectedIdsRef.current.includes(clickedNode.id)) {
      return userGroupAncestor.id;
    }
    return clickedNode.id;
  }, []);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>, rawNode: SvgSceneNode) => {
      if (isPreviewMode) return;
      if (e.button === 1 || (effectiveToolMode === 'pan' && e.button === 0)) {
        e.stopPropagation();
        startPan(e.clientX, e.clientY, viewportRef.current ?? undefined, e.pointerId);
        return;
      }

      if (rawNode.isBackground && rawNode.locked) {
        onSelectNodes([]);
        onSelectBackground?.();
        return;
      }

      e.stopPropagation();

      const targetId = resolveClickableNodeId(rawNode);
      const currentNodes = sceneNodesRef.current;
      const currentSelected = selectedIdsRef.current;
      const targetInfo = findNodeWithAncestors(currentNodes, targetId);
      const targetNode = targetInfo?.node ?? rawNode;

      if (
        editingTextIdRef.current &&
        editingTextIdRef.current !== targetId &&
        editingTextIdRef.current !== rawNode.id
      ) {
        setEditingTextId(null);
        onCommitTextBoundary?.();
      }

      if (e.shiftKey) {
        const next = currentSelected.includes(targetId)
          ? currentSelected.filter((id) => id !== targetId)
          : [...currentSelected, targetId];
        onSelectNodes(next);
        return;
      }

      const wasAlreadySelected =
        currentSelected.includes(targetId) || currentSelected.includes(rawNode.id);
      const alreadyInMultiSelection =
        currentSelected.length > 1 && currentSelected.includes(targetId);
      if (!alreadyInMultiSelection) {
        onSelectNodes([targetId]);
      }

      if (targetNode.locked) {
        return;
      }

      const activeIds = alreadyInMultiSelection ? currentSelected : [targetId];
      const peers: Array<{ nodeId: string; origTx: number; origTy: number }> = [];
      for (const id of activeIds) {
        const n = findNodeWithAncestors(currentNodes, id)?.node;
        if (n && !n.locked) {
          peers.push({ nodeId: id, origTx: n.transform.tx, origTy: n.transform.ty });
        }
      }
      if (!peers.some((p) => p.nodeId === targetId)) {
        peers.unshift({
          nodeId: targetId,
          origTx: targetNode.transform.tx,
          origTy: targetNode.transform.ty,
        });
      }

      const svgEl = svgRef.current;
      const svgRect = svgEl?.getBoundingClientRect();
      const domEl = svgEl?.querySelector(`[data-scene-id="${targetId}"]`);
      const box =
        svgRect && domEl
          ? domRectToCanvasBox(domEl.getBoundingClientRect(), svgRect, vbX, vbY, vbW, vbH)
          : null;

      svgRef.current?.setPointerCapture?.(e.pointerId);
      interactionRef.current = {
        kind: 'move',
        nodeId: targetId,
        rawNodeId: rawNode.id,
        pointerButton: e.button,
        shiftKey: e.shiftKey,
        wasAlreadySelected,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origTx: targetNode.transform.tx,
        origTy: targetNode.transform.ty,
        origBox: box ?? makeRectBox(vbX + vbW / 2 - 40, vbY + vbH / 2 - 20, 80, 40),
        targets: collectSnapTargets(new Set(peers.map((p) => p.nodeId))),
        peers,
        moved: false,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPreviewMode, effectiveToolMode, vbX, vbY, vbW, vbH, collectSnapTargets, onSelectNodes, onSelectBackground, onCommitTextBoundary, resolveClickableNodeId]
  );

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent<SVGElement>, rawNode: SvgSceneNode) => {
      if (isPreviewMode || effectiveToolMode === 'pan') return;
      if (rawNode.isBackground && rawNode.locked) return;
      e.stopPropagation();
      setContextMenu(null);
      onSelectNodes([rawNode.id]);
      if (rawNode.tag === 'text') {
        onDoubleClickTextNode?.(rawNode.id);
        if (!rawNode.locked && onUpdateTextNode) {
          setEditingTextId(rawNode.id);
        }
      }
    },
    [isPreviewMode, effectiveToolMode, onSelectNodes, onDoubleClickTextNode, onUpdateTextNode]
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent<SVGElement>, rawNode: SvgSceneNode) => {
      if (isPreviewMode) return;
      e.preventDefault();
      e.stopPropagation();
      setEditingTextId(null);
      if (rawNode.isBackground && rawNode.locked) {
        if (hasClipboard) {
          setContextMenu({ x: e.clientX, y: e.clientY, nodeId: null });
        }
        return;
      }
      const targetId = resolveClickableNodeId(rawNode);
      if (!selectedIdsRef.current.includes(targetId)) {
        onSelectNodes([targetId]);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: targetId });
    },
    [isPreviewMode, hasClipboard, onSelectNodes, resolveClickableNodeId]
  );

  const handleResizePointerDown = (e: React.PointerEvent<SVGRectElement>, handle: ResizeHandleId) => {
    if (!primaryId || !selectionBoxes[primaryId]) return;
    e.stopPropagation();
    const info = findNodeWithAncestors(scene.nodes, primaryId);
    const node = info?.node;
    if (!node || node.locked) return;

    const box = selectionBoxes[primaryId];
    const xform = node.transform;
    const localCenter = readNodeLocalCenter(node.id) ?? {
      x: box.centerX - xform.tx,
      y: box.centerY - xform.ty,
    };
    const pivotPatch = resolveTransformPivotPatch(node, localCenter);
    const pivotX = pivotPatch.pivotX ?? xform.pivotX ?? localCenter.x;
    const pivotY = pivotPatch.pivotY ?? xform.pivotY ?? localCenter.y;
    const resolvedTx = pivotPatch.tx ?? xform.tx;
    const resolvedTy = pivotPatch.ty ?? xform.ty;
    const centerX = box.centerX;
    const centerY = box.centerY;

    svgRef.current?.setPointerCapture?.(e.pointerId);
    interactionRef.current = {
      kind: 'resize',
      handle,
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origTransform: { ...xform, tx: resolvedTx, ty: resolvedTy, pivotX, pivotY },
      pivotX,
      pivotY,
      centerX,
      centerY,
      baseW: Math.max(12, box.width / Math.max(0.1, Math.abs(xform.scaleX))),
      baseH: Math.max(12, box.height / Math.max(0.1, Math.abs(xform.scaleY))),
    };
  };

  const handleRotatePointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (!primaryId || !selectionBoxes[primaryId]) return;
    e.stopPropagation();
    const info = findNodeWithAncestors(scene.nodes, primaryId);
    const node = info?.node;
    if (!node || node.locked) return;

    const pt = clientToSvgCoords(e.clientX, e.clientY);
    if (!pt) return;

    const box = selectionBoxes[primaryId];
    const xform = node.transform;
    const localCenter = readNodeLocalCenter(node.id) ?? {
      x: box.centerX - xform.tx,
      y: box.centerY - xform.ty,
    };
    const pivotPatch = resolveTransformPivotPatch(node, localCenter);
    const pivotX = pivotPatch.pivotX ?? xform.pivotX ?? localCenter.x;
    const pivotY = pivotPatch.pivotY ?? xform.pivotY ?? localCenter.y;
    const centerX = box.centerX;
    const centerY = box.centerY;
    const startAngleDeg = (Math.atan2(pt.y - centerY, pt.x - centerX) * 180) / Math.PI;

    svgRef.current?.setPointerCapture?.(e.pointerId);
    interactionRef.current = {
      kind: 'rotate',
      nodeId: node.id,
      pivotX,
      pivotY,
      centerX,
      centerY,
      origRotation: xform.rotation,
      startAngleDeg,
    };
    setActiveRotationReadout(Math.round(xform.rotation));
  };

  const handlePointerMoveGlobal = (e: React.PointerEvent<HTMLDivElement>) => {
    const act = interactionRef.current;
    if (!act) return;

    if (act.kind === 'pan') {
      const dx = e.clientX - act.startClientX;
      const dy = e.clientY - act.startClientY;
      setPanOffset({
        x: Math.round(act.origPanX + dx),
        y: Math.round(act.origPanY + dy),
      });
      return;
    }

    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const scaleX = vbW / rect.width;
    const scaleY = vbH / rect.height;

    if (act.kind === 'move') {
      if (!act.moved) {
        if (Math.abs(e.clientX - act.startClientX) <= 3 && Math.abs(e.clientY - act.startClientY) <= 3) {
          return;
        }
        act.moved = true;
        if (editingTextId) {
          setEditingTextId(null);
        }
      }

      const dx = (e.clientX - act.startClientX) * scaleX;
      const dy = (e.clientY - act.startClientY) * scaleY;
      const rawTx = Math.round((act.origTx + dx) * 10) / 10;
      const rawTy = Math.round((act.origTy + dy) * 10) / 10;

      const shouldSnap = snapEnabled && !e.altKey;
      let finalTx = rawTx;
      let finalTy = rawTy;

      if (!shouldSnap) {
        setActiveGuides([]);
      } else {
        const candidateBox = shiftRectBox(act.origBox, rawTx - act.origTx, rawTy - act.origTy);
        const snapThreshold = Math.max(5, Math.round(9 * scaleX));
        const snapped = computeSnapPosition({
          draggedBox: candidateBox,
          rawAnchorX: rawTx,
          rawAnchorY: rawTy,
          canvas: { x: vbX, y: vbY, width: vbW, height: vbH },
          targets: act.targets,
          gridStep,
          snapToElements: true,
          snapToGrid: true,
          threshold: snapThreshold,
        });

        setActiveGuides(snapped.guides);
        finalTx = Math.round(snapped.snappedX * 10) / 10;
        finalTy = Math.round(snapped.snappedY * 10) / 10;
      }

      if (act.peers.length > 1 && onBatchUpdateTransforms) {
        const deltaTx = finalTx - act.origTx;
        const deltaTy = finalTy - act.origTy;
        onBatchUpdateTransforms(
          act.peers.map((peer) => ({
            nodeId: peer.nodeId,
            patch: {
              tx: Math.round((peer.origTx + deltaTx) * 10) / 10,
              ty: Math.round((peer.origTy + deltaTy) * 10) / 10,
            },
          })),
          true
        );
      } else {
        onUpdateNodeTransform(act.nodeId, { tx: finalTx, ty: finalTy }, true);
      }
      return;
    }

    if (act.kind === 'resize') {
      const dxSvg = (e.clientX - act.startClientX) * scaleX;
      const dySvg = (e.clientY - act.startClientY) * scaleY;

      // Project drag delta into element's rotated coordinate frame
      const rad = (-act.origTransform.rotation * Math.PI) / 180;
      const localDx = dxSvg * Math.cos(rad) - dySvg * Math.sin(rad);
      const localDy = dxSvg * Math.sin(rad) + dySvg * Math.cos(rad);

      const dirX = act.handle.includes('e') ? 1 : act.handle.includes('w') ? -1 : 0;
      const dirY = act.handle.includes('s') ? 1 : act.handle.includes('n') ? -1 : 0;

      const signX = act.origTransform.scaleX < 0 ? -1 : 1;
      const signY = act.origTransform.scaleY < 0 ? -1 : 1;
      const origMagX = Math.abs(act.origTransform.scaleX);
      const origMagY = Math.abs(act.origTransform.scaleY);

      let nextMagX = origMagX;
      let nextMagY = origMagY;

      if (dirX !== 0) {
        const nextW = Math.max(12, act.baseW * origMagX + dirX * localDx * 2);
        nextMagX = Math.max(0.15, Math.min(8, nextW / act.baseW));
      }
      if (dirY !== 0) {
        const nextH = Math.max(12, act.baseH * origMagY + dirY * localDy * 2);
        nextMagY = Math.max(0.15, Math.min(8, nextH / act.baseH));
      }

      // Corner handles maintain proportional aspect ratio unless Shift is held
      if (dirX !== 0 && dirY !== 0 && !e.shiftKey) {
        const ratioX = nextMagX / Math.max(0.05, origMagX);
        const ratioY = nextMagY / Math.max(0.05, origMagY);
        const uniformRatio = Math.abs(ratioX - 1) >= Math.abs(ratioY - 1) ? ratioX : ratioY;
        nextMagX = Math.max(0.15, Math.min(8, origMagX * uniformRatio));
        nextMagY = Math.max(0.15, Math.min(8, origMagY * uniformRatio));
      }

      onUpdateNodeTransform(
        act.nodeId,
        {
          pivotX: act.pivotX,
          pivotY: act.pivotY,
          scaleX: Math.round(signX * nextMagX * 1000) / 1000,
          scaleY: Math.round(signY * nextMagY * 1000) / 1000,
        },
        true
      );
      return;
    }

    if (act.kind === 'rotate') {
      const pt = clientToSvgCoords(e.clientX, e.clientY);
      if (!pt) return;
      const angleNow = (Math.atan2(pt.y - act.centerY, pt.x - act.centerX) * 180) / Math.PI;
      let nextRot = act.origRotation + (angleNow - act.startAngleDeg);

      // Normalize to [-180, 180]
      while (nextRot > 180) nextRot -= 360;
      while (nextRot < -180) nextRot += 360;

      if (e.shiftKey) {
        nextRot = Math.round(nextRot / 15) * 15;
      } else if (Math.abs(nextRot) < 2.5) {
        nextRot = 0;
      } else {
        nextRot = Math.round(nextRot * 10) / 10;
      }

      setActiveRotationReadout(Math.round(nextRot));
      onUpdateNodeTransform(
        act.nodeId,
        {
          pivotX: act.pivotX,
          pivotY: act.pivotY,
          rotation: nextRot,
        },
        true
      );
    }
  };

  const handlePointerUpGlobal = () => {
    const act = interactionRef.current;
    if (act && act.kind === 'move' && !act.moved) {
      if (act.peers.length > 1) {
        onSelectNodes([act.nodeId]);
      }
      if (
        act.pointerButton === 0 &&
        !act.shiftKey &&
        !isPreviewMode &&
        effectiveToolMode === 'select' &&
        onUpdateTextNode
      ) {
        const clickedTarget = findNodeWithAncestors(scene.nodes, act.nodeId)?.node;
        const clickedRaw = findNodeWithAncestors(scene.nodes, act.rawNodeId)?.node;
        const textToEdit =
          clickedTarget?.tag === 'text' && !clickedTarget.locked
            ? clickedTarget
            : clickedRaw?.tag === 'text' && !clickedRaw.locked && act.wasAlreadySelected
            ? clickedRaw
            : null;
        if (textToEdit) {
          if (textToEdit.id !== act.nodeId) {
            onSelectNodes([textToEdit.id]);
          }
          setEditingTextId(textToEdit.id);
          onDirectTextEdit?.(textToEdit.id);
        }
      }
    }
    interactionRef.current = null;
    setActiveGuides([]);
    setActiveRotationReadout(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setZoomMode('manual');
      setZoomPercent((p) => Math.min(200, Math.max(25, p + delta)));
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchDistRef.current !== null) {
        const delta = dist - pinchDistRef.current;
        if (Math.abs(delta) > 4) {
          setZoomMode('manual');
          setZoomPercent((prev) => Math.min(200, Math.max(25, Math.round(prev + delta * 0.4))));
          pinchDistRef.current = dist;
        }
      } else {
        pinchDistRef.current = dist;
      }
    }
  };

  const handleTouchEnd = () => {
    pinchDistRef.current = null;
  };

  const primaryBox = primaryId ? selectionBoxes[primaryId] : null;
  const primaryNode = useMemo(
    () => (primaryId ? findNodeWithAncestors(scene.nodes, primaryId)?.node ?? null : null),
    [scene.nodes, primaryId]
  );

  // Screen-constant SVG stroke/handle sizes based on current display zoom
  const unitPerPx = displayWidth > 0 ? vbW / displayWidth : 1;
  const handleSize = Math.max(4, unitPerPx * 9);
  const rotateStem = Math.max(12, unitPerPx * 26);

  const handlePositions: Array<{
    id: ResizeHandleId;
    x: number;
    y: number;
    cursor: string;
  }> = primaryBox
    ? [
        { id: 'nw', x: primaryBox.left, y: primaryBox.top, cursor: 'nwse-resize' },
        { id: 'n', x: primaryBox.centerX, y: primaryBox.top, cursor: 'ns-resize' },
        { id: 'ne', x: primaryBox.right, y: primaryBox.top, cursor: 'nesw-resize' },
        { id: 'e', x: primaryBox.right, y: primaryBox.centerY, cursor: 'ew-resize' },
        { id: 'se', x: primaryBox.right, y: primaryBox.bottom, cursor: 'nwse-resize' },
        { id: 's', x: primaryBox.centerX, y: primaryBox.bottom, cursor: 'ns-resize' },
        { id: 'sw', x: primaryBox.left, y: primaryBox.bottom, cursor: 'nesw-resize' },
        { id: 'w', x: primaryBox.left, y: primaryBox.centerY, cursor: 'ew-resize' },
      ]
    : [];

  const displayZoomLabel = zoomMode === 'fit' ? 'Fit' : `${zoomPercent}%`;

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerDown={(e) => {
        setContextMenu(null);
        handleViewportPointerDown(e);
      }}
      onContextMenu={(e) => {
        if (isPreviewMode) return;
        if (hasClipboard && (e.target === viewportRef.current || e.target === svgRef.current || (e.target as Element)?.hasAttribute('data-canvas-bg'))) {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, nodeId: null });
        }
      }}
      onPointerMove={handlePointerMoveGlobal}
      onPointerUp={handlePointerUpGlobal}
      onPointerCancel={handlePointerUpGlobal}
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-auto ea-scrollbar select-none bg-[#ECECEE] dark:bg-[#090909] ${
        effectiveToolMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      <div className="p-4 sm:p-10 flex items-center justify-center min-h-full">
        <div
          className={`relative ${
            transparentBackground || scene.hasExplicitBackground ? 'ea-checkerboard' : ''
          }`}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            boxShadow: 'var(--ea-shadow-paper)',
            backgroundColor:
              transparentBackground || scene.hasExplicitBackground ? undefined : scene.backgroundColor,
          }}
        >
          {(() => {
            const rootSvgProps = svgAttrsToReactProps(scene.rootAttrs);
            const mergedRootClass = [rootSvgProps.className, 'block w-full h-full overflow-visible']
              .filter(Boolean)
              .join(' ');
            const { className: _ignoredCls, ...restRootProps } = rootSvgProps;
            return (
              <svg
                {...restRootProps}
                ref={svgRef}
                viewBox={viewBox}
                width="100%"
                height="100%"
                preserveAspectRatio={scene.preserveAspectRatio || 'xMidYMid meet'}
                className={mergedRootClass}
            onPointerDown={(e) => {
              setContextMenu(null);
              if (e.button === 1 || (effectiveToolMode === 'pan' && e.button === 0)) {
                e.stopPropagation();
                startPan(e.clientX, e.clientY, viewportRef.current ?? undefined, e.pointerId);
                return;
              }
              if (isPreviewMode) return;
              if (e.target === svgRef.current || (e.target as Element)?.hasAttribute('data-canvas-bg')) {
                setEditingTextId(null);
                onSelectNodes([]);
                if ((e.target as Element)?.hasAttribute('data-canvas-bg')) {
                  onSelectBackground?.();
                }
              }
            }}
            role="img"
            aria-label={`${scene.title} interactive SVG canvas`}
          >
            <SvgSceneContent
              scene={scene}
              transparentBackground={transparentBackground}
              previewFontOverride={previewOverride}
              editingNodeId={!isPreviewMode ? editingTextId : null}
              interactive={!isPreviewMode && effectiveToolMode === 'select'}
              onNodePointerDown={handleNodePointerDown}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeContextMenu={handleNodeContextMenu}
            />

            {/* Optional Alignment Grid Overlay */}
            {!isPreviewMode && showGrid && (
              <g data-grid-overlay="true" className="pointer-events-none">
                {gridLines.xs.map((gx) => {
                  const isCenter = Math.abs(gx - gridLines.centerX) <= 0.5;
                  return (
                    <line
                      key={`gx-${gx}`}
                      x1={gx}
                      y1={vbY}
                      x2={gx}
                      y2={vbY + vbH}
                      stroke={isCenter ? 'rgba(155, 155, 155, 0.48)' : 'rgba(128, 128, 128, 0.22)'}
                      strokeWidth={isCenter ? 1.25 : 1}
                      strokeDasharray={isCenter ? '5 4' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {gridLines.ys.map((gy) => {
                  const isCenter = Math.abs(gy - gridLines.centerY) <= 0.5;
                  return (
                    <line
                      key={`gy-${gy}`}
                      x1={vbX}
                      y1={gy}
                      x2={vbX + vbW}
                      y2={gy}
                      stroke={isCenter ? 'rgba(155, 155, 155, 0.48)' : 'rgba(128, 128, 128, 0.22)'}
                      strokeWidth={isCenter ? 1.25 : 1}
                      strokeDasharray={isCenter ? '5 4' : undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            )}

            {/* Secondary Multi-Selected Outlines */}
            {!isPreviewMode &&
              selectedIds.slice(1).map((id) => {
                const b = selectionBoxes[id];
                if (!b) return null;
                return (
                  <rect
                    key={`sel-sec-${id}`}
                    x={b.left}
                    y={b.top}
                    width={b.width}
                    height={b.height}
                    fill="none"
                    stroke="#999999"
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                );
              })}

            {/* Primary Selected Element Outline + 8 Resize Handles + Rotate Handle */}
            {!isPreviewMode && primaryBox && primaryNode && (
              <g data-selection-overlay="true">
                <rect
                  x={primaryBox.left}
                  y={primaryBox.top}
                  width={primaryBox.width}
                  height={primaryBox.height}
                  fill="rgba(229, 229, 229, 0.04)"
                  stroke={primaryNode.locked ? '#737373' : '#E5E5E5'}
                  strokeWidth={1.5}
                  strokeDasharray={primaryNode.locked ? '4 4' : undefined}
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
                <rect
                  x={primaryBox.left}
                  y={primaryBox.top}
                  width={primaryBox.width}
                  height={primaryBox.height}
                  fill="none"
                  stroke="#090909"
                  strokeOpacity={0.55}
                  strokeWidth={0.75}
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />

                {!primaryNode.locked && (
                  <>
                    {/* Rotation stem + top handle */}
                    <line
                      x1={primaryBox.centerX}
                      y1={primaryBox.top}
                      x2={primaryBox.centerX}
                      y2={primaryBox.top - rotateStem}
                      stroke="#E5E5E5"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-none"
                    />
                    <g
                      onPointerDown={handleRotatePointerDown}
                      style={{ cursor: 'grab' }}
                      aria-label="Rotate selected element"
                    >
                      <circle
                        cx={primaryBox.centerX}
                        cy={primaryBox.top - rotateStem}
                        r={handleSize * 0.72}
                        fill="#151515"
                        stroke="#E5E5E5"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>

                    {/* 8 Resize Handles */}
                    {handlePositions.map((h) => (
                      <rect
                        key={h.id}
                        x={h.x - handleSize / 2}
                        y={h.y - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        rx={unitPerPx * 1.5}
                        fill="#F5F5F5"
                        stroke="#090909"
                        strokeWidth={1.25}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: h.cursor }}
                        onPointerDown={(e) => handleResizePointerDown(e, h.id)}
                      />
                    ))}
                  </>
                )}
              </g>
            )}

            {/* Smart Snap Guide Lines */}
            {!isPreviewMode && activeGuides.length > 0 && (
              <g data-snap-guides="true" className="pointer-events-none">
                {activeGuides.map((g, idx) => {
                  const isDashed = g.kind === 'margin' || g.kind === 'grid';
                  const dashAttr = isDashed ? '5 3' : undefined;
                  const x1 = g.axis === 'x' ? g.position : g.spanStart;
                  const y1 = g.axis === 'x' ? g.spanStart : g.position;
                  const x2 = g.axis === 'x' ? g.position : g.spanEnd;
                  const y2 = g.axis === 'x' ? g.spanEnd : g.position;
                  return (
                    <g key={`${g.axis}-${idx}-${Math.round(g.position)}`}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="rgba(9, 9, 9, 0.55)"
                        strokeWidth={3}
                        strokeDasharray={dashAttr}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#F5F5F5"
                        strokeWidth={1.25}
                        strokeDasharray={dashAttr}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Direct Curve Caret for Active textPath Editing */}
            {!isPreviewMode && editingTextId && textPathCaretCoords && (
              <g
                data-textpath-caret="true"
                className="pointer-events-none"
                transform={`rotate(${textPathCaretCoords.rot} ${textPathCaretCoords.cx} ${textPathCaretCoords.cy})`}
              >
                <line
                  x1={textPathCaretCoords.x1}
                  y1={textPathCaretCoords.y1}
                  x2={textPathCaretCoords.x2}
                  y2={textPathCaretCoords.y2}
                  stroke={textPathCaretCoords.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  className="animate-pulse"
                />
              </g>
            )}
              </svg>
            );
          })()}

          {!isPreviewMode && activeRotationReadout !== null && (
            <div className="pointer-events-none absolute top-2 right-2 px-2 py-1 rounded border border-[#E4E4E7] dark:border-[#292929] bg-white/95 dark:bg-[#151515]/95 text-[11px] font-mono tabular-nums text-[#111111] dark:text-[#F5F5F5] flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-[#3F3F46] dark:text-[#C0C0C0]" />
              <span>{activeRotationReadout}°</span>
            </div>
          )}

          {/* Direct On-Design Inline Text Editor (Frameless for straight & curved textPath) */}
          {!isPreviewMode &&
            editingTextId &&
            onUpdateTextNode &&
            (() => {
              const editInfo = findNodeWithAncestors(scene.nodes, editingTextId);
              if (!editInfo || editInfo.node.tag !== 'text' || editInfo.node.locked) return null;
              const editNode = editInfo.node;
              const editProps = getTextNodeProperties(editNode, scene.cssRules, editInfo.ancestors);
              const isCurvedPath = Boolean(editNode.textPath);
              const measuredBox = selectionBoxes[editingTextId];
              if (measuredBox) {
                lastEditBoxRef.current = { nodeId: editingTextId, box: measuredBox };
              }
              const box =
                measuredBox ??
                (lastEditBoxRef.current?.nodeId === editingTextId
                  ? lastEditBoxRef.current.box
                  : undefined);

              const scaleX = displayWidth / vbW;
              const scaleY = displayHeight / vbH;
              const scaledFontSize = Math.max(11, editProps.fontSize * scaleY);
              const lineHeightVal = editProps.lineHeight || 1.25;
              const lines = (editProps.fullText || '').split('\n');
              const lineCount = Math.max(1, lines.length);
              const longestLen = Math.max(8, ...lines.map((l) => l.length));

              let editorLeft = 8;
              let editorTop = Math.max(8, displayHeight / 2 - 20);
              let editorW = Math.max(120, Math.min(displayWidth - 16, 260));
              let editorH = Math.max(32, Math.ceil(lineCount * scaledFontSize * lineHeightVal + 6));

              if (box) {
                const rawBoxLeft = ((box.left - vbX) / vbW) * displayWidth;
                const rawBoxTop = ((box.top - vbY) / vbH) * displayHeight;
                const rawBoxW = Math.max(40, ((box.right - box.left) / vbW) * displayWidth);
                const rawBoxH = Math.max(
                  scaledFontSize * lineHeightVal,
                  ((box.bottom - box.top) / vbH) * displayHeight
                );
                const padX = isCurvedPath ? 4 : 10;
                const estLineW = longestLen * scaledFontSize * 0.62 + padX * 2 + 24;
                editorW = isCurvedPath
                  ? Math.max(60, Math.min(displayWidth - 8, rawBoxW + padX * 2))
                  : Math.max(rawBoxW + padX * 2, Math.min(displayWidth - 16, estLineW));
                editorH = isCurvedPath
                  ? Math.max(28, rawBoxH + 8)
                  : Math.max(
                      rawBoxH + 6,
                      Math.ceil(lineCount * scaledFontSize * lineHeightVal + 6)
                    );

                editorLeft = rawBoxLeft - padX;
                if (!isCurvedPath) {
                  if (editProps.textAnchor === 'middle') {
                    const centerPx = ((box.centerX - vbX) / vbW) * displayWidth;
                    editorLeft = centerPx - editorW / 2;
                  } else if (editProps.textAnchor === 'end') {
                    const rightPx = ((box.right - vbX) / vbW) * displayWidth;
                    editorLeft = rightPx - editorW + padX;
                  }
                }
                editorLeft = Math.max(4, Math.min(displayWidth - editorW - 4, editorLeft));
                editorTop = Math.max(4, Math.min(displayHeight - editorH - 4, rawBoxTop - 2));
              }

              return (
                <div
                  ref={directEditorRef}
                  data-direct-text-editor="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    left: `${editorLeft}px`,
                    top: `${editorTop}px`,
                    width: `${editorW}px`,
                  }}
                  className="absolute z-30"
                >
                  <LiveTextControl
                    as="textarea"
                    autoFocus
                    moveCaretToEndOnMount
                    nodeKey={editNode.id}
                    rows={isCurvedPath ? 1 : lineCount}
                    aria-label={`Edit ${editNode.label} directly on design`}
                    value={editProps.fullText}
                    onLiveChange={(nextText) =>
                      onUpdateTextNode(editNode.id, { text: nextText }, true)
                    }
                    onCommitBoundary={onCommitTextBoundary}
                    onCaretChange={
                      isCurvedPath
                        ? (start, end) =>
                            setTextPathCaret((prev) =>
                              prev &&
                              prev.nodeId === editNode.id &&
                              prev.start === start &&
                              prev.end === end
                                ? prev
                                : { nodeId: editNode.id, start, end }
                            )
                        : undefined
                    }
                    onBlur={() => {
                      if (isCurvedPath) setTextPathCaret(null);
                    }}
                    onKeyDown={(e) => {
                      const native = e.nativeEvent as KeyboardEvent;
                      if (native.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        e.currentTarget.blur();
                        setEditingTextId(null);
                        setTextPathCaret(null);
                      } else if (
                        e.key === 'Enter' &&
                        ((e.metaKey || e.ctrlKey) ||
                          isCurvedPath ||
                          (!e.shiftKey && !editProps.fullText.includes('\n')))
                      ) {
                        e.preventDefault();
                        e.currentTarget.blur();
                        setEditingTextId(null);
                        setTextPathCaret(null);
                      }
                    }}
                    style={
                      isCurvedPath
                        ? {
                            width: `${editorW}px`,
                            height: `${editorH}px`,
                            minHeight: '28px',
                            fontSize: `${scaledFontSize}px`,
                            lineHeight: String(lineHeightVal),
                            color: 'transparent',
                            backgroundColor: 'transparent',
                            caretColor: textPathCaretCoords
                              ? 'transparent'
                              : editProps.color && editProps.color !== 'none'
                              ? editProps.color
                              : '#18181B',
                            whiteSpace: 'pre',
                            overflow: 'hidden',
                          }
                        : {
                            width: `${editorW}px`,
                            height: `${editorH}px`,
                            minHeight: '28px',
                            fontFamily: getCssFontFallback(editProps.fontFamily),
                            fontSize: `${scaledFontSize}px`,
                            fontWeight: editProps.fontWeight,
                            fontStyle: editProps.fontStyle,
                            textDecoration: editProps.textDecoration,
                            color:
                              editProps.color && editProps.color !== 'none'
                                ? editProps.color
                                : '#111111',
                            letterSpacing: `${editProps.letterSpacing * scaleX}px`,
                            lineHeight: String(lineHeightVal),
                            textAlign:
                              editProps.textAnchor === 'middle'
                                ? 'center'
                                : editProps.textAnchor === 'end'
                                ? 'right'
                                : 'left',
                            transform: editNode.transform.rotation
                              ? `rotate(${editNode.transform.rotation}deg)`
                              : undefined,
                            whiteSpace: 'pre',
                            overflow: 'hidden',
                            padding: '1px 10px',
                          }
                    }
                    className={
                      isCurvedPath
                        ? 'block w-full bg-transparent border border-dashed border-[#18181B]/45 dark:border-[#E5E5E5]/55 rounded-sm resize-none focus:outline-none p-0'
                        : 'block bg-transparent border border-dashed border-[#18181B]/75 dark:border-[#E5E5E5]/85 rounded-sm resize-none focus:outline-none focus:border-solid focus:border-[#18181B] dark:focus:border-[#F5F5F5]'
                    }
                  />
                </div>
              );
            })()}
        </div>
      </div>

      {/* Right-Click Canvas Context Menu */}
      {!isPreviewMode &&
        contextMenu &&
        (() => {
          const ctxNode = contextMenu.nodeId
            ? findNodeWithAncestors(scene.nodes, contextMenu.nodeId)?.node ?? null
            : null;
          const menuLeft =
            typeof window !== 'undefined'
              ? Math.min(contextMenu.x, window.innerWidth - 210)
              : contextMenu.x;
          const menuTop =
            typeof window !== 'undefined'
              ? Math.min(contextMenu.y, window.innerHeight - 360)
              : contextMenu.y;
          const canFwd = ctxNode ? canReorderNode(scene.nodes, ctxNode.id, 'forward') : false;
          const canBack = ctxNode ? canReorderNode(scene.nodes, ctxNode.id, 'backward') : false;

          return (
            <div
              role="menu"
              onPointerDown={(e) => e.stopPropagation()}
              style={{ left: `${menuLeft}px`, top: `${menuTop}px`, boxShadow: 'var(--ea-shadow-float)' }}
              className="fixed z-50 w-48 rounded-lg border border-[#E4E4E7] dark:border-[#292929] bg-white dark:bg-[#151515] py-1.5 text-xs text-[#111111] dark:text-[#F5F5F5]"
            >
              {ctxNode ? (
                <>
                  {ctxNode.tag === 'text' && !ctxNode.locked && onUpdateTextNode && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTextId(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <Type className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                      <span>Edit Text</span>
                    </button>
                  )}
                  {onDuplicateNodes && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicateNodes([ctxNode.id]);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Duplicate</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] dark:text-[#737373]">Ctrl+D</span>
                    </button>
                  )}
                  {onCopyNodes && (
                    <button
                      type="button"
                      onClick={() => {
                        onCopyNodes([ctxNode.id]);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Copy</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] dark:text-[#737373]">Ctrl+C</span>
                    </button>
                  )}
                  {hasClipboard && onPasteNodes && (
                    <button
                      type="button"
                      onClick={() => {
                        onPasteNodes();
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ClipboardPaste className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Paste</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] dark:text-[#737373]">Ctrl+V</span>
                    </button>
                  )}

                  {!ctxNode.locked && !ctxNode.isBackground && (onFlipNode || onCenterNode) && (
                    <div className="my-1 border-t border-[#E4E4E7] dark:border-[#292929]" />
                  )}
                  {!ctxNode.locked && !ctxNode.isBackground && onCenterNode && (
                    <button
                      type="button"
                      onClick={() => {
                        onCenterNode(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                      <span>Center on Canvas</span>
                    </button>
                  )}
                  {!ctxNode.locked && !ctxNode.isBackground && onFlipNode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onFlipNode(ctxNode.id, 'x');
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                      >
                        <FlipHorizontal2 className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Flip Horizontal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onFlipNode(ctxNode.id, 'y');
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                      >
                        <FlipVertical2 className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Flip Vertical</span>
                      </button>
                    </>
                  )}

                  {onReorderNode && (canFwd || canBack) && (
                    <>
                      <div className="my-1 border-t border-[#E4E4E7] dark:border-[#292929]" />
                      {canFwd && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'front');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ChevronsUp className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                            <span>Bring to Front</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'forward');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                            <span>Bring Forward</span>
                          </button>
                        </>
                      )}
                      {canBack && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'backward');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                            <span>Send Backward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'back');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ChevronsDown className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                            <span>Send to Back</span>
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <div className="my-1 border-t border-[#E4E4E7] dark:border-[#292929]" />
                  {onToggleLock && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleLock(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      {ctxNode.locked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                          <span>Unlock</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                          <span>Lock</span>
                        </>
                      )}
                    </button>
                  )}
                  {onToggleVisibility && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleVisibility(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                      <span>Hide</span>
                    </button>
                  )}
                  {onDeleteNodes && !ctxNode.locked && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteNodes([ctxNode.id]);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center justify-between text-[#111111] dark:text-[#E5E5E5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                        <span>Delete</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] dark:text-[#737373]">Del</span>
                    </button>
                  )}
                </>
              ) : (
                hasClipboard &&
                onPasteNodes && (
                  <button
                    type="button"
                    onClick={() => {
                      onPasteNodes();
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-[#F4F4F5] dark:hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                      <span>Paste</span>
                    </span>
                    <span className="text-[10px] text-[#71717A] dark:text-[#737373]">Ctrl+V</span>
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setContextMenu(null)}
                className="sr-only"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })()}

      {/* Bottom Floating Tool, Pan & Zoom Bar */}
      <div
        data-canvas-toolbar="true"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="sticky bottom-3 z-20 cursor-default max-w-[calc(100%-16px)] inline-flex flex-wrap items-center justify-center gap-1 px-2 py-1.5 rounded-md border text-xs font-medium mb-2 bg-white dark:bg-[#151515] border-[#E4E4E7] dark:border-[#292929] text-[#111111] dark:text-[#F5F5F5]"
        style={{ boxShadow: 'var(--ea-shadow-float)' }}
      >
        <button
          type="button"
          onClick={() => {
            setSpacePressed(false);
            onChangeToolMode('select');
          }}
          title="Select & Edit Elements (V)"
          aria-label="Select tool"
          aria-pressed={effectiveToolMode === 'select'}
          className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${
            effectiveToolMode === 'select'
              ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
              : 'text-[#52525B] dark:text-[#C0C0C0] hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
          }`}
        >
          <MousePointer2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onChangeToolMode('pan')}
          title="Drag to Pan Canvas (or hold Space)"
          aria-label="Pan canvas tool"
          aria-pressed={effectiveToolMode === 'pan'}
          className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded cursor-pointer transition-colors ${
            effectiveToolMode === 'pan'
              ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
              : 'text-[#52525B] dark:text-[#C0C0C0] hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 mx-0.5 bg-[#E4E4E7] dark:bg-[#292929]" />

        <button
          type="button"
          onClick={() => {
            setZoomMode('manual');
            setZoomPercent((p) => Math.max(25, p - 15));
          }}
          aria-label="Zoom out"
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5] cursor-pointer transition-colors"
        >
          <Minus className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
        </button>

        <select
          aria-label="Zoom percentage"
          value={zoomMode === 'fit' ? 'fit' : String(zoomPercent)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'fit') {
              setZoomMode('fit');
              setZoomPercent(100);
              setPanOffset({ x: 0, y: 0 });
              computeFitScale();
            } else {
              setZoomMode('manual');
              setZoomPercent(Number(val));
            }
          }}
          className="h-7 px-1.5 rounded bg-white dark:bg-[#0D0D0D] border border-[#E4E4E7] dark:border-[#292929] text-[#111111] dark:text-[#F5F5F5] text-xs tabular-nums cursor-pointer focus:outline-none focus:border-[#3F3F46] dark:focus:border-[#C0C0C0]"
        >
          <option value="fit">Fit ({Math.round(fitScale * 100)}%)</option>
          {ZOOM_PRESETS.map((pct) => (
            <option key={pct} value={String(pct)}>
              {pct}%
            </option>
          ))}
          {!ZOOM_PRESETS.includes(zoomPercent as (typeof ZOOM_PRESETS)[number]) &&
            zoomMode === 'manual' && (
              <option value={String(zoomPercent)}>{displayZoomLabel}</option>
            )}
        </select>

        <input
          type="range"
          aria-label="Zoom slider"
          min={25}
          max={200}
          step={5}
          value={zoomPercent}
          onChange={(e) => {
            setZoomMode('manual');
            setZoomPercent(Number(e.target.value));
          }}
          className="hidden sm:block w-20 h-4 accent-[#18181B] dark:accent-[#C0C0C0] cursor-pointer"
        />

        <button
          type="button"
          onClick={() => {
            setZoomMode('manual');
            setZoomPercent((p) => Math.min(200, p + 15));
          }}
          aria-label="Zoom in"
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5] cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
        </button>

        <span className="w-px h-4 mx-0.5 bg-[#E4E4E7] dark:bg-[#292929]" />

        <button
          type="button"
          onClick={() => {
            setZoomMode('fit');
            setZoomPercent(100);
            setPanOffset({ x: 0, y: 0 });
            computeFitScale();
          }}
          className={`px-2.5 h-8 sm:h-7 inline-flex items-center gap-1 rounded cursor-pointer whitespace-nowrap transition-colors ${
            zoomMode === 'fit' && panOffset.x === 0 && panOffset.y === 0
              ? 'bg-[#E4E4E7] text-[#111111] dark:bg-[#252525] dark:text-[#E5E5E5]'
              : 'text-[#52525B] dark:text-[#999999] hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
          }`}
        >
          <Maximize2 className="w-3 h-3" />
          <span>Fit</span>
        </button>

        {(panOffset.x !== 0 || panOffset.y !== 0) && (
          <button
            type="button"
            title="Center canvas position"
            onClick={() => setPanOffset({ x: 0, y: 0 })}
            className="px-2 h-8 sm:h-7 inline-flex items-center gap-1 rounded cursor-pointer whitespace-nowrap text-[#52525B] dark:text-[#C0C0C0] hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">Center</span>
          </button>
        )}
      </div>
    </div>
  );
};
