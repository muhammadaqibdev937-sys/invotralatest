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
  getTextNodeProperties,
  SvgSceneDocument,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
} from '../../engine/svgScene';
import { SvgSceneContent } from '../Canvas/SvgSceneRenderer';

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
  onDoubleClickTextNode?: (nodeId: string) => void;
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
  onDoubleClickTextNode,
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
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [fitScale, setFitScale] = useState<number>(0.34);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
  const [selectionBoxes, setSelectionBoxes] = useState<Record<string, RectBox>>({});
  const [activeRotationReadout, setActiveRotationReadout] = useState<number | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string | null;
  } | null>(null);

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
    if (isPreviewMode || (editingTextId && !selectedIds.includes(editingTextId))) {
      setEditingTextId(null);
    }
  }, [isPreviewMode, editingTextId, selectedIds]);

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

  const readNodeBoxes = useCallback(
    (ids: string[]): Record<string, RectBox> => {
      const svgEl = svgRef.current;
      if (!svgEl || ids.length === 0) return {};
      const svgRect = svgEl.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return {};
      const next: Record<string, RectBox> = {};
      for (const id of ids) {
        const targetEl = svgEl.querySelector(`[data-scene-id="${id}"]`);
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
    [vbX, vbY, vbW, vbH]
  );

  useEffect(() => {
    if (!onRegisterBoxReader) return;
    return onRegisterBoxReader(readNodeBoxes);
  }, [onRegisterBoxReader, readNodeBoxes]);

  const measureBoxes = useCallback(() => {
    if (isPreviewMode || selectedIds.length === 0) {
      setSelectionBoxes({});
      return;
    }
    setSelectionBoxes(readNodeBoxes(selectedIds));
  }, [isPreviewMode, selectedIds, readNodeBoxes]);

  useLayoutEffect(() => {
    measureBoxes();
  }, [measureBoxes, scene, fitScale, zoomMode, zoomPercent, panOffset, previewOverride]);

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

  const resolveClickableNodeId = (clickedNode: SvgSceneNode): string => {
    // If clicked element is inside a user-created group (`group_*`), select the group unless already inside it
    const info = findNodeWithAncestors(scene.nodes, clickedNode.id);
    if (!info) return clickedNode.id;
    const userGroupAncestor = info.ancestors.find(
      (anc) => anc.id.startsWith('group_') && !anc.locked
    );
    if (userGroupAncestor && !selectedIds.includes(clickedNode.id)) {
      return userGroupAncestor.id;
    }
    return clickedNode.id;
  };

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
      const targetInfo = findNodeWithAncestors(scene.nodes, targetId);
      const targetNode = targetInfo?.node ?? rawNode;

      if (e.shiftKey) {
        const next = selectedIds.includes(targetId)
          ? selectedIds.filter((id) => id !== targetId)
          : [...selectedIds, targetId];
        onSelectNodes(next);
        return;
      }

      const alreadyInMultiSelection =
        selectedIds.length > 1 && selectedIds.includes(targetId);
      if (!alreadyInMultiSelection) {
        onSelectNodes([targetId]);
      }

      if (targetNode.locked) {
        return;
      }

      const activeIds = alreadyInMultiSelection ? selectedIds : [targetId];
      const peers: Array<{ nodeId: string; origTx: number; origTy: number }> = [];
      for (const id of activeIds) {
        const n = findNodeWithAncestors(scene.nodes, id)?.node;
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
    [isPreviewMode, effectiveToolMode, selectedIds, scene.nodes, vbX, vbY, vbW, vbH, collectSnapTargets, onSelectNodes, onSelectBackground, panOffset]
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
      if (!selectedIds.includes(targetId)) {
        onSelectNodes([targetId]);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: targetId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPreviewMode, hasClipboard, selectedIds, scene.nodes, onSelectNodes]
  );

  const handleResizePointerDown = (e: React.PointerEvent<SVGRectElement>, handle: ResizeHandleId) => {
    if (!primaryId || !selectionBoxes[primaryId]) return;
    e.stopPropagation();
    const info = findNodeWithAncestors(scene.nodes, primaryId);
    const node = info?.node;
    if (!node || node.locked) return;

    const box = selectionBoxes[primaryId];
    const xform = node.transform;
    const pivotX = xform.pivotX ?? box.centerX - xform.tx;
    const pivotY = xform.pivotY ?? box.centerY - xform.ty;
    const centerX = pivotX + xform.tx;
    const centerY = pivotY + xform.ty;

    svgRef.current?.setPointerCapture?.(e.pointerId);
    interactionRef.current = {
      kind: 'resize',
      handle,
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origTransform: { ...xform },
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
    const pivotX = xform.pivotX ?? box.centerX - xform.tx;
    const pivotY = xform.pivotY ?? box.centerY - xform.ty;
    const centerX = pivotX + xform.tx;
    const centerY = pivotY + xform.ty;
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
      if (
        !act.moved &&
        (Math.abs(e.clientX - act.startClientX) > 2 || Math.abs(e.clientY - act.startClientY) > 2)
      ) {
        act.moved = true;
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
    if (act && act.kind === 'move' && !act.moved && act.peers.length > 1) {
      onSelectNodes([act.nodeId]);
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
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-auto ea-scrollbar select-none bg-[#090909] ${
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
          <svg
            ref={svgRef}
            viewBox={viewBox}
            width="100%"
            height="100%"
            preserveAspectRatio={scene.preserveAspectRatio || 'xMidYMid meet'}
            className="block w-full h-full overflow-visible"
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
          </svg>

          {!isPreviewMode && activeRotationReadout !== null && (
            <div className="pointer-events-none absolute top-2 right-2 px-2 py-1 rounded border border-[#292929] bg-[#151515]/95 text-[11px] font-mono tabular-nums text-[#F5F5F5] flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-[#C0C0C0]" />
              <span>{activeRotationReadout}°</span>
            </div>
          )}

          {/* Inline On-Canvas Text Editor */}
          {!isPreviewMode &&
            editingTextId &&
            onUpdateTextNode &&
            (() => {
              const editInfo = findNodeWithAncestors(scene.nodes, editingTextId);
              if (!editInfo || editInfo.node.tag !== 'text' || editInfo.node.locked) return null;
              const editNode = editInfo.node;
              const editProps = getTextNodeProperties(editNode, scene.cssRules, editInfo.ancestors);
              const box = selectionBoxes[editingTextId];
              const pxLeft = box
                ? Math.max(8, Math.min(displayWidth - 268, ((box.left - vbX) / vbW) * displayWidth))
                : Math.max(8, (displayWidth - 260) / 2);
              const pxTop = box
                ? Math.max(
                    8,
                    Math.min(
                      displayHeight - 130,
                      ((box.bottom - vbY) / vbH) * displayHeight + 8
                    )
                  )
                : Math.max(8, displayHeight / 2 - 40);

              return (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    left: `${pxLeft}px`,
                    top: `${pxTop}px`,
                    boxShadow: 'var(--ea-shadow-float)',
                  }}
                  className="absolute z-30 w-[260px] max-w-[calc(100vw-32px)] rounded-lg border border-[#C0C0C0] bg-[#151515] p-2.5 space-y-2 text-[#F5F5F5]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#C0C0C0] truncate inline-flex items-center gap-1.5">
                      <Type className="w-3 h-3 shrink-0" />
                      <span className="truncate">{editNode.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingTextId(null)}
                      aria-label="Close inline text editor"
                      className="px-2 py-0.5 rounded bg-[#E5E5E5] hover:bg-[#C0C0C0] text-[#090909] text-[10px] font-semibold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>

                  {editNode.tspans && editNode.tspans.length > 1 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto ea-scrollbar">
                      {editNode.tspans.map((ts, idx) => (
                        <input
                          key={ts.id}
                          type="text"
                          autoFocus={idx === 0}
                          aria-label={`Edit line ${idx + 1}`}
                          value={ts.text}
                          onChange={(e) =>
                            onUpdateTextNode(
                              editNode.id,
                              { tspanIndex: idx, tspanText: e.target.value },
                              true
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                              e.preventDefault();
                              setEditingTextId(null);
                            }
                          }}
                          className="w-full h-8 px-2 rounded border border-[#292929] bg-[#0D0D0D] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E5E5E5]"
                        />
                      ))}
                    </div>
                  ) : (
                    <textarea
                      autoFocus
                      rows={editProps.fullText.includes('\n') ? 3 : 2}
                      aria-label={`Edit ${editNode.label}`}
                      value={editProps.fullText}
                      onChange={(e) =>
                        onUpdateTextNode(editNode.id, { text: e.target.value }, true)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingTextId(null);
                        } else if (
                          e.key === 'Enter' &&
                          ((e.metaKey || e.ctrlKey) || (!e.shiftKey && !editProps.fullText.includes('\n')))
                        ) {
                          e.preventDefault();
                          setEditingTextId(null);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 rounded border border-[#292929] bg-[#0D0D0D] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#E5E5E5] resize-y"
                    />
                  )}
                  <p className="text-[10px] text-[#737373]">
                    Press Enter or click Done to finish
                  </p>
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
              className="fixed z-50 w-48 rounded-lg border border-[#292929] bg-[#151515] py-1.5 text-xs text-[#F5F5F5]"
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
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <Type className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Duplicate</span>
                      </span>
                      <span className="text-[10px] text-[#737373]">Ctrl+D</span>
                    </button>
                  )}
                  {onCopyNodes && (
                    <button
                      type="button"
                      onClick={() => {
                        onCopyNodes([ctxNode.id]);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Copy className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Copy</span>
                      </span>
                      <span className="text-[10px] text-[#737373]">Ctrl+C</span>
                    </button>
                  )}
                  {hasClipboard && onPasteNodes && (
                    <button
                      type="button"
                      onClick={() => {
                        onPasteNodes();
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ClipboardPaste className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Paste</span>
                      </span>
                      <span className="text-[10px] text-[#737373]">Ctrl+V</span>
                    </button>
                  )}

                  {!ctxNode.locked && !ctxNode.isBackground && (onFlipNode || onCenterNode) && (
                    <div className="my-1 border-t border-[#292929]" />
                  )}
                  {!ctxNode.locked && !ctxNode.isBackground && onCenterNode && (
                    <button
                      type="button"
                      onClick={() => {
                        onCenterNode(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                        className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                      >
                        <FlipHorizontal2 className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Flip Horizontal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onFlipNode(ctxNode.id, 'y');
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                      >
                        <FlipVertical2 className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Flip Vertical</span>
                      </button>
                    </>
                  )}

                  {onReorderNode && (canFwd || canBack) && (
                    <>
                      <div className="my-1 border-t border-[#292929]" />
                      {canFwd && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'front');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ChevronsUp className="w-3.5 h-3.5 text-[#C0C0C0]" />
                            <span>Bring to Front</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'forward');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                            className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-[#C0C0C0]" />
                            <span>Send Backward</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onReorderNode(ctxNode.id, 'back');
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                          >
                            <ChevronsDown className="w-3.5 h-3.5 text-[#C0C0C0]" />
                            <span>Send to Back</span>
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <div className="my-1 border-t border-[#292929]" />
                  {onToggleLock && (
                    <button
                      type="button"
                      onClick={() => {
                        onToggleLock(ctxNode.id);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      {ctxNode.locked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-[#C0C0C0]" />
                          <span>Unlock</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center gap-2 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                      className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center justify-between text-[#E5E5E5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Delete</span>
                      </span>
                      <span className="text-[10px] text-[#737373]">Del</span>
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
                    className="w-full px-3 py-1.5 text-left hover:bg-[#252525] flex items-center justify-between cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardPaste className="w-3.5 h-3.5 text-[#C0C0C0]" />
                      <span>Paste</span>
                    </span>
                    <span className="text-[10px] text-[#737373]">Ctrl+V</span>
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
        className="sticky bottom-3 z-20 cursor-default inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs font-medium mb-2 bg-[#151515] border-[#292929] text-[#F5F5F5]"
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
              ? 'bg-[#E5E5E5] text-[#090909]'
              : 'text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5]'
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
              ? 'bg-[#E5E5E5] text-[#090909]'
              : 'text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5]'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-4 mx-0.5 bg-[#292929]" />

        <button
          type="button"
          onClick={() => {
            setZoomMode('manual');
            setZoomPercent((p) => Math.max(25, p - 15));
          }}
          aria-label="Zoom out"
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded hover:bg-[#252525] hover:text-[#F5F5F5] cursor-pointer transition-colors"
        >
          <Minus className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
          className="h-7 px-1.5 rounded bg-[#0D0D0D] border border-[#292929] text-[#F5F5F5] text-xs tabular-nums cursor-pointer focus:outline-none focus:border-[#C0C0C0]"
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
          className="hidden sm:block w-20 h-4 accent-[#C0C0C0] cursor-pointer"
        />

        <button
          type="button"
          onClick={() => {
            setZoomMode('manual');
            setZoomPercent((p) => Math.min(200, p + 15));
          }}
          aria-label="Zoom in"
          className="w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded hover:bg-[#252525] hover:text-[#F5F5F5] cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-[#C0C0C0]" />
        </button>

        <span className="w-px h-4 mx-0.5 bg-[#292929]" />

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
              ? 'bg-[#252525] text-[#E5E5E5]'
              : 'text-[#999999] hover:bg-[#252525] hover:text-[#F5F5F5]'
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
            className="px-2 h-8 sm:h-7 inline-flex items-center gap-1 rounded cursor-pointer whitespace-nowrap text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5] transition-colors"
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">Center</span>
          </button>
        )}
      </div>
    </div>
  );
};
