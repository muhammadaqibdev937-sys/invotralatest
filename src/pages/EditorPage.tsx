import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Download,
  EyeOff,
  Group,
  HelpCircle,
  Lock,
  Plus,
  SlidersHorizontal,
  Trash2,
  Ungroup,
  Unlock,
  X,
} from 'lucide-react';
import { ClearConfirmModal } from '../components/Editor/ClearConfirmModal';
import { EditorDiagnosticFooter } from '../components/Editor/EditorDiagnosticFooter';
import { ResetConfirmModal } from '../components/Editor/ResetConfirmModal';
import { ExportPanel } from '../components/ExportPanel/ExportPanel';
import { FieldPanel, NavSectionId } from '../components/FieldPanel/FieldPanel';
import { FontFamilyDropdown } from '../components/FontPicker/FontFamilyDropdown';
import { FontUploadModal } from '../components/FontPicker/FontUploadModal';
import { GoogleFontsPicker } from '../components/FontPicker/GoogleFontsPicker';
import { HelpModal } from '../components/HelpModal/HelpModal';
import { InvitationCanvas } from '../components/InvitationCanvas/InvitationCanvas';
import { RightInspector } from '../components/RightInspector/RightInspector';
import { EditorTopBar } from '../components/Toolbar/EditorTopBar';
import { clearFontAvailabilityCache } from '../engine/fonts';
import { LoadedTemplateV1, TextAnchor } from '../engine/schema';
import {
  AlignMode,
  AlignReference,
  computeAlignDeltas,
  computeDistributeDeltas,
  DistributeAxis,
  RectBox,
} from '../engine/snapping';
import {
  canReorderNode,
  cloneNodesForClipboard,
  collectAllNodes,
  collectTextNodesWithAncestors,
  createNewTextNode,
  estimateNodeLocalCenter,
  findNodeWithAncestors,
  getEffectiveNodeProp,
  getTextNodeProperties,
  normalizeColorToHex,
  resolveTransformPivotPatch,
  scanSceneFontUsage,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
} from '../engine/svgScene';
import { useEditorState } from '../hooks/useEditorState';
import { usePersistedUploadedFonts } from '../hooks/usePersistedUploadedFonts';
import { useTheme } from '../hooks/useTheme';
import { ensureFontsLoaded, getFontDefinition } from '../services/fontLoader';


function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

interface EditorPageProps {
  template: LoadedTemplateV1;
  onClearDesign: (designId: string) => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({ template, onClearDesign }) => {
  useTheme();
  const {
    docState,
    saveStatus,
    lastSavedAt,
    storageAvailable,
    restoredFromDraft,
    dismissRestoredNotice,
    canUndo,
    canRedo,
    updateTextNode,
    applyBatchTextUpdates,
    addTextNode,
    updateNodeTransform,
    setNodeFill,
    setNodeStroke,
    setNodeStrokeWidth,
    setNodeOpacity,
    renameNode,
    toggleNodeVisibility,
    toggleNodeLock,
    duplicateNodes,
    deleteNodes,
    reorderNode,
    groupNodes,
    ungroupNode,
    recolorSwatchHex,
    applyCoordinatedPalette,
    applyBackground,
    setTransparentBackground,
    insertSceneNode,
    replaceNodeWithPreset,
    replaceImageSource,
    setImageFitMode,
    setNodeCornerRadius,
    pasteClipboardNodes,
    batchUpdateTransforms,
    setBackgroundImage,
    removeBackgroundNode,
    undo,
    redo,
    resetToOriginal,
    commitUndoBoundary,
  } = useEditorState(template);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleSelectNodes = useCallback((ids: string[]) => {
    setSelectedIds((prev) =>
      prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids
    );
  }, []);
  const [clipboardNodes, setClipboardNodes] = useState<SvgSceneNode[]>([]);
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSectionId>('text');
  const [mobileSection, setMobileSection] = useState<'studio' | 'inspector'>('studio');
  const [previewOverride, setPreviewOverride] = useState<{
    nodeId: string;
    fontFamily: string;
  } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isFontPickerModalOpen, setIsFontPickerModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [mobilePreviewCollapsed, setMobilePreviewCollapsed] = useState(false);
  const [fontUploadModal, setFontUploadModal] = useState<{
    open: boolean;
    preferredMissingFont?: string;
  }>({ open: false });
  const [fontRegistryVersion, setFontRegistryVersion] = useState(0);
  const { fontRegistryVersion: persistedFontVersion } = usePersistedUploadedFonts();
  const effectiveFontRegistryVersion = fontRegistryVersion + persistedFontVersion;

  const boxReadersRef = useRef<Set<(ids: string[]) => Record<string, RectBox>>>(new Set());
  const registerBoxReader = useCallback(
    (reader: (ids: string[]) => Record<string, RectBox>) => {
      boxReadersRef.current.add(reader);
      return () => {
        boxReadersRef.current.delete(reader);
      };
    },
    []
  );

  const readCanvasBoxes = useCallback((ids: string[]): Record<string, RectBox> => {
    for (const reader of boxReadersRef.current) {
      const res = reader(ids);
      if (Object.keys(res).length > 0) return res;
    }
    return {};
  }, []);

  const pivotReadersRef = useRef<Set<(id: string) => { x: number; y: number } | null>>(new Set());
  const registerPivotReader = useCallback(
    (reader: (id: string) => { x: number; y: number } | null) => {
      pivotReadersRef.current.add(reader);
      return () => {
        pivotReadersRef.current.delete(reader);
      };
    },
    []
  );


  // Select initial element when loading a new SVG
  useEffect(() => {
    const texts = collectTextNodesWithAncestors(template.originalScene.nodes);
    if (texts[0]) {
      setSelectedIds([texts[0].node.id]);
      setActiveNav('text');
    } else {
      const firstNonBg = collectAllNodes(template.originalScene.nodes).find(
        (n) => !n.isBackground
      );
      setSelectedIds(firstNonBg ? [firstNonBg.id] : []);
      setActiveNav('elements');
    }
    setClipboardNodes([]);
    setIsPreviewMode(false);
    setPreviewOverride(null);
    setIsFontPickerModalOpen(false);
    setToolMode('select');
  }, [template.id, template.originalScene]);

  // Keep selectedIds valid after undo/redo/delete
  useEffect(() => {
    if (!docState) return;
    const allIds = new Set(collectAllNodes(docState.scene.nodes).map((n) => n.id));
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => allIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [docState]);

  const scene = docState?.scene ?? null;

  const readNodeLocalPivot = useCallback(
    (node: SvgSceneNode): { x: number; y: number } | null => {
      for (const reader of pivotReadersRef.current) {
        const res = reader(node.id);
        if (res) return res;
      }
      if (!scene) return null;
      return estimateNodeLocalCenter(node, scene);
    },
    [scene]
  );

  const textEntries = useMemo(
    () => (scene ? collectTextNodesWithAncestors(scene.nodes) : []),
    [scene]
  );

  // Ensure all active bundled and automatic fallback preview fonts are loaded (debounced during rapid typing)
  useEffect(() => {
    if (!scene || textEntries.length === 0) return;
    const timer = window.setTimeout(() => {
      const reqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }> = [];
      for (const { node, ancestors } of textEntries) {
        const p = getTextNodeProperties(node, scene.cssRules, ancestors);
        const def =
          getFontDefinition(p.fontFamily) ??
          (p.isFontFallback ? getFontDefinition(p.fallbackPreviewFamily) : undefined);
        if (def) {
          reqs.push({ family: def.family, weight: p.fontWeight, style: p.fontStyle });
        }
      }
      if (reqs.length > 0) {
        void ensureFontsLoaded(reqs).catch((err) => {
          console.warn('[EditorPage] Font preload warning:', err);
        });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [scene, textEntries]);

  const primaryId = selectedIds[0] ?? null;
  const prevPrimaryIdRef = useRef<string | null>(primaryId);
  useEffect(() => {
    if (prevPrimaryIdRef.current !== primaryId) {
      prevPrimaryIdRef.current = primaryId;
      commitUndoBoundary();
    }
  }, [primaryId, commitUndoBoundary]);
  const primaryInfo = useMemo(
    () => (scene && primaryId ? findNodeWithAncestors(scene.nodes, primaryId) : null),
    [scene, primaryId]
  );
  const primaryNode = primaryInfo?.node ?? null;

  const primaryTextProps = useMemo(
    () =>
      scene && primaryInfo && primaryInfo.node.tag === 'text'
        ? getTextNodeProperties(primaryInfo.node, scene.cssRules, primaryInfo.ancestors)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, primaryInfo, effectiveFontRegistryVersion]
  );

  const handleAddTextPreset = (preset: 'heading' | 'subheading' | 'body') => {
    if (!scene) return;
    const defaultCopy =
      preset === 'heading'
        ? 'Your Heading'
        : preset === 'subheading'
        ? 'Subheading Text'
        : 'Details and celebration wording';
    const base = createNewTextNode(scene, defaultCopy);
    const size =
      preset === 'heading'
        ? Math.max(42, Math.round(scene.vbH * 0.05))
        : preset === 'subheading'
        ? Math.max(24, Math.round(scene.vbH * 0.026))
        : Math.max(16, Math.round(scene.vbH * 0.018));

    const styled: SvgSceneNode = {
      ...base,
      label:
        preset === 'heading'
          ? 'Heading'
          : preset === 'subheading'
          ? 'Subheading'
          : 'Body Text',
      attrs: {
        ...base.attrs,
        'font-size': String(size),
        'font-weight': preset === 'heading' ? '700' : preset === 'subheading' ? '500' : '400',
        'font-family': preset === 'body' ? 'Lato' : 'Cormorant Garamond',
      },
    };
    insertSceneNode(styled, 'top');
    setSelectedIds([styled.id]);
    setActiveNav('text');
    setToolMode('select');
    setIsPreviewMode(false);
  };

  const handleQuickAddText = () => {
    const createdId = addTextNode('Your Custom Text');
    if (createdId) {
      setSelectedIds([createdId]);
      setActiveNav('text');
      setToolMode('select');
      setIsPreviewMode(false);
    }
  };

  const handleCopy = (ids: string[]) => {
    if (!scene || ids.length === 0) return;
    const cloned = cloneNodesForClipboard(scene.nodes, new Set(ids));
    if (cloned.length > 0) {
      setClipboardNodes(cloned);
    }
  };

  const handlePaste = () => {
    if (clipboardNodes.length === 0) return;
    const created = pasteClipboardNodes(clipboardNodes);
    if (created.length > 0) {
      setSelectedIds(created);
    }
  };

  const handleDuplicate = (ids: string[]) => {
    const created = duplicateNodes(ids);
    if (created.length > 0) {
      setSelectedIds(created);
    }
  };

  const handleDelete = (ids: string[]) => {
    if (!scene || ids.length === 0) return;
    deleteNodes(ids);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleGroup = (ids: string[]) => {
    const gid = groupNodes(ids);
    if (gid) {
      setSelectedIds([gid]);
    }
  };

  const handleUngroup = (gid: string) => {
    const childIds = ungroupNode(gid);
    if (childIds.length > 0) {
      setSelectedIds(childIds);
    }
  };

  const handleAlignNodes = useCallback(
    (ids: string[], mode: AlignMode, relativeTo: AlignReference = 'canvas') => {
      if (!scene || ids.length === 0) return;
      const boxes = readCanvasBoxes(ids);
      const entries = ids
        .map((id) => {
          const node = findNodeWithAncestors(scene.nodes, id)?.node;
          const box = boxes[id];
          return node && box && !node.locked && !node.isBackground ? { id, node, box } : null;
        })
        .filter((x): x is { id: string; node: SvgSceneNode; box: RectBox } => x !== null);

      if (entries.length === 0) return;

      const deltas = computeAlignDeltas(
        entries.map((e) => ({ id: e.id, box: e.box })),
        { x: scene.vbX, y: scene.vbY, width: scene.vbW, height: scene.vbH },
        mode,
        relativeTo
      );

      const nodeById = new Map(entries.map((e) => [e.id, e.node]));
      const updates: Array<{ nodeId: string; patch: Partial<SvgTransformState> }> = [];
      for (const delta of deltas) {
        const node = nodeById.get(delta.id);
        if (!node) continue;
        updates.push({
          nodeId: delta.id,
          patch: {
            tx: Math.round((node.transform.tx + delta.dx) * 10) / 10,
            ty: Math.round((node.transform.ty + delta.dy) * 10) / 10,
          },
        });
      }
      batchUpdateTransforms(updates);
    },
    [scene, readCanvasBoxes, batchUpdateTransforms]
  );

  const handleDistributeNodes = useCallback(
    (ids: string[], axis: DistributeAxis) => {
      if (!scene || ids.length < 3) return;
      const boxes = readCanvasBoxes(ids);
      const entries = ids
        .map((id) => {
          const node = findNodeWithAncestors(scene.nodes, id)?.node;
          const box = boxes[id];
          return node && box && !node.locked && !node.isBackground ? { id, node, box } : null;
        })
        .filter((x): x is { id: string; node: SvgSceneNode; box: RectBox } => x !== null);

      if (entries.length < 3) return;

      const deltas = computeDistributeDeltas(
        entries.map((e) => ({ id: e.id, box: e.box })),
        axis
      );

      const nodeById = new Map(entries.map((e) => [e.id, e.node]));
      const updates: Array<{ nodeId: string; patch: Partial<SvgTransformState> }> = [];
      for (const delta of deltas) {
        const node = nodeById.get(delta.id);
        if (!node) continue;
        updates.push({
          nodeId: delta.id,
          patch:
            axis === 'horizontal'
              ? { tx: Math.round((node.transform.tx + delta.dx) * 10) / 10 }
              : { ty: Math.round((node.transform.ty + delta.dy) * 10) / 10 },
        });
      }
      batchUpdateTransforms(updates);
    },
    [scene, readCanvasBoxes, batchUpdateTransforms]
  );

  const handleFlipNode = useCallback(
    (nodeId: string, axis: 'x' | 'y') => {
      if (!scene) return;
      const node = findNodeWithAncestors(scene.nodes, nodeId)?.node;
      if (!node || node.locked) return;
      const localCenter = readNodeLocalPivot(node) ?? estimateNodeLocalCenter(node, scene);
      const pivotPatch = resolveTransformPivotPatch(node, localCenter);
      updateNodeTransform(nodeId, {
        ...pivotPatch,
        ...(axis === 'x'
          ? { scaleX: -node.transform.scaleX }
          : { scaleY: -node.transform.scaleY }),
      });
    },
    [scene, readNodeLocalPivot, updateNodeTransform]
  );

  const handleRotateStep = useCallback(
    (nodeId: string, deltaDeg: number) => {
      if (!scene) return;
      const node = findNodeWithAncestors(scene.nodes, nodeId)?.node;
      if (!node || node.locked) return;
      const localCenter = readNodeLocalPivot(node) ?? estimateNodeLocalCenter(node, scene);
      const pivotPatch = resolveTransformPivotPatch(node, localCenter);
      let nextRot = node.transform.rotation + deltaDeg;
      while (nextRot > 180) nextRot -= 360;
      while (nextRot < -180) nextRot += 360;
      updateNodeTransform(nodeId, {
        ...pivotPatch,
        rotation: Math.round(nextRot * 10) / 10,
      });
    },
    [scene, readNodeLocalPivot, updateNodeTransform]
  );

  const handleInspectorTransformUpdate = useCallback(
    (nodeId: string, patch: Partial<SvgTransformState>, coalesce = false) => {
      if (
        scene &&
        !('pivotX' in patch) &&
        !('pivotY' in patch) &&
        (patch.scaleX !== undefined || patch.scaleY !== undefined || patch.rotation !== undefined)
      ) {
        const node = findNodeWithAncestors(scene.nodes, nodeId)?.node;
        if (node && (node.transform.pivotX === undefined || node.transform.pivotY === undefined)) {
          const localCenter = readNodeLocalPivot(node) ?? estimateNodeLocalCenter(node, scene);
          const pivotPatch = resolveTransformPivotPatch(node, localCenter);
          updateNodeTransform(nodeId, { ...pivotPatch, ...patch }, coalesce);
          return;
        }
      }
      updateNodeTransform(nodeId, patch, coalesce);
    },
    [scene, readNodeLocalPivot, updateNodeTransform]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const lower = e.key.toLowerCase();

      if (mod && lower === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((mod && lower === 'z' && e.shiftKey) || (mod && lower === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (isTypingElement(e.target)) return;

      if (mod && lower === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        handleCopy(selectedIds);
        return;
      }

      if (mod && lower === 'v' && clipboardNodes.length > 0) {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (mod && lower === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        handleDuplicate(selectedIds);
        return;
      }

      if (mod && lower === 'g' && !e.shiftKey && selectedIds.length >= 2) {
        e.preventDefault();
        handleGroup(selectedIds);
        return;
      }

      if (mod && lower === 'g' && e.shiftKey && primaryNode?.tag === 'g') {
        e.preventDefault();
        handleUngroup(primaryNode.id);
        return;
      }

      if (mod && lower === 'a' && !isPreviewMode && scene) {
        e.preventDefault();
        const selectableIds = scene.nodes
          .filter((n) => n.visible && !n.locked && !n.isBackground && !n.isPreservedUnsupported)
          .map((n) => n.id);
        setSelectedIds(selectableIds);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !isPreviewMode) {
        e.preventDefault();
        handleDelete(selectedIds);
        return;
      }

      if (e.key === 'Escape') {
        if (isPreviewMode) setIsPreviewMode(false);
        else setSelectedIds([]);
        return;
      }

      if (!mod && lower === 'v') {
        setToolMode('select');
        return;
      }
      if (!mod && lower === 'h') {
        setToolMode('pan');
        return;
      }

      if (
        scene &&
        !isPreviewMode &&
        selectedIds.length > 0 &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const updates: Array<{ nodeId: string; patch: Partial<SvgTransformState> }> = [];
        for (const id of selectedIds) {
          const n = findNodeWithAncestors(scene.nodes, id)?.node;
          if (!n || n.locked) continue;
          updates.push({
            nodeId: id,
            patch: {
              tx: Math.round((n.transform.tx + dx) * 10) / 10,
              ty: Math.round((n.transform.ty + dy) * 10) / 10,
            },
          });
        }
        batchUpdateTransforms(updates);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedIds, clipboardNodes, scene, isPreviewMode, primaryNode]);

  if (!docState || !scene) {
    return null;
  }

  const canForward = primaryNode ? canReorderNode(scene.nodes, primaryNode.id, 'forward') : false;
  const canBackward = primaryNode ? canReorderNode(scene.nodes, primaryNode.id, 'backward') : false;

  const primaryFillHex = primaryNode
    ? normalizeColorToHex(
        getEffectiveNodeProp(primaryNode, 'fill', scene.cssRules, primaryInfo?.ancestors ?? [])
      )
    : null;
  const primaryStrokeHex = primaryNode
    ? normalizeColorToHex(
        getEffectiveNodeProp(primaryNode, 'stroke', scene.cssRules, primaryInfo?.ancestors ?? [])
      )
    : null;

  const handleConfirmClearDesign = () => {
    resetToOriginal();
    onClearDesign(template.id);
  };

  // Allow tapping outside inputs/textareas on mobile or desktop to close keyboard and finish editing
  const handleRootPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const activeTag = active.tagName.toLowerCase();
    if (activeTag !== 'input' && activeTag !== 'textarea' && !active.isContentEditable) {
      return;
    }
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target === active || target.closest('input, textarea, select, [contenteditable="true"], button, a, label, [data-direct-text-editor="true"]')) {
      return;
    }
    active.blur();
  };

  return (
    <div
      onPointerDown={handleRootPointerDown}
      className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#F4F4F5] text-[#111111] dark:bg-[#090909] dark:text-[#F5F5F5]"
    >
      <EditorTopBar
        templateName={template.name}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        canUndo={canUndo}
        canRedo={canRedo}
        isPreviewMode={isPreviewMode}
        onTogglePreviewMode={() => setIsPreviewMode((p) => !p)}
        onUndo={undo}
        onRedo={redo}
        onReset={() => setIsResetOpen(true)}
        onClearDesign={() => setIsClearOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenDownload={() => setIsExportModalOpen(true)}
      />

      {isPreviewMode && (
        <div className="px-4 sm:px-6 py-1.5 border-b text-xs flex items-center justify-between gap-3 shrink-0 bg-[#FAFAFA] border-[#D4D4D8] text-[#111111] dark:bg-[#151515] dark:border-[#C0C0C0]/40 dark:text-[#E5E5E5]">
          <span className="truncate">
            Preview Mode — viewing clean design without selection handles or guides.
          </span>
          <button
            type="button"
            onClick={() => setIsPreviewMode(false)}
            className="px-2.5 py-1 rounded border border-[#18181B] bg-[#18181B] text-white dark:border-[#E5E5E5] dark:bg-[#E5E5E5] dark:text-[#090909] font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Back to Editing</span>
          </button>
        </div>
      )}

      {!isPreviewMode && restoredFromDraft && (
        <div className="px-4 sm:px-6 py-1.5 border-b text-xs flex items-center justify-between gap-3 shrink-0 bg-[#FAFAFA] border-[#E4E4E7] text-[#111111] dark:bg-[#151515] dark:border-[#292929] dark:text-[#E5E5E5]">
          <p className="truncate">
            Saved draft restored automatically from this browser.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="underline text-[#3F3F46] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] cursor-pointer transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={dismissRestoredNotice}
              aria-label="Dismiss restored draft notice"
              className="p-0.5 rounded hover:bg-[#E4E4E7] dark:hover:bg-[#252525] text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5] cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {!storageAvailable && (
        <div className="px-4 py-2 border-b text-xs flex items-center justify-center gap-2 shrink-0 bg-[#FAFAFA] border-[#E4E4E7] text-[#52525B] dark:bg-[#151515] dark:border-[#292929] dark:text-[#999999]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#3F3F46] dark:text-[#C0C0C0]" />
          <span>Browser storage unavailable. Download your SVG when finished.</span>
        </div>
      )}

      {/* DESKTOP 3-PANE SVG STUDIO */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {!isPreviewMode && (
          <aside
            aria-label="Studio Library"
            className="w-[384px] border-r overflow-hidden shrink-0 bg-white border-[#E4E4E7] dark:bg-[#101010] dark:border-[#292929]"
          >
            <FieldPanel
              scene={scene}
              transparentBackground={docState.transparentBackground}
              selectedIds={selectedIds}
              activeNav={activeNav}
              onChangeNav={setActiveNav}
              onSelectNodes={handleSelectNodes}
              onUpdateTextNode={updateTextNode}
              onCommitTextBoundary={commitUndoBoundary}
              onApplyBatchTextUpdates={applyBatchTextUpdates}
              onAddTextPreset={handleAddTextPreset}
              onInsertSceneNode={insertSceneNode}
              onSetNodeFill={setNodeFill}
              onSetNodeStroke={setNodeStroke}
              onSetNodeStrokeWidth={setNodeStrokeWidth}
              onToggleVisibility={toggleNodeVisibility}
              onToggleLock={toggleNodeLock}
              onDeleteNodes={handleDelete}
              onRecolorSwatchHex={recolorSwatchHex}
              onApplyCoordinatedPalette={applyCoordinatedPalette}
              onApplyBackground={applyBackground}
              onSetTransparentBackground={setTransparentBackground}
              onSetBackgroundImage={setBackgroundImage}
              onRemoveBackgroundNode={removeBackgroundNode}
              onOpenFontStudio={() => setIsFontPickerModalOpen(true)}
              onOpenUploadFont={(preferredMissingFont) =>
                setFontUploadModal({ open: true, preferredMissingFont })
              }
              fontRegistryVersion={effectiveFontRegistryVersion}
            />
          </aside>
        )}

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Quick Contextual Action Bar */}
          {!isPreviewMode && (
            <div className="px-4 py-2 border-b border-[#E4E4E7] dark:border-[#292929] bg-white dark:bg-[#101010] flex flex-wrap items-center justify-between gap-2 shrink-0">
              {selectedIds.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                    {selectedIds.length} selected
                  </span>
                  <span className="text-[#D4D4D8] dark:text-[#292929]">|</span>
                  <button
                    type="button"
                    onClick={() => handleGroup(selectedIds)}
                    className="h-[30px] px-2.5 rounded-md border border-[#18181B] bg-[#18181B] hover:bg-[#3F3F46] text-white dark:border-[#E5E5E5] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:text-[#090909] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Group className="w-3.5 h-3.5" />
                    <span>Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedIds)}
                    className="h-[30px] px-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#E4E4E7] text-xs text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#F5F5F5] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedIds)}
                    className="h-[30px] px-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#E4E4E7] text-xs text-[#3F3F46] hover:text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              ) : primaryNode ? (
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5] truncate max-w-[130px]">
                    {primaryNode.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A] dark:text-[#737373]">
                    &lt;{primaryNode.rawTag || primaryNode.tag}&gt;
                  </span>

                  {primaryNode.tag === 'text' && primaryTextProps && !primaryNode.locked && (
                    <>
                      <span className="text-[#D4D4D8] dark:text-[#292929]">|</span>
                      <FontFamilyDropdown
                        nodeId={primaryNode.id}
                        nodeLabel={primaryNode.label}
                        textPreview={primaryTextProps.fullText}
                        currentFontFamily={primaryTextProps.fontFamily}
                        currentFontWeight={primaryTextProps.fontWeight}
                        currentFontStyle={primaryTextProps.fontStyle}
                        align="left"
                        onSelectFont={(nid, patch) => updateTextNode(nid, patch)}
                        onPreviewFont={(nid, fontFamily) =>
                          setPreviewOverride(fontFamily ? { nodeId: nid, fontFamily } : null)
                        }
                        onOpenFullStudio={() => setIsFontPickerModalOpen(true)}
                      />
                      <div
                        role="group"
                        aria-label="Text alignment"
                        className="inline-flex items-center rounded-md border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] overflow-hidden shrink-0"
                      >
                        {(
                          [
                            { val: 'start', label: 'Align left', icon: <AlignLeft className="w-3.5 h-3.5" /> },
                            { val: 'middle', label: 'Align center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                            { val: 'end', label: 'Align right', icon: <AlignRight className="w-3.5 h-3.5" /> },
                          ] as Array<{ val: TextAnchor; label: string; icon: React.ReactNode }>
                        ).map((item, idx) => {
                          const active = primaryTextProps.textAnchor === item.val;
                          return (
                            <button
                              key={item.val}
                              type="button"
                              title={item.label}
                              aria-label={item.label}
                              aria-pressed={active}
                              onClick={() =>
                                updateTextNode(primaryNode.id, { textAnchor: item.val })
                              }
                              className={`w-8 h-[30px] flex items-center justify-center cursor-pointer transition-colors ${
                                idx > 0 ? 'border-l border-[#E4E4E7] dark:border-[#292929]' : ''
                              } ${
                                active
                                  ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                                  : 'bg-transparent text-[#52525B] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#999999] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                              }`}
                            >
                              {item.icon}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {primaryNode.tag !== 'text' &&
                    primaryNode.tag !== 'image' &&
                    !primaryNode.isPreservedUnsupported &&
                    !primaryNode.locked && (
                      <>
                        <span className="text-[#D4D4D8] dark:text-[#292929]">|</span>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#52525B] dark:text-[#999999] cursor-pointer">
                          <span>Fill</span>
                          <input
                            type="color"
                            aria-label="Selected fill color"
                            value={primaryFillHex ?? '#000000'}
                            onChange={(e) =>
                              setNodeFill(primaryNode.id, e.target.value.toUpperCase(), true)
                            }
                            className="w-6 h-6 rounded border border-[#E4E4E7] dark:border-[#292929] cursor-pointer bg-white dark:bg-[#0D0D0D] p-0"
                          />
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#52525B] dark:text-[#999999] cursor-pointer">
                          <span>Stroke</span>
                          <input
                            type="color"
                            aria-label="Selected stroke color"
                            value={primaryStrokeHex ?? '#28251F'}
                            onChange={(e) => {
                              setNodeStroke(primaryNode.id, e.target.value.toUpperCase(), true);
                              if (!primaryStrokeHex) setNodeStrokeWidth(primaryNode.id, 2, true);
                            }}
                            className="w-6 h-6 rounded border border-[#E4E4E7] dark:border-[#292929] cursor-pointer bg-white dark:bg-[#0D0D0D] p-0"
                          />
                        </label>
                      </>
                    )}

                  {primaryNode.tag === 'g' && !primaryNode.locked && (
                    <button
                      type="button"
                      onClick={() => handleUngroup(primaryNode.id)}
                      title="Ungroup elements"
                      className="h-[30px] px-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#E4E4E7] text-xs text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#E5E5E5] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Ungroup className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">Ungroup</span>
                    </button>
                  )}

                  {!primaryNode.isPreservedUnsupported && (
                    <>
                      <span className="text-[#D4D4D8] dark:text-[#292929]">|</span>
                      <div
                        role="group"
                        aria-label="Layer order"
                        className="inline-flex items-center rounded-md border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] overflow-hidden shrink-0"
                      >
                        <button
                          type="button"
                          title="Bring Forward"
                          aria-label="Bring Forward"
                          disabled={!canForward}
                          onClick={() => reorderNode(primaryNode.id, 'forward')}
                          className="w-7 h-[30px] flex items-center justify-center text-[#3F3F46] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Send Backward"
                          aria-label="Send Backward"
                          disabled={!canBackward}
                          onClick={() => reorderNode(primaryNode.id, 'backward')}
                          className="w-7 h-[30px] border-l border-[#E4E4E7] dark:border-[#292929] flex items-center justify-center text-[#3F3F46] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        title="Duplicate (Ctrl+D)"
                        aria-label="Duplicate selected element"
                        onClick={() => handleDuplicate([primaryNode.id])}
                        className="w-8 h-[30px] rounded-md border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#E4E4E7] flex items-center justify-center text-[#3F3F46] hover:text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        title={primaryNode.locked ? 'Unlock element' : 'Lock element'}
                        aria-label={primaryNode.locked ? 'Unlock element' : 'Lock element'}
                        onClick={() => toggleNodeLock(primaryNode.id)}
                        className={`w-8 h-[30px] rounded-md border flex items-center justify-center cursor-pointer transition-colors ${
                          primaryNode.locked
                            ? 'bg-[#18181B] border-[#18181B] text-white dark:bg-[#E5E5E5] dark:border-[#E5E5E5] dark:text-[#090909]'
                            : 'bg-[#FAFAFA] border-[#E4E4E7] text-[#3F3F46] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#151515] dark:border-[#292929] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                        }`}
                      >
                        {primaryNode.locked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#52525B] dark:text-[#999999] truncate">
                  Click any text to edit in place &middot; Drag to move &middot; Right-click for actions
                </div>
              )}

              {clipboardNodes.length > 0 && (
                <button
                  type="button"
                  onClick={handlePaste}
                  title="Paste copied elements (Ctrl+V)"
                  className="h-[30px] px-2.5 rounded-md border border-[#A1A1AA] bg-[#FAFAFA] hover:bg-[#E4E4E7] text-xs font-medium text-[#111111] dark:border-[#C0C0C0]/60 dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#F5F5F5] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5]" />
                  <span>Paste ({clipboardNodes.length})</span>
                </button>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0">
            <InvitationCanvas
              designId={template.id}
              scene={scene}
              transparentBackground={docState.transparentBackground}
              selectedIds={selectedIds}
              toolMode={toolMode}
              isPreviewMode={isPreviewMode}
              previewOverride={previewOverride}
              snapEnabled={true}
              showGrid={false}
              gridPreset="medium"
              hasClipboard={clipboardNodes.length > 0}
              onChangeToolMode={setToolMode}
              onSelectNodes={handleSelectNodes}
              onSelectBackground={() => setActiveNav('background')}
              onUpdateNodeTransform={updateNodeTransform}
              onBatchUpdateTransforms={batchUpdateTransforms}
              onUpdateTextNode={updateTextNode}
              onCommitTextBoundary={commitUndoBoundary}
              onDirectTextEdit={(nid) => {
                handleSelectNodes([nid]);
                setActiveNav('text');
              }}
              onDoubleClickTextNode={(nid) => {
                handleSelectNodes([nid]);
                setActiveNav('text');
              }}
              onCopyNodes={handleCopy}
              onPasteNodes={handlePaste}
              onDuplicateNodes={handleDuplicate}
              onDeleteNodes={handleDelete}
              onToggleLock={toggleNodeLock}
              onToggleVisibility={toggleNodeVisibility}
              onReorderNode={reorderNode}
              onFlipNode={handleFlipNode}
              onCenterNode={(nid) => handleAlignNodes([nid], 'center-both', 'canvas')}
              onRegisterBoxReader={registerBoxReader}
              onRegisterPivotReader={registerPivotReader}
            />
          </div>
        </main>

        {!isPreviewMode && (
          <RightInspector
            scene={scene}
            transparentBackground={docState.transparentBackground}
            selectedIds={selectedIds}
            onSelectNodes={handleSelectNodes}
            onUpdateTextNode={updateTextNode}
            onCommitTextBoundary={commitUndoBoundary}
            onUpdateNodeTransform={handleInspectorTransformUpdate}
            onSetNodeFill={setNodeFill}
            onSetNodeStroke={setNodeStroke}
            onSetNodeStrokeWidth={setNodeStrokeWidth}
            onSetNodeOpacity={setNodeOpacity}
            onSetNodeCornerRadius={setNodeCornerRadius}
            onReplaceImageSource={replaceImageSource}
            onSetImageFitMode={setImageFitMode}
            onReplaceNodeWithPreset={replaceNodeWithPreset}
            onRenameNode={renameNode}
            onToggleVisibility={toggleNodeVisibility}
            onToggleLock={toggleNodeLock}
            onDuplicateNodes={handleDuplicate}
            onCopyNodes={handleCopy}
            onDeleteNodes={handleDelete}
            onReorderNode={reorderNode}
            onGroupNodes={handleGroup}
            onUngroupNode={handleUngroup}
            onAlignNodes={handleAlignNodes}
            onDistributeNodes={handleDistributeNodes}
            onFlipNode={handleFlipNode}
            onRotateStep={handleRotateStep}
            clipboardCount={clipboardNodes.length}
            onPasteNodes={handlePaste}
            onApplyBackground={applyBackground}
            onSetTransparentBackground={setTransparentBackground}
            onPreviewFont={(nodeId, fontFamily) =>
              setPreviewOverride(fontFamily ? { nodeId, fontFamily } : null)
            }
            onOpenFontStudio={() => setIsFontPickerModalOpen(true)}
            onOpenUploadFont={(preferredMissingFont) =>
              setFontUploadModal({ open: true, preferredMissingFont })
            }
            onOpenBackgroundTab={() => setActiveNav('background')}
          />
        )}
      </div>

      {/* MOBILE / TABLET RESPONSIVE STUDIO */}
      <div className="flex lg:hidden flex-col flex-1 min-h-0">
        <div className="sticky top-0 z-20 border-b bg-white border-[#E4E4E7] dark:bg-[#101010] dark:border-[#292929]">
          {!mobilePreviewCollapsed && (
            <div className="h-[36vh] min-h-[220px] max-h-[340px]">
              <InvitationCanvas
                designId={template.id}
                scene={scene}
                transparentBackground={docState.transparentBackground}
                selectedIds={selectedIds}
                toolMode={toolMode}
                isPreviewMode={isPreviewMode}
                previewOverride={previewOverride}
                snapEnabled={true}
                showGrid={false}
                gridPreset="medium"
                hasClipboard={clipboardNodes.length > 0}
                onChangeToolMode={setToolMode}
                onSelectNodes={handleSelectNodes}
                onSelectBackground={() => setActiveNav('background')}
                onUpdateNodeTransform={updateNodeTransform}
                onBatchUpdateTransforms={batchUpdateTransforms}
                onUpdateTextNode={updateTextNode}
                onCommitTextBoundary={commitUndoBoundary}
                onDirectTextEdit={(nid) => {
                  handleSelectNodes([nid]);
                }}
                onDoubleClickTextNode={(nid) => {
                  handleSelectNodes([nid]);
                  setActiveNav('text');
                  setMobileSection('studio');
                }}
                onCopyNodes={handleCopy}
                onPasteNodes={handlePaste}
                onDuplicateNodes={handleDuplicate}
                onDeleteNodes={handleDelete}
                onToggleLock={toggleNodeLock}
                onToggleVisibility={toggleNodeVisibility}
                onReorderNode={reorderNode}
                onFlipNode={handleFlipNode}
                onCenterNode={(nid) => handleAlignNodes([nid], 'center-both', 'canvas')}
                onRegisterBoxReader={registerBoxReader}
                onRegisterPivotReader={registerPivotReader}
              />
            </div>
          )}

          <div className="px-4 py-1.5 min-h-[42px] flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#101010]">
            <button
              type="button"
              onClick={() => setMobilePreviewCollapsed((c) => !c)}
              className="min-h-[34px] flex items-center gap-1.5 text-xs font-medium cursor-pointer text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5] transition-colors"
            >
              <span>{mobilePreviewCollapsed ? 'Show Live SVG' : 'Hide Canvas'}</span>
              {mobilePreviewCollapsed ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded border border-[#E4E4E7] dark:border-[#292929] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMobileSection('studio')}
                  className={`px-2.5 h-7 text-[11px] font-medium cursor-pointer ${
                    mobileSection === 'studio'
                      ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                      : 'bg-[#FAFAFA] text-[#3F3F46] dark:bg-[#151515] dark:text-[#C0C0C0]'
                  }`}
                >
                  Panels
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSection('inspector')}
                  className={`px-2.5 h-7 text-[11px] font-medium inline-flex items-center gap-1 border-l border-[#E4E4E7] dark:border-[#292929] cursor-pointer ${
                    mobileSection === 'inspector'
                      ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                      : 'bg-[#FAFAFA] text-[#3F3F46] dark:bg-[#151515] dark:text-[#C0C0C0]'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Inspector</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleQuickAddText}
                className="min-h-[30px] px-2.5 rounded border border-[#E4E4E7] bg-[#FAFAFA] hover:bg-[#E4E4E7] text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#E5E5E5] inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[#52525B] dark:text-[#C0C0C0]" />
                <span>Text</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#FAFAFA] dark:bg-[#151515]">
          {mobileSection === 'studio' ? (
            <FieldPanel
              scene={scene}
              transparentBackground={docState.transparentBackground}
              selectedIds={selectedIds}
              activeNav={activeNav}
              onChangeNav={setActiveNav}
              onSelectNodes={handleSelectNodes}
              onUpdateTextNode={updateTextNode}
              onCommitTextBoundary={commitUndoBoundary}
              onApplyBatchTextUpdates={applyBatchTextUpdates}
              onAddTextPreset={handleAddTextPreset}
              onInsertSceneNode={insertSceneNode}
              onSetNodeFill={setNodeFill}
              onSetNodeStroke={setNodeStroke}
              onSetNodeStrokeWidth={setNodeStrokeWidth}
              onToggleVisibility={toggleNodeVisibility}
              onToggleLock={toggleNodeLock}
              onDeleteNodes={handleDelete}
              onRecolorSwatchHex={recolorSwatchHex}
              onApplyCoordinatedPalette={applyCoordinatedPalette}
              onApplyBackground={applyBackground}
              onSetTransparentBackground={setTransparentBackground}
              onSetBackgroundImage={setBackgroundImage}
              onRemoveBackgroundNode={removeBackgroundNode}
              onOpenFontStudio={() => setIsFontPickerModalOpen(true)}
              onOpenUploadFont={(preferredMissingFont) =>
                setFontUploadModal({ open: true, preferredMissingFont })
              }
              onOpenDownload={() => setIsExportModalOpen(true)}
              fontRegistryVersion={effectiveFontRegistryVersion}
            />
          ) : (
            <RightInspector
              scene={scene}
              transparentBackground={docState.transparentBackground}
              selectedIds={selectedIds}
              onSelectNodes={handleSelectNodes}
              onUpdateTextNode={updateTextNode}
              onCommitTextBoundary={commitUndoBoundary}
              onUpdateNodeTransform={handleInspectorTransformUpdate}
              onSetNodeFill={setNodeFill}
              onSetNodeStroke={setNodeStroke}
              onSetNodeStrokeWidth={setNodeStrokeWidth}
              onSetNodeOpacity={setNodeOpacity}
              onSetNodeCornerRadius={setNodeCornerRadius}
              onReplaceImageSource={replaceImageSource}
              onSetImageFitMode={setImageFitMode}
              onReplaceNodeWithPreset={replaceNodeWithPreset}
              onRenameNode={renameNode}
              onToggleVisibility={toggleNodeVisibility}
              onToggleLock={toggleNodeLock}
              onDuplicateNodes={handleDuplicate}
              onCopyNodes={handleCopy}
              onDeleteNodes={handleDelete}
              onReorderNode={reorderNode}
              onGroupNodes={handleGroup}
              onUngroupNode={handleUngroup}
              onAlignNodes={handleAlignNodes}
              onDistributeNodes={handleDistributeNodes}
              onFlipNode={handleFlipNode}
              onRotateStep={handleRotateStep}
              clipboardCount={clipboardNodes.length}
              onPasteNodes={handlePaste}
              onApplyBackground={applyBackground}
              onSetTransparentBackground={setTransparentBackground}
              onPreviewFont={(nodeId, fontFamily) =>
                setPreviewOverride(fontFamily ? { nodeId, fontFamily } : null)
              }
              onOpenFontStudio={() => setIsFontPickerModalOpen(true)}
              onOpenUploadFont={(preferredMissingFont) =>
                setFontUploadModal({ open: true, preferredMissingFont })
              }
              onOpenBackgroundTab={() => {
                setActiveNav('background');
                setMobileSection('studio');
              }}
            />
          )}
        </div>

        {/* Compact Mobile Bottom Action Bar */}
        <div className="fixed bottom-0 inset-x-0 z-30 h-14 px-4 border-t flex items-center justify-between gap-2 bg-white border-[#E4E4E7] dark:bg-[#101010] dark:border-[#292929]">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="h-10 px-3 rounded-md border inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-[#FAFAFA] border-[#E4E4E7] text-[#111111] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#151515] dark:border-[#292929] dark:text-[#F5F5F5] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-[#52525B] dark:text-[#C0C0C0]" />
            <span>Help</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClearOpen(true)}
            aria-label="Clear current design"
            className="h-10 px-3 rounded-md border inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer bg-[#FAFAFA] border-[#E4E4E7] text-[#111111] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#151515] dark:border-[#292929] dark:text-[#F5F5F5] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] transition-colors"
          >
            <Trash2 className="w-4 h-4 text-[#52525B] dark:text-[#C0C0C0]" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex-1 h-10 px-4 rounded-md inline-flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer bg-[#18181B] hover:bg-[#3F3F46] text-white border border-[#18181B] hover:border-[#3F3F46] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:text-[#090909] dark:border-[#E5E5E5] dark:hover:border-[#C0C0C0] transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download SVG</span>
          </button>
        </div>
      </div>

      {/* Real-time Diagnostic Dashboard Footer */}
      <div className="pb-14 lg:pb-0">
        <EditorDiagnosticFooter
          scene={scene}
          transparentBackground={docState.transparentBackground}
          selectedCount={selectedIds.length}
          fontRegistryVersion={effectiveFontRegistryVersion}
        />
      </div>

      {/* Modals */}
      {isFontPickerModalOpen && textEntries.length > 0 && (
        <GoogleFontsPicker
          textNodes={textEntries}
          cssRules={scene.cssRules}
          selectedNodeId={primaryNode?.tag === 'text' ? primaryNode.id : textEntries[0].node.id}
          onSelectNode={(nid) => setSelectedIds([nid])}
          onUpdateTextNode={updateTextNode}
          onApplyBatchTextUpdates={applyBatchTextUpdates}
          onPreviewFont={(nodeId, fontFamily) =>
            setPreviewOverride(fontFamily ? { nodeId, fontFamily } : null)
          }
          isModal
          onCloseModal={() => setIsFontPickerModalOpen(false)}
        />
      )}

      {fontUploadModal.open && (
        <FontUploadModal
          isOpen={fontUploadModal.open}
          fontSummary={scanSceneFontUsage(scene)}
          selectedTextNodeId={primaryNode?.tag === 'text' ? primaryNode.id : null}
          selectedTextNodeLabel={primaryNode?.tag === 'text' ? primaryNode.label : undefined}
          initialMissingFont={fontUploadModal.preferredMissingFont}
          onClose={() => setFontUploadModal({ open: false })}
          onApplyUploadedFont={(nodeIds, family) => {
            clearFontAvailabilityCache();
            if (nodeIds.length > 0) {
              const batch: Record<string, TextEditPatch> = {};
              for (const nid of nodeIds) {
                batch[nid] = { fontFamily: family };
              }
              applyBatchTextUpdates(batch);
            }
            setFontRegistryVersion((v) => v + 1);
          }}
        />
      )}

      {isExportModalOpen && (
        <ExportPanel
          template={template}
          docState={docState}
          onToggleTransparent={setTransparentBackground}
          onOpenHelp={() => {
            setIsExportModalOpen(false);
            setIsHelpOpen(true);
          }}
          isModal
          onCloseModal={() => setIsExportModalOpen(false)}
        />
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <ResetConfirmModal
        isOpen={isResetOpen}
        templateName={template.name}
        onCancel={() => setIsResetOpen(false)}
        onConfirm={resetToOriginal}
      />

      <ClearConfirmModal
        isOpen={isClearOpen}
        designName={template.name}
        onCancel={() => setIsClearOpen(false)}
        onConfirm={handleConfirmClearDesign}
      />
    </div>
  );
};
