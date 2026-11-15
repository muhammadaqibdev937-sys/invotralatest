import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  ClipboardPaste,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Folder,
  Group,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Trash2,
  Underline,
  Ungroup,
  Unlock,
  Upload,
} from 'lucide-react';
import { TextAnchor } from '../../engine/schema';
import {
  AlignMode,
  AlignReference,
  DistributeAxis,
} from '../../engine/snapping';
import {
  BackgroundConfig,
  canReorderNode,
  collectAllNodes,
  extractBackgroundConfig,
  findNodeWithAncestors,
  getEffectiveNodeProp,
  getSceneStats,
  getTextNodeProperties,
  normalizeColorToHex,
  SvgSceneDocument,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
} from '../../engine/svgScene';
import { VECTOR_PRESETS, VectorPresetItem } from '../../engine/vectorLibrary';
import { getFontDefinition } from '../../services/fontLoader';
import { FontFamilyDropdown } from '../FontPicker/FontFamilyDropdown';

export type { AlignMode, AlignReference, DistributeAxis };

interface RightInspectorProps {
  scene: SvgSceneDocument;
  transparentBackground: boolean;
  selectedIds: string[];
  onSelectNodes: (ids: string[]) => void;
  onUpdateTextNode: (nodeId: string, patch: TextEditPatch, coalesce?: boolean) => void;
  onUpdateNodeTransform: (
    nodeId: string,
    patch: Partial<SvgTransformState>,
    coalesce?: boolean
  ) => void;
  onSetNodeFill: (nodeId: string, fill: string, coalesce?: boolean) => void;
  onSetNodeStroke: (nodeId: string, stroke: string, coalesce?: boolean) => void;
  onSetNodeStrokeWidth: (nodeId: string, width: number, coalesce?: boolean) => void;
  onSetNodeOpacity: (nodeId: string, opacity: number, coalesce?: boolean) => void;
  onSetNodeCornerRadius: (nodeId: string, rx: number, coalesce?: boolean) => void;
  onReplaceImageSource: (nodeId: string, dataUrl: string) => void;
  onSetImageFitMode: (nodeId: string, preserveAspectRatio: string) => void;
  onReplaceNodeWithPreset: (nodeId: string, presetNode: SvgSceneNode) => void;
  onRenameNode: (nodeId: string, label: string) => void;
  onToggleVisibility: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onDuplicateNodes: (nodeIds: string[]) => void;
  onCopyNodes: (nodeIds: string[]) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onReorderNode: (nodeId: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  onGroupNodes: (nodeIds: string[]) => void;
  onUngroupNode: (groupId: string) => void;
  onAlignNodes: (nodeIds: string[], mode: AlignMode, relativeTo?: AlignReference) => void;
  onDistributeNodes: (nodeIds: string[], axis: DistributeAxis) => void;
  onFlipNode?: (nodeId: string, axis: 'x' | 'y') => void;
  onRotateStep?: (nodeId: string, deltaDeg: number) => void;
  clipboardCount?: number;
  onPasteNodes?: () => void;
  onApplyBackground: (cfg: BackgroundConfig, coalesce?: boolean) => void;
  onSetTransparentBackground: (transparent: boolean) => void;
  onPreviewFont?: (nodeId: string, fontFamily: string | null) => void;
  onOpenFontStudio: () => void;
  onOpenBackgroundTab: () => void;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.readAsDataURL(file);
  });
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  scene,
  transparentBackground,
  selectedIds,
  onSelectNodes,
  onUpdateTextNode,
  onUpdateNodeTransform,
  onSetNodeFill,
  onSetNodeStroke,
  onSetNodeStrokeWidth,
  onSetNodeOpacity,
  onSetNodeCornerRadius,
  onReplaceImageSource,
  onSetImageFitMode,
  onReplaceNodeWithPreset,
  onRenameNode,
  onToggleVisibility,
  onToggleLock,
  onDuplicateNodes,
  onCopyNodes,
  onDeleteNodes,
  onReorderNode,
  onGroupNodes,
  onUngroupNode,
  onAlignNodes,
  onDistributeNodes,
  onFlipNode,
  onRotateStep,
  clipboardCount = 0,
  onPasteNodes,
  onApplyBackground,
  onSetTransparentBackground,
  onPreviewFont,
  onOpenFontStudio,
  onOpenBackgroundTab,
}) => {
  const primaryId = selectedIds[0] ?? null;
  const primaryInfo = useMemo(
    () => (primaryId ? findNodeWithAncestors(scene.nodes, primaryId) : null),
    [scene.nodes, primaryId]
  );
  const primaryNode = primaryInfo?.node ?? null;

  const [labelDraft, setLabelDraft] = useState('');
  const [alignReference, setAlignReference] = useState<AlignReference>('canvas');
  const [replaceDrawerOpen, setReplaceDrawerOpen] = useState(false);
  const [groupTintHex, setGroupTintHex] = useState('#28251F');
  const [imageError, setImageError] = useState<string | null>(null);
  const replaceImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabelDraft(primaryNode?.label ?? '');
    setReplaceDrawerOpen(false);
    setImageError(null);
  }, [primaryNode?.id, primaryNode?.label]);

  const stats = useMemo(() => getSceneStats(scene), [scene]);
  const bgConfig = useMemo(() => extractBackgroundConfig(scene), [scene]);
  const hiddenNodes = useMemo(
    () => collectAllNodes(scene.nodes).filter((n) => !n.visible && !n.isBackground),
    [scene.nodes]
  );

  const textProps = useMemo(
    () =>
      primaryInfo && primaryInfo.node.tag === 'text'
        ? getTextNodeProperties(primaryInfo.node, scene.cssRules, primaryInfo.ancestors)
        : null,
    [primaryInfo, scene.cssRules]
  );

  const primaryFillRaw = primaryNode
    ? getEffectiveNodeProp(primaryNode, 'fill', scene.cssRules, primaryInfo?.ancestors ?? [])
    : null;
  const primaryFillHex = normalizeColorToHex(primaryFillRaw);
  const primaryStrokeRaw = primaryNode
    ? getEffectiveNodeProp(primaryNode, 'stroke', scene.cssRules, primaryInfo?.ancestors ?? [])
    : null;
  const primaryStrokeHex = normalizeColorToHex(primaryStrokeRaw);
  const primaryStrokeWidth =
    Number(
      (primaryNode
        ? getEffectiveNodeProp(
            primaryNode,
            'stroke-width',
            scene.cssRules,
            primaryInfo?.ancestors ?? []
          )
        : null) ?? 0
    ) || 0;
  const primaryOpacity = Number(
    (primaryNode
      ? getEffectiveNodeProp(primaryNode, 'opacity', scene.cssRules, primaryInfo?.ancestors ?? [])
      : null) ?? 1
  );
  const primaryCornerRadius = Number(primaryNode?.attrs.rx ?? primaryNode?.attrs.ry ?? 0) || 0;

  const renderAlignControls = (
    targetIds: string[],
    allowDistribute = false,
    hasUnlockedTarget = true
  ) => {
    const effectiveRef: AlignReference = targetIds.length > 1 ? alignReference : 'canvas';
    const refLabel = effectiveRef === 'canvas' ? 'Canvas' : 'Selection';

    const horizButtons: Array<{ id: AlignMode; label: string; title: string; icon: React.ReactNode }> = [
      {
        id: 'left',
        label: 'Left',
        title: `Align Left to ${refLabel}`,
        icon: <AlignStartVertical className="w-3.5 h-3.5 shrink-0" />,
      },
      {
        id: 'center-h',
        label: 'Center',
        title: `Center Horizontally on ${refLabel}`,
        icon: <AlignCenterHorizontal className="w-3.5 h-3.5 shrink-0" />,
      },
      {
        id: 'right',
        label: 'Right',
        title: `Align Right to ${refLabel}`,
        icon: <AlignEndVertical className="w-3.5 h-3.5 shrink-0" />,
      },
    ];

    const vertButtons: Array<{ id: AlignMode; label: string; title: string; icon: React.ReactNode }> = [
      {
        id: 'top',
        label: 'Top',
        title: `Align Top to ${refLabel}`,
        icon: <AlignStartHorizontal className="w-3.5 h-3.5 shrink-0" />,
      },
      {
        id: 'center-v',
        label: 'Middle',
        title: `Center Vertically on ${refLabel}`,
        icon: <AlignCenterVertical className="w-3.5 h-3.5 shrink-0" />,
      },
      {
        id: 'bottom',
        label: 'Bottom',
        title: `Align Bottom to ${refLabel}`,
        icon: <AlignEndHorizontal className="w-3.5 h-3.5 shrink-0" />,
      },
    ];

    return (
      <div
        role="region"
        aria-label="Canvas alignment controls"
        className="space-y-2 pt-2.5 border-t border-[#292929]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[#999999]">
            {effectiveRef === 'canvas' ? 'Align to Canvas' : 'Align Selection'}
          </span>

          {targetIds.length > 1 && (
            <div
              role="group"
              aria-label="Alignment target"
              className="inline-flex rounded border border-[#292929] bg-[#0D0D0D] overflow-hidden"
            >
              {(['canvas', 'selection'] as const).map((refOpt) => (
                <button
                  key={refOpt}
                  type="button"
                  onClick={() => setAlignReference(refOpt)}
                  className={`px-2 py-0.5 text-[10px] font-medium capitalize cursor-pointer transition-colors ${
                    alignReference === refOpt
                      ? 'bg-[#E5E5E5] text-[#090909]'
                      : 'text-[#999999] hover:text-[#F5F5F5]'
                  }`}
                >
                  {refOpt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Horizontal: Left / Center / Right */}
        <div className="grid grid-cols-3 gap-1">
          {horizButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              disabled={!hasUnlockedTarget}
              title={btn.title}
              aria-label={btn.title}
              onClick={() => onAlignNodes(targetIds, btn.id, effectiveRef)}
              className="h-8 px-1.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[11px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Vertical: Top / Middle / Bottom */}
        <div className="grid grid-cols-3 gap-1">
          {vertButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              disabled={!hasUnlockedTarget}
              title={btn.title}
              aria-label={btn.title}
              onClick={() => onAlignNodes(targetIds, btn.id, effectiveRef)}
              className="h-8 px-1.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[11px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Center Horizontally & Vertically */}
        <button
          type="button"
          disabled={!hasUnlockedTarget}
          title={`Center Vertically & Horizontally relative to ${refLabel}`}
          aria-label={`Center Vertically and Horizontally relative to ${refLabel}`}
          onClick={() => onAlignNodes(targetIds, 'center-both', effectiveRef)}
          className="w-full h-8 px-2.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] disabled:opacity-35 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#E5E5E5] cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#C0C0C0] shrink-0" />
          <span>Center H &amp; V ({refLabel})</span>
        </button>

        {allowDistribute && targetIds.length >= 3 && (
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={!hasUnlockedTarget}
              onClick={() => onDistributeNodes(targetIds, 'horizontal')}
              className="h-8 px-2 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 text-[11px] text-[#E5E5E5] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <AlignHorizontalDistributeCenter className="w-3.5 h-3.5" />
              <span>Distribute H</span>
            </button>
            <button
              type="button"
              disabled={!hasUnlockedTarget}
              onClick={() => onDistributeNodes(targetIds, 'vertical')}
              className="h-8 px-2 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 text-[11px] text-[#E5E5E5] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <AlignVerticalDistributeCenter className="w-3.5 h-3.5" />
              <span>Distribute V</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTransformControls = (node: SvgSceneNode) => {
    const signX = node.transform.scaleX < 0 ? -1 : 1;
    const signY = node.transform.scaleY < 0 ? -1 : 1;
    const scaleMagPct = Math.round(Math.abs(node.transform.scaleX) * 100);

    const handleFlip = (axis: 'x' | 'y') => {
      if (onFlipNode) {
        onFlipNode(node.id, axis);
      } else {
        onUpdateNodeTransform(
          node.id,
          axis === 'x' ? { scaleX: -node.transform.scaleX } : { scaleY: -node.transform.scaleY }
        );
      }
    };

    const handleRotate = (delta: number) => {
      if (onRotateStep) {
        onRotateStep(node.id, delta);
      } else {
        let next = node.transform.rotation + delta;
        while (next > 180) next -= 360;
        while (next < -180) next += 360;
        onUpdateNodeTransform(node.id, { rotation: Math.round(next) });
      }
    };

    return (
      <div className="pt-2.5 border-t border-[#292929] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[#999999]">Position, Size &amp; Rotation</span>
          <button
            type="button"
            onClick={() =>
              onUpdateNodeTransform(node.id, { tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0 })
            }
            className="text-[11px] text-[#C0C0C0] hover:text-[#F5F5F5] inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5 block">
            <span className="text-[10px] text-[#737373]">Offset X</span>
            <input
              type="number"
              value={Math.round(node.transform.tx)}
              onChange={(e) =>
                onUpdateNodeTransform(node.id, { tx: Number(e.target.value) || 0 }, true)
              }
              className="w-full h-7 px-2 rounded border border-[#292929] bg-[#0D0D0D] text-xs font-mono text-[#F5F5F5]"
            />
          </label>
          <label className="space-y-0.5 block">
            <span className="text-[10px] text-[#737373]">Offset Y</span>
            <input
              type="number"
              value={Math.round(node.transform.ty)}
              onChange={(e) =>
                onUpdateNodeTransform(node.id, { ty: Number(e.target.value) || 0 }, true)
              }
              className="w-full h-7 px-2 rounded border border-[#292929] bg-[#0D0D0D] text-xs font-mono text-[#F5F5F5]"
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[#999999]">
              <span>Scale</span>
              <span className="tabular-nums text-[#E5E5E5]">{scaleMagPct}%</span>
            </div>
            <input
              type="range"
              aria-label="Scale percentage"
              min={20}
              max={300}
              step={5}
              value={Math.min(300, Math.max(20, scaleMagPct))}
              onChange={(e) => {
                const s = Number(e.target.value) / 100;
                onUpdateNodeTransform(node.id, { scaleX: signX * s, scaleY: signY * s }, true);
              }}
              className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[#999999]">
              <span>Rotate</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Rotate 90° counter-clockwise"
                  aria-label="Rotate 90 degrees left"
                  onClick={() => handleRotate(-90)}
                  className="px-1.5 h-5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>90°</span>
                </button>
                <button
                  type="button"
                  title="Rotate 90° clockwise"
                  aria-label="Rotate 90 degrees right"
                  onClick={() => handleRotate(90)}
                  className="px-1.5 h-5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCw className="w-2.5 h-2.5" />
                  <span>90°</span>
                </button>
                <span className="tabular-nums text-[#E5E5E5] min-w-[30px] text-right">
                  {Math.round(node.transform.rotation)}°
                </span>
              </div>
            </div>
            <input
              type="range"
              aria-label="Rotation angle"
              min={-180}
              max={180}
              step={1}
              value={Math.round(node.transform.rotation)}
              onChange={(e) =>
                onUpdateNodeTransform(node.id, { rotation: Number(e.target.value) }, true)
              }
              className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
            />
          </div>

          {/* Flip Horizontal & Vertical */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => handleFlip('x')}
              aria-pressed={signX < 0}
              className={`h-8 px-2 rounded border text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                signX < 0
                  ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5] font-semibold'
                  : 'bg-[#151515] text-[#C0C0C0] border-[#292929] hover:bg-[#252525] hover:text-[#F5F5F5]'
              }`}
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
              <span>Flip H</span>
            </button>
            <button
              type="button"
              onClick={() => handleFlip('y')}
              aria-pressed={signY < 0}
              className={`h-8 px-2 rounded border text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                signY < 0
                  ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5] font-semibold'
                  : 'bg-[#151515] text-[#C0C0C0] border-[#292929] hover:bg-[#252525] hover:text-[#F5F5F5]'
              }`}
            >
              <FlipVertical2 className="w-3.5 h-3.5" />
              <span>Flip V</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderElementHeaderAndActions = (node: SvgSceneNode) => {
    const canFwd = canReorderNode(scene.nodes, node.id, 'forward');
    const canBack = canReorderNode(scene.nodes, node.id, 'backward');
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            aria-label="Selected layer name"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => onRenameNode(node.id, labelDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="flex-1 min-w-0 h-8 px-2.5 rounded border border-[#292929] bg-[#0D0D0D] text-xs font-medium text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0]"
          />
          <span className="text-[10px] font-mono px-1.5 py-1 rounded bg-[#151515] border border-[#292929] text-[#999999] shrink-0">
            &lt;{node.rawTag || node.tag}&gt;
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            disabled={!canFwd}
            onClick={() => onReorderNode(node.id, 'front')}
            title="Bring to Front"
            aria-label="Bring to Front"
            className="h-7 px-1 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronsUp className="w-3 h-3 shrink-0" />
            <span>Front</span>
          </button>
          <button
            type="button"
            disabled={!canFwd}
            onClick={() => onReorderNode(node.id, 'forward')}
            title="Bring Forward"
            aria-label="Bring Forward"
            className="h-7 px-1 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowUp className="w-3 h-3 shrink-0" />
            <span>Fwd</span>
          </button>
          <button
            type="button"
            disabled={!canBack}
            onClick={() => onReorderNode(node.id, 'backward')}
            title="Send Backward"
            aria-label="Send Backward"
            className="h-7 px-1 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowDown className="w-3 h-3 shrink-0" />
            <span>Back</span>
          </button>
          <button
            type="button"
            disabled={!canBack}
            onClick={() => onReorderNode(node.id, 'back')}
            title="Send to Back"
            aria-label="Send to Back"
            className="h-7 px-1 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 inline-flex items-center justify-center gap-1 text-[10px] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronsDown className="w-3 h-3 shrink-0" />
            <span>Bottom</span>
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => onCopyNodes([node.id])}
            title="Copy (Ctrl+C)"
            aria-label="Copy"
            className="h-8 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-center text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateNodes([node.id])}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate"
            className="h-8 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-center text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleVisibility(node.id)}
            title={node.visible ? 'Hide element' : 'Show element'}
            aria-label={node.visible ? 'Hide element' : 'Show element'}
            className={`h-8 rounded border flex items-center justify-center cursor-pointer ${
              !node.visible
                ? 'bg-[#E5E5E5] border-[#E5E5E5] text-[#090909]'
                : 'bg-[#151515] border-[#292929] text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5]'
            }`}
          >
            {node.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onToggleLock(node.id)}
            title={node.locked ? 'Unlock' : 'Lock'}
            aria-label={node.locked ? 'Unlock' : 'Lock'}
            className={`h-8 rounded border flex items-center justify-center cursor-pointer ${
              node.locked
                ? 'bg-[#E5E5E5] border-[#E5E5E5] text-[#090909]'
                : 'bg-[#151515] border-[#292929] text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5]'
            }`}
          >
            {node.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            disabled={node.locked}
            onClick={() => onDeleteNodes([node.id])}
            title={node.locked ? 'Unlock to delete' : 'Delete (Del)'}
            aria-label="Delete"
            className="h-8 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] disabled:opacity-35 flex items-center justify-center text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside
      aria-label="Properties inspector"
      className="w-full lg:w-80 lg:border-l overflow-y-auto ea-scrollbar shrink-0 bg-[#101010] border-[#292929] p-4 space-y-5"
    >
      {/* 1. MULTI-SELECTION INSPECTOR */}
      {selectedIds.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[#F5F5F5]">
                {selectedIds.length} Elements Selected
              </h2>
              <p className="text-[11px] text-[#999999]">Align, distribute, or group together.</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectNodes([])}
              className="text-xs text-[#999999] hover:text-[#F5F5F5] cursor-pointer"
            >
              Clear
            </button>
          </div>

          {renderAlignControls(
            selectedIds,
            true,
            selectedIds.some((id) => {
              const n = findNodeWithAncestors(scene.nodes, id)?.node;
              return Boolean(n && !n.locked && !n.isBackground);
            })
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#292929]">
            <button
              type="button"
              onClick={() => onGroupNodes(selectedIds)}
              className="h-9 px-3 rounded border border-[#E5E5E5] bg-[#E5E5E5] hover:bg-[#C0C0C0] text-[#090909] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Group className="w-3.5 h-3.5" />
              <span>Group</span>
            </button>
            <button
              type="button"
              onClick={() => onCopyNodes(selectedIds)}
              className="h-9 px-3 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[#F5F5F5] text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={() => onDuplicateNodes(selectedIds)}
              className="h-9 px-3 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[#F5F5F5] text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteNodes(selectedIds)}
              className="h-9 px-3 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[#C0C0C0] hover:text-[#F5F5F5] text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. PRESERVED UNSUPPORTED TAG INSPECTOR */}
      {selectedIds.length === 1 && primaryNode && primaryNode.isPreservedUnsupported && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#E5E5E5]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <h2 className="text-sm font-medium truncate">{primaryNode.label}</h2>
          </div>
          <div className="p-3 rounded-lg border border-[#292929] bg-[#151515] text-xs leading-relaxed text-[#C0C0C0] space-y-2">
            <p>
              The element uses <code className="text-[#F5F5F5]">&lt;{primaryNode.rawTag}&gt;</code>, which is safely preserved in read-only mode so your SVG renders and exports without flattening.
            </p>
            <button
              type="button"
              onClick={() => onToggleVisibility(primaryNode.id)}
              className="w-full h-8 px-3 rounded border border-[#292929] bg-[#101010] hover:bg-[#252525] text-[#F5F5F5] inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {primaryNode.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{primaryNode.visible ? 'Hide Element' : 'Show Element'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. SINGLE TEXT PROPERTIES INSPECTOR */}
      {selectedIds.length === 1 &&
        primaryNode &&
        !primaryNode.isPreservedUnsupported &&
        primaryNode.tag === 'text' &&
        textProps && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] mb-2">
                Text Properties
              </h2>
              {renderElementHeaderAndActions(primaryNode)}
            </div>

            {textProps.isFontFallback && (
              <div className="p-2.5 rounded-md border border-[#C0C0C0]/40 bg-[#151515] text-[11px] text-[#C0C0C0] space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#E5E5E5]" />
                  <span>
                    Original font <strong className="text-[#F5F5F5]">{textProps.originalFontFamily}</strong> is not bundled. Previewing with{' '}
                    <strong className="text-[#F5F5F5]">{textProps.fallbackPreviewFamily}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenFontStudio}
                  className="underline text-[#F5F5F5] cursor-pointer"
                >
                  Choose a bundled Google Font
                </button>
              </div>
            )}

            {primaryNode.locked ? (
              <div className="p-3 rounded-lg border border-[#292929] bg-[#151515] text-xs text-[#999999]">
                This text layer is locked. Click Unlock above to edit.
              </div>
            ) : (
              <>
                {renderAlignControls([primaryNode.id])}

                {/* Content */}
                <div className="space-y-1.5 pt-2.5 border-t border-[#292929]">
                  <span className="block text-[11px] font-medium text-[#999999]">Content</span>
                  {primaryNode.tspans && primaryNode.tspans.length > 1 ? (
                    <div className="space-y-1.5">
                      {primaryNode.tspans.map((ts, idx) => (
                        <input
                          key={ts.id}
                          type="text"
                          aria-label={`Line ${idx + 1}`}
                          value={ts.text}
                          onChange={(e) =>
                            onUpdateTextNode(
                              primaryNode.id,
                              { tspanIndex: idx, tspanText: e.target.value },
                              true
                            )
                          }
                          className="w-full h-8 px-2.5 rounded border border-[#292929] bg-[#0D0D0D] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0]"
                        />
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={textProps.fullText.includes('\n') ? 3 : 2}
                      value={textProps.fullText}
                      onChange={(e) =>
                        onUpdateTextNode(primaryNode.id, { text: e.target.value }, true)
                      }
                      className="w-full px-2.5 py-2 rounded border border-[#292929] bg-[#0D0D0D] text-xs text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0] resize-y"
                    />
                  )}
                </div>

                {/* Font & Style */}
                <div className="space-y-2.5 pt-2.5 border-t border-[#292929]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#999999]">Typography</span>
                    <button
                      type="button"
                      onClick={onOpenFontStudio}
                      className="text-[11px] underline text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
                    >
                      Font Studio
                    </button>
                  </div>

                  <FontFamilyDropdown
                    nodeId={primaryNode.id}
                    nodeLabel={primaryNode.label}
                    textPreview={textProps.fullText}
                    currentFontFamily={textProps.fontFamily}
                    currentFontWeight={textProps.fontWeight}
                    currentFontStyle={textProps.fontStyle}
                    align="right"
                    onSelectFont={(nid, patch) => onUpdateTextNode(nid, patch)}
                    onPreviewFont={(nid, fontFamily) =>
                      onPreviewFont?.(nid, fontFamily)
                    }
                    onOpenFullStudio={onOpenFontStudio}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="block text-[10px] text-[#737373]">Size (px)</span>
                      <div className="flex items-center rounded border border-[#292929] bg-[#0D0D0D] overflow-hidden h-8">
                        <button
                          type="button"
                          title="Decrease font size"
                          aria-label="Decrease font size"
                          onClick={() =>
                            onUpdateTextNode(primaryNode.id, {
                              fontSize: Math.max(6, Math.round(textProps.fontSize) - 2),
                            })
                          }
                          className="w-7 h-full flex items-center justify-center text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5] border-r border-[#292929] cursor-pointer shrink-0"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          aria-label="Font size"
                          min={6}
                          max={300}
                          value={Math.round(textProps.fontSize)}
                          onChange={(e) =>
                            onUpdateTextNode(
                              primaryNode.id,
                              { fontSize: Math.max(6, Number(e.target.value) || 12) },
                              true
                            )
                          }
                          className="w-full min-w-0 h-full px-1.5 bg-transparent text-center text-xs font-mono text-[#F5F5F5] focus:outline-none"
                        />
                        <button
                          type="button"
                          title="Increase font size"
                          aria-label="Increase font size"
                          onClick={() =>
                            onUpdateTextNode(primaryNode.id, {
                              fontSize: Math.min(300, Math.round(textProps.fontSize) + 2),
                            })
                          }
                          className="w-7 h-full flex items-center justify-center text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5] border-l border-[#292929] cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] text-[#737373]">Weight</span>
                      <select
                        aria-label="Font weight"
                        value={textProps.fontWeight}
                        onChange={(e) =>
                          onUpdateTextNode(primaryNode.id, { fontWeight: e.target.value })
                        }
                        className="w-full h-8 px-2 rounded border border-[#292929] bg-[#0D0D0D] text-xs text-[#F5F5F5] cursor-pointer"
                      >
                        <option value="300">Light (300)</option>
                        <option value="400">Regular (400)</option>
                        <option value="500">Medium (500)</option>
                        <option value="600">SemiBold (600)</option>
                        <option value="700">Bold (700)</option>
                      </select>
                    </div>
                  </div>

                  {/* B / I / U + Alignment */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTextNode(primaryNode.id, {
                            fontWeight: Number(textProps.fontWeight) >= 600 ? '400' : '700',
                          })
                        }
                        className={`w-8 h-8 rounded border text-xs font-bold cursor-pointer ${
                          Number(textProps.fontWeight) >= 600
                            ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                            : 'bg-[#151515] text-[#C0C0C0] border-[#292929]'
                        }`}
                      >
                        B
                      </button>
                      {(!getFontDefinition(textProps.fontFamily) ||
                        getFontDefinition(textProps.fontFamily)?.hasItalic) && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateTextNode(primaryNode.id, {
                              fontStyle: textProps.fontStyle === 'italic' ? 'normal' : 'italic',
                            })
                          }
                          className={`w-8 h-8 rounded border text-xs italic cursor-pointer ${
                            textProps.fontStyle === 'italic'
                              ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                              : 'bg-[#151515] text-[#C0C0C0] border-[#292929]'
                          }`}
                        >
                          I
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTextNode(primaryNode.id, {
                            textDecoration:
                              textProps.textDecoration === 'underline' ? 'none' : 'underline',
                          })
                        }
                        aria-label="Underline text"
                        className={`w-8 h-8 rounded border flex items-center justify-center cursor-pointer ${
                          textProps.textDecoration === 'underline'
                            ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                            : 'bg-[#151515] text-[#C0C0C0] border-[#292929]'
                        }`}
                      >
                        <Underline className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="inline-flex rounded border border-[#292929] overflow-hidden">
                      {(
                        [
                          { val: 'start', icon: <AlignLeft className="w-3.5 h-3.5" />, lbl: 'Align left' },
                          { val: 'middle', icon: <AlignCenter className="w-3.5 h-3.5" />, lbl: 'Align center' },
                          { val: 'end', icon: <AlignRight className="w-3.5 h-3.5" />, lbl: 'Align right' },
                        ] as Array<{ val: TextAnchor; icon: React.ReactNode; lbl: string }>
                      ).map((a) => (
                        <button
                          key={a.val}
                          type="button"
                          aria-label={a.lbl}
                          onClick={() => onUpdateTextNode(primaryNode.id, { textAnchor: a.val })}
                          className={`w-8 h-8 flex items-center justify-center cursor-pointer ${
                            textProps.textAnchor === a.val
                              ? 'bg-[#E5E5E5] text-[#090909]'
                              : 'bg-[#151515] text-[#999999] hover:bg-[#252525]'
                          }`}
                        >
                          {a.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Text Case */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#999999]">Text Case</span>
                    <div
                      role="group"
                      aria-label="Transform text case"
                      className="inline-flex rounded border border-[#292929] overflow-hidden"
                    >
                      {(
                        [
                          {
                            id: 'upper',
                            label: 'AA',
                            title: 'Convert to UPPERCASE',
                            fn: (s: string) => s.toUpperCase(),
                          },
                          {
                            id: 'title',
                            label: 'Aa',
                            title: 'Convert to Title Case',
                            fn: (s: string) =>
                              s.replace(
                                /\b([a-zA-Z\u00C0-\u024F])([a-zA-Z\u00C0-\u024F']*)/g,
                                (_, first: string, rest: string) =>
                                  first.toUpperCase() + rest.toLowerCase()
                              ),
                          },
                          {
                            id: 'lower',
                            label: 'aa',
                            title: 'Convert to lowercase',
                            fn: (s: string) => s.toLowerCase(),
                          },
                        ] as const
                      ).map((c, idx) => (
                        <button
                          key={c.id}
                          type="button"
                          title={c.title}
                          aria-label={c.title}
                          onClick={() => {
                            if (primaryNode.tspans && primaryNode.tspans.length > 1) {
                              primaryNode.tspans.forEach((ts, tIdx) => {
                                onUpdateTextNode(
                                  primaryNode.id,
                                  { tspanIndex: tIdx, tspanText: c.fn(ts.text) },
                                  true
                                );
                              });
                            } else {
                              onUpdateTextNode(primaryNode.id, {
                                text: c.fn(textProps.fullText),
                              });
                            }
                          }}
                          className={`h-7 px-2.5 text-[11px] font-medium bg-[#151515] hover:bg-[#252525] text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer ${
                            idx > 0 ? 'border-l border-[#292929]' : ''
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Letter Spacing + Line Spacing */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#999999]">
                      <span>Letter Spacing</span>
                      <span className="tabular-nums text-[#E5E5E5]">{textProps.letterSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min={-4}
                      max={24}
                      step={0.5}
                      value={textProps.letterSpacing}
                      onChange={(e) =>
                        onUpdateTextNode(
                          primaryNode.id,
                          { letterSpacing: Number(e.target.value) },
                          true
                        )
                      }
                      className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                    />
                  </div>

                  {textProps.hasMultipleTspans && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#999999]">
                        <span>Line Spacing</span>
                        <span className="tabular-nums text-[#E5E5E5]">
                          {textProps.lineHeight.toFixed(2)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.9}
                        max={2.5}
                        step={0.05}
                        value={textProps.lineHeight}
                        onChange={(e) =>
                          onUpdateTextNode(
                            primaryNode.id,
                            { lineHeight: Number(e.target.value) },
                            true
                          )
                        }
                        className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Text Color + Opacity */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#999999]">Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Text fill color"
                        value={textProps.color}
                        onChange={(e) =>
                          onUpdateTextNode(
                            primaryNode.id,
                            { color: e.target.value.toUpperCase() },
                            true
                          )
                        }
                        className="w-7 h-7 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0"
                      />
                      <span className="text-xs font-mono text-[#C0C0C0] uppercase">
                        {textProps.color}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#999999]">
                      <span>Text Opacity</span>
                      <span className="tabular-nums text-[#E5E5E5]">
                        {Math.round(textProps.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={Number.isFinite(textProps.opacity) ? textProps.opacity : 1}
                      onChange={(e) =>
                        onUpdateTextNode(
                          primaryNode.id,
                          { opacity: Number(e.target.value) },
                          true
                        )
                      }
                      className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                    />
                  </div>
                </div>

                {renderTransformControls(primaryNode)}
              </>
            )}
          </div>
        )}

      {/* 4. EMBEDDED IMAGE INSPECTOR */}
      {selectedIds.length === 1 &&
        primaryNode &&
        !primaryNode.isPreservedUnsupported &&
        primaryNode.tag === 'image' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] mb-2">
                Image Properties
              </h2>
              {renderElementHeaderAndActions(primaryNode)}
            </div>

            {primaryNode.locked ? (
              <div className="p-3 rounded-lg border border-[#292929] bg-[#151515] text-xs text-[#999999]">
                This image is locked. Click Unlock above to modify or replace it.
              </div>
            ) : (
              <>
                {renderAlignControls([primaryNode.id])}

                {(primaryNode.attrs.href || primaryNode.attrs['xlink:href']) && (
                  <div className="p-2 rounded-lg border border-[#292929] bg-[#0D0D0D] flex items-center justify-center max-h-36 overflow-hidden">
                    <img
                      src={primaryNode.attrs.href || primaryNode.attrs['xlink:href']}
                      alt={primaryNode.label}
                      className="max-h-32 w-auto object-contain rounded"
                    />
                  </div>
                )}

                <input
                  ref={replaceImgRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    setImageError(null);
                    if (!f) return;
                    if (
                      !/^image\/(png|jpeg|jpg|webp)$/i.test(f.type) &&
                      !/\.(png|jpe?g|webp)$/i.test(f.name)
                    ) {
                      setImageError('Upload a PNG, JPG, or WebP image.');
                      return;
                    }
                    try {
                      const dataUrl = await readDataUrl(f);
                      onReplaceImageSource(primaryNode.id, dataUrl);
                    } catch (err) {
                      setImageError(
                        err instanceof Error ? err.message : 'Failed to replace image.'
                      );
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => replaceImgRef.current?.click()}
                  className="w-full h-9 px-3 rounded-md border border-[#E5E5E5] bg-[#E5E5E5] hover:bg-[#C0C0C0] text-[#090909] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Image</span>
                </button>
                {imageError && <p className="text-[11px] text-[#E5E5E5]">{imageError}</p>}

                {/* Fit / Crop Mode */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium text-[#999999]">
                    Fit &amp; Crop Mode
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { val: 'xMidYMid meet', label: 'Fit' },
                        { val: 'xMidYMid slice', label: 'Cover' },
                        { val: 'none', label: 'Stretch' },
                      ] as const
                    ).map((m) => {
                      const current = primaryNode.attrs.preserveAspectRatio || 'xMidYMid meet';
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => onSetImageFitMode(primaryNode.id, m.val)}
                          className={`h-8 rounded border text-xs cursor-pointer ${
                            current === m.val
                              ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5] font-semibold'
                              : 'bg-[#151515] text-[#C0C0C0] border-[#292929] hover:bg-[#252525]'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#999999]">
                    <span>Opacity</span>
                    <span className="tabular-nums text-[#E5E5E5]">
                      {Math.round((Number.isFinite(primaryOpacity) ? primaryOpacity : 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={Number.isFinite(primaryOpacity) ? primaryOpacity : 1}
                    onChange={(e) =>
                      onSetNodeOpacity(primaryNode.id, Number(e.target.value), true)
                    }
                    className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                  />
                </div>

                <p className="text-[11px] text-[#737373] leading-relaxed">
                  Aspect ratio stays proportional when dragging corner handles. Pixel-level painting or retouching is not supported.
                </p>

                {renderTransformControls(primaryNode)}
              </>
            )}
          </div>
        )}

      {/* 5. GROUP (<g>) INSPECTOR */}
      {selectedIds.length === 1 &&
        primaryNode &&
        !primaryNode.isPreservedUnsupported &&
        primaryNode.tag === 'g' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] mb-2">
                Group Properties
              </h2>
              {renderElementHeaderAndActions(primaryNode)}
            </div>

            {!primaryNode.locked && (
              <button
                type="button"
                onClick={() => onUngroupNode(primaryNode.id)}
                className="w-full h-9 px-3 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-xs font-medium text-[#E5E5E5] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Ungroup className="w-3.5 h-3.5" />
                <span>Ungroup ({primaryNode.children?.length ?? 0} elements)</span>
              </button>
            )}

            {/* Children quick selection */}
            {primaryNode.children && primaryNode.children.length > 0 && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[#999999]">
                  Elements Inside Group (click to edit)
                </span>
                <div className="max-h-36 overflow-y-auto ea-scrollbar space-y-1 pr-1">
                  {primaryNode.children.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => onSelectNodes([ch.id])}
                      className="w-full px-2.5 py-1.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-between gap-2 text-xs text-[#E5E5E5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Folder className="w-3 h-3 text-[#999999] shrink-0" />
                        <span className="truncate">{ch.label}</span>
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#737373] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!primaryNode.locked && (
              <>
                {renderAlignControls([primaryNode.id])}

                <div className="pt-2.5 border-t border-[#292929] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#999999]">Batch Fill Tint</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Group batch fill tint"
                        value={groupTintHex}
                        onChange={(e) => {
                          const hex = e.target.value.toUpperCase();
                          setGroupTintHex(hex);
                          for (const ch of primaryNode.children ?? []) {
                            if (ch.tag !== 'g' && ch.tag !== 'image') {
                              onSetNodeFill(ch.id, hex, true);
                            }
                          }
                        }}
                        className="w-7 h-7 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#999999]">
                      <span>Group Opacity</span>
                      <span className="tabular-nums text-[#E5E5E5]">
                        {Math.round((Number.isFinite(primaryOpacity) ? primaryOpacity : 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={Number.isFinite(primaryOpacity) ? primaryOpacity : 1}
                      onChange={(e) =>
                        onSetNodeOpacity(primaryNode.id, Number(e.target.value), true)
                      }
                      className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                    />
                  </div>
                </div>

                {renderTransformControls(primaryNode)}
              </>
            )}
          </div>
        )}

      {/* 6. SINGLE SHAPE / BORDER / PATH / ICON INSPECTOR */}
      {selectedIds.length === 1 &&
        primaryNode &&
        !primaryNode.isPreservedUnsupported &&
        primaryNode.tag !== 'text' &&
        primaryNode.tag !== 'image' &&
        primaryNode.tag !== 'g' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#999999] mb-2">
                {primaryNode.isBackground ? 'Background Shape Properties' : 'Shape & Icon Properties'}
              </h2>
              {renderElementHeaderAndActions(primaryNode)}
            </div>

            {primaryNode.locked ? (
              <div className="p-3 rounded-lg border border-[#292929] bg-[#151515] text-xs text-[#999999] space-y-2">
                <p>This layer is locked. Click Unlock above to move, resize, or recolor.</p>
                {primaryNode.isBackground && (
                  <button
                    type="button"
                    onClick={onOpenBackgroundTab}
                    className="underline text-[#F5F5F5] cursor-pointer"
                  >
                    Edit background colors &amp; gradients
                  </button>
                )}
              </div>
            ) : (
              <>
                {!primaryNode.isBackground && renderAlignControls([primaryNode.id])}

                <div className="pt-2.5 border-t border-[#292929] space-y-3">
                  {/* Fill */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#999999]">Fill Color</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Fill color"
                        value={primaryFillHex ?? '#000000'}
                        onChange={(e) =>
                          onSetNodeFill(primaryNode.id, e.target.value.toUpperCase(), true)
                        }
                        className="w-7 h-7 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0"
                      />
                      <button
                        type="button"
                        onClick={() => onSetNodeFill(primaryNode.id, 'none')}
                        className={`px-2 h-7 rounded border text-[11px] cursor-pointer ${
                          primaryFillRaw === 'none'
                            ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                            : 'bg-[#151515] text-[#999999] border-[#292929] hover:text-[#F5F5F5]'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {/* Stroke */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-[#999999]">Border / Stroke</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        aria-label="Stroke color"
                        value={primaryStrokeHex ?? '#28251F'}
                        onChange={(e) => {
                          onSetNodeStroke(primaryNode.id, e.target.value.toUpperCase(), true);
                          if (primaryStrokeWidth <= 0) {
                            onSetNodeStrokeWidth(primaryNode.id, 2, true);
                          }
                        }}
                        className="w-7 h-7 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onSetNodeStroke(primaryNode.id, 'none');
                          onSetNodeStrokeWidth(primaryNode.id, 0);
                        }}
                        className={`px-2 h-7 rounded border text-[11px] cursor-pointer ${
                          !primaryStrokeRaw || primaryStrokeRaw === 'none'
                            ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                            : 'bg-[#151515] text-[#999999] border-[#292929] hover:text-[#F5F5F5]'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#999999]">
                      <span>Stroke Width</span>
                      <span className="tabular-nums text-[#E5E5E5]">{primaryStrokeWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={0.5}
                      value={Math.min(24, Math.max(0, primaryStrokeWidth))}
                      onChange={(e) =>
                        onSetNodeStrokeWidth(primaryNode.id, Number(e.target.value), true)
                      }
                      className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                    />
                  </div>

                  {/* Corner Radius for Rectangles */}
                  {primaryNode.tag === 'rect' && !primaryNode.isBackground && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#999999]">
                        <span>Corner Radius</span>
                        <span className="tabular-nums text-[#E5E5E5]">{primaryCornerRadius}px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        step={2}
                        value={Math.min(80, Math.max(0, primaryCornerRadius))}
                        onChange={(e) =>
                          onSetNodeCornerRadius(primaryNode.id, Number(e.target.value), true)
                        }
                        className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Opacity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#999999]">
                      <span>Opacity</span>
                      <span className="tabular-nums text-[#E5E5E5]">
                        {Math.round((Number.isFinite(primaryOpacity) ? primaryOpacity : 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={Number.isFinite(primaryOpacity) ? primaryOpacity : 1}
                      onChange={(e) =>
                        onSetNodeOpacity(primaryNode.id, Number(e.target.value), true)
                      }
                      className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Replace Shape / Icon Drawer */}
                {!primaryNode.isBackground && (
                  <div className="pt-2.5 border-t border-[#292929] space-y-2">
                    <button
                      type="button"
                      onClick={() => setReplaceDrawerOpen((o) => !o)}
                      className="w-full h-8 px-2.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-between text-xs text-[#E5E5E5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-[#C0C0C0]" />
                        <span>Replace Shape / Icon</span>
                      </span>
                      {replaceDrawerOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {replaceDrawerOpen && (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {VECTOR_PRESETS.filter((p) => p.category !== 'borders').map(
                          (preset: VectorPresetItem) => (
                            <button
                              key={preset.id}
                              type="button"
                              title={`Replace with ${preset.name}`}
                              onClick={() => {
                                const replacement = preset.buildNode(scene);
                                onReplaceNodeWithPreset(primaryNode.id, replacement);
                                setReplaceDrawerOpen(false);
                              }}
                              className="p-2 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] flex flex-col items-center gap-1 cursor-pointer"
                            >
                              <svg
                                viewBox={preset.viewBox}
                                className="w-6 h-6 text-[#E5E5E5]"
                                aria-hidden="true"
                              >
                                {preset.previewPaths.map((item, idx) =>
                                  React.createElement(item.tag, { key: idx, ...item.attrs })
                                )}
                              </svg>
                              <span className="text-[10px] text-[#C0C0C0] truncate max-w-full">
                                {preset.name}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {renderTransformControls(primaryNode)}
              </>
            )}
          </div>
        )}

      {/* 7. UNSELECTED DOCUMENT & QUICK BACKGROUND INSPECTOR */}
      {selectedIds.length === 0 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-medium text-[#F5F5F5]">Document Properties</h2>
            <p className="text-xs text-[#999999] mt-0.5">
              Click any element on the canvas to inspect and customize it, or double-click text to edit in place.
            </p>
          </div>

          {clipboardCount > 0 && onPasteNodes && (
            <button
              type="button"
              onClick={onPasteNodes}
              className="w-full h-9 px-3 rounded-md border border-[#C0C0C0]/60 bg-[#151515] hover:bg-[#252525] text-xs font-medium text-[#F5F5F5] inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#E5E5E5]" />
              <span>
                Paste {clipboardCount} Copied {clipboardCount === 1 ? 'Element' : 'Elements'} (Ctrl+V)
              </span>
            </button>
          )}

          {hiddenNodes.length > 0 && (
            <div className="p-3.5 rounded-lg border border-[#292929] bg-[#151515] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#F5F5F5]">
                  Hidden Elements ({hiddenNodes.length})
                </span>
                {hiddenNodes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => hiddenNodes.forEach((n) => onToggleVisibility(n.id))}
                    className="text-[11px] underline text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
                  >
                    Show All
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto ea-scrollbar">
                {hiddenNodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-[#292929] bg-[#0D0D0D]"
                  >
                    <span className="text-[11px] text-[#C0C0C0] truncate">{n.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleVisibility(n.id);
                        onSelectNodes([n.id]);
                      }}
                      className="text-[11px] text-[#E5E5E5] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Show</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Background Switcher */}
          <div className="p-3.5 rounded-lg border border-[#292929] bg-[#151515] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#F5F5F5]">Canvas Background</span>
              <button
                type="button"
                onClick={onOpenBackgroundTab}
                className="text-[11px] underline text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
              >
                Full Studio
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#999999]">
                {bgConfig.mode === 'solid'
                  ? 'Solid Fill'
                  : bgConfig.mode === 'linear'
                  ? 'Linear Gradient'
                  : 'Radial Gradient'}
              </span>
              <input
                type="color"
                aria-label="Quick background color"
                value={bgConfig.solidColor}
                onChange={(e) =>
                  onApplyBackground(
                    { ...bgConfig, mode: 'solid', solidColor: e.target.value.toUpperCase() },
                    true
                  )
                }
                className="w-8 h-8 rounded border border-[#292929] bg-[#0D0D0D] cursor-pointer p-0"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#999999]">
                <span>Background Opacity</span>
                <span className="tabular-nums text-[#E5E5E5]">
                  {Math.round(bgConfig.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(bgConfig.opacity * 100)}
                onChange={(e) =>
                  onApplyBackground({ ...bgConfig, opacity: Number(e.target.value) / 100 }, true)
                }
                className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
              />
            </div>

            <label className="pt-2 border-t border-[#292929] flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-[11px] text-[#C0C0C0]">Transparent SVG Background</span>
              <input
                type="checkbox"
                checked={transparentBackground}
                onChange={(e) => onSetTransparentBackground(e.target.checked)}
                className="w-4 h-4 accent-[#E5E5E5] cursor-pointer"
              />
            </label>
          </div>

          {/* Scene Specs */}
          <dl className="p-3.5 rounded-lg border border-[#292929] bg-[#151515] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">ViewBox</dt>
              <dd className="font-mono text-[11px] text-[#F5F5F5]">{scene.viewBox}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">Dimensions</dt>
              <dd className="tabular-nums text-[#F5F5F5]">
                {scene.vbW} × {scene.vbH}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">Text Elements</dt>
              <dd className="tabular-nums text-[#F5F5F5]">{stats.textCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">Shapes &amp; Paths</dt>
              <dd className="tabular-nums text-[#F5F5F5]">{stats.shapeCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">Groups</dt>
              <dd className="tabular-nums text-[#F5F5F5]">{stats.groupCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[#999999]">Embedded Images</dt>
              <dd className="tabular-nums text-[#F5F5F5]">{stats.imageCount}</dd>
            </div>
          </dl>
        </div>
      )}
    </aside>
  );
};
