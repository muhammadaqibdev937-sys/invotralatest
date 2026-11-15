import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Bookmark,
  Check,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Palette,
  Paintbrush,
  Shapes,
  Trash2,
  Type,
  Underline,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  isFontAvailableInBrowser,
  SceneFontScanSummary,
} from '../../engine/fonts';
import {
  BackgroundConfig,
  collectAllNodes,
  collectTextNodesWithAncestors,
  createImageNode,
  extractBackgroundConfig,
  extractSceneColorSwatches,
  findNodeWithAncestors,
  formatNodeCapabilityNotice,
  getEffectiveNodeProp,
  getNodeTspans,
  getTextNodeProperties,
  normalizeColorToHex,
  scanSceneFontUsage,
  SvgSceneDocument,
  SvgSceneNode,
  TextEditPatch,
} from '../../engine/svgScene';
import { VECTOR_PRESETS, VectorPresetItem } from '../../engine/vectorLibrary';
import { getFontDefinition } from '../../services/fontLoader';
import {
  COLOR_COLLECTIONS,
  normalizeHexInput,
  readFavoriteColors,
  saveFavoriteColors,
} from '../../services/colorPaletteService';
import { LiveTextControl } from '../Editor/LiveTextControl';

export type NavSectionId = 'background' | 'elements' | 'text' | 'colors';

type ColorTargetId =
  | 'background'
  | 'selected:fill'
  | 'selected:stroke'
  | 'text:all'
  | `swatch:${string}`;

interface FieldPanelProps {
  scene: SvgSceneDocument;
  transparentBackground: boolean;
  selectedIds: string[];
  activeNav?: NavSectionId;
  onChangeNav?: (nav: NavSectionId) => void;
  onSelectNodes: (ids: string[]) => void;
  onUpdateTextNode: (nodeId: string, patch: TextEditPatch, coalesce?: boolean) => void;
  onCommitTextBoundary?: () => void;
  onApplyBatchTextUpdates: (updates: Record<string, TextEditPatch>) => void;
  onAddTextPreset: (preset: 'heading' | 'subheading' | 'body') => void;
  onInsertSceneNode: (node: SvgSceneNode, position?: 'top' | 'background') => void;
  onSetNodeFill: (nodeId: string, fill: string, coalesce?: boolean) => void;
  onSetNodeStroke: (nodeId: string, stroke: string, coalesce?: boolean) => void;
  onSetNodeStrokeWidth: (nodeId: string, width: number, coalesce?: boolean) => void;
  onToggleVisibility: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
  onRecolorSwatchHex: (fromHex: string, toHex: string) => void;
  onApplyCoordinatedPalette?: (combo: {
    background: string;
    accent: string;
    secondaryAccent: string;
    headingText: string;
    bodyText: string;
  }) => void;
  onApplyBackground: (cfg: BackgroundConfig, coalesce?: boolean) => void;
  onSetTransparentBackground: (transparent: boolean) => void;
  onSetBackgroundImage: (dataUrl: string) => void;
  onRemoveBackgroundNode: (nodeId?: string) => void;
  onOpenFontStudio: () => void;
  onOpenUploadFont?: (preferredMissingFont?: string) => void;
  onOpenDownload?: () => void;
  fontRegistryVersion?: number;
}

const BG_SWATCHES = [
  '#FAF7F0',
  '#FFFFFF',
  '#F5EFE6',
  '#EAE3D5',
  '#E4EAE2',
  '#F4E6E8',
  '#DCE6ED',
  '#1C2321',
  '#1E2D4A',
  '#111111',
];

async function readImageFileAsDataUrl(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
    img.onerror = () => resolve({ width: 800, height: 600 });
    img.src = dataUrl;
  });

  return { dataUrl, ...dims };
}

interface TextLayerCardProps {
  node: SvgSceneNode;
  ancestors: SvgSceneNode[];
  scene: SvgSceneDocument;
  isSelected: boolean;
  fontRegistryVersion: number;
  onSelectNodes: (ids: string[]) => void;
  onUpdateTextNode: (nodeId: string, patch: TextEditPatch, coalesce?: boolean) => void;
  onCommitTextBoundary?: () => void;
  onToggleVisibility: (nodeId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onDeleteNodes: (nodeIds: string[]) => void;
}

const TextLayerCard: React.FC<TextLayerCardProps> = React.memo(
  ({
    node,
    ancestors,
    scene,
    isSelected,
    onSelectNodes,
    onUpdateTextNode,
    onCommitTextBoundary,
    onToggleVisibility,
    onToggleLock,
    onDeleteNodes,
  }) => {
    const props = getTextNodeProperties(node, scene.cssRules, ancestors);
    const fontDef = getFontDefinition(props.fontFamily);
    const nodeTspans = getNodeTspans(node);
    const capabilityNotice = formatNodeCapabilityNotice(node, scene, ancestors);

    return (
      <div
        onClick={() => onSelectNodes([node.id])}
        className={`p-3 rounded-lg border space-y-2.5 transition-colors cursor-pointer ${
          isSelected
            ? 'bg-[#F4F4F5] border-[#18181B] dark:bg-[#1A1A1A] dark:border-[#E5E5E5]'
            : 'bg-white border-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#101010] dark:border-[#292929] dark:hover:border-[#C0C0C0]/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5] truncate">
              {node.label}
            </span>
            <span className="text-[10px] text-[#71717A] dark:text-[#737373] truncate">
              {props.fontFamily} · {Math.round(props.fontSize)}px
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(node.id);
              }}
              aria-label={node.visible ? `Hide ${node.label}` : `Show ${node.label}`}
              className="w-7 h-7 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#3F3F46] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] flex items-center justify-center dark:text-[#C0C0C0] cursor-pointer"
            >
              {node.visible ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-[#71717A] dark:text-[#737373]" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(node.id);
              }}
              aria-label={node.locked ? `Unlock ${node.label}` : `Lock ${node.label}`}
              className="w-7 h-7 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#3F3F46] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] flex items-center justify-center dark:text-[#C0C0C0] cursor-pointer"
            >
              {node.locked ? (
                <Lock className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5]" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-[#71717A] dark:text-[#737373]" />
              )}
            </button>
            {!node.locked && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteNodes([node.id]);
                }}
                aria-label={`Delete ${node.label}`}
                className="w-7 h-7 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[#52525B] hover:text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] flex items-center justify-center dark:text-[#999999] dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {props.isFontFallback && isFontAvailableInBrowser(props.originalFontFamily) && (
          <div className="text-[10px] text-[#71717A] dark:text-[#737373]">
            System font rendered locally by browser
          </div>
        )}

        {capabilityNotice && (
          <div className="px-2 py-1 rounded border border-[#E4E4E7] bg-[#FAFAFA] text-[10px] text-[#52525B] dark:border-[#292929] dark:bg-[#151515] dark:text-[#999999] leading-snug">
            {capabilityNotice}
          </div>
        )}

        {nodeTspans && nodeTspans.length > 1 ? (
          <div className="space-y-1.5">
            <div className="text-[10px] text-[#71717A] dark:text-[#737373]">
              Multi-line spans ({nodeTspans.length}) — positions preserved
            </div>
            {nodeTspans.map((ts, idx) => (
              <LiveTextControl
                key={ts.id}
                as="input"
                type="text"
                nodeKey={`${node.id}:ts:${ts.id}`}
                disabled={node.locked}
                aria-label={`${node.label} line ${idx + 1}`}
                value={ts.text}
                onFocus={() => onSelectNodes([node.id])}
                onLiveChange={(nextLine) =>
                  onUpdateTextNode(node.id, { tspanIndex: idx, tspanText: nextLine }, true)
                }
                onCommitBoundary={onCommitTextBoundary}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full min-h-[34px] px-2.5 py-1 rounded border text-xs bg-white border-[#E4E4E7] text-[#111111] focus:outline-none focus:border-[#18181B] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:focus:border-[#C0C0C0] disabled:opacity-50"
              />
            ))}
          </div>
        ) : (
          <LiveTextControl
            as="textarea"
            nodeKey={node.id}
            rows={props.fullText.includes('\n') ? 3 : 2}
            disabled={node.locked}
            aria-label={node.label}
            value={props.fullText}
            onFocus={() => onSelectNodes([node.id])}
            onLiveChange={(nextText) =>
              onUpdateTextNode(node.id, { text: nextText }, true)
            }
            onCommitBoundary={onCommitTextBoundary}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.currentTarget.blur();
              }
            }}
            className="w-full px-2.5 py-1.5 rounded border text-xs leading-relaxed bg-white border-[#E4E4E7] text-[#111111] focus:outline-none focus:border-[#18181B] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:focus:border-[#C0C0C0] resize-y disabled:opacity-50"
          />
        )}

        {isSelected && !node.locked && (
          <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#292929] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                aria-label={`Text color for ${node.label}`}
                value={props.color}
                onChange={(e) =>
                  onUpdateTextNode(
                    node.id,
                    { color: e.target.value.toUpperCase() },
                    true
                  )
                }
                className="w-6 h-6 rounded border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] cursor-pointer p-0"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateTextNode(node.id, {
                    fontWeight: props.fontWeight === '700' ? '400' : '700',
                  })
                }
                className={`h-7 px-2 rounded border text-[11px] font-bold cursor-pointer ${
                  Number(props.fontWeight) >= 600
                    ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                    : 'bg-white text-[#3F3F46] border-[#E4E4E7] dark:bg-[#0D0D0D] dark:text-[#C0C0C0] dark:border-[#292929]'
                }`}
              >
                B
              </button>
              {(!fontDef || fontDef.hasItalic) && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTextNode(node.id, {
                      fontStyle: props.fontStyle === 'italic' ? 'normal' : 'italic',
                    })
                  }
                  className={`h-7 px-2 rounded border text-[11px] italic cursor-pointer ${
                    props.fontStyle === 'italic'
                      ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                      : 'bg-white text-[#3F3F46] border-[#E4E4E7] dark:bg-[#0D0D0D] dark:text-[#C0C0C0] dark:border-[#292929]'
                  }`}
                >
                  I
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onUpdateTextNode(node.id, {
                    textDecoration:
                      props.textDecoration === 'underline' ? 'none' : 'underline',
                  })
                }
                aria-label="Underline text"
                className={`h-7 px-2 rounded border text-[11px] cursor-pointer ${
                  props.textDecoration === 'underline'
                    ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                    : 'bg-white text-[#3F3F46] border-[#E4E4E7] dark:bg-[#0D0D0D] dark:text-[#C0C0C0] dark:border-[#292929]'
                }`}
              >
                <Underline className="w-3 h-3" />
              </button>
            </div>

            <div className="inline-flex rounded border border-[#E4E4E7] dark:border-[#292929] overflow-hidden">
              {(
                [
                  { val: 'start', icon: <AlignLeft className="w-3 h-3" />, lbl: 'Align left' },
                  { val: 'middle', icon: <AlignCenter className="w-3 h-3" />, lbl: 'Align center' },
                  { val: 'end', icon: <AlignRight className="w-3 h-3" />, lbl: 'Align right' },
                ] as const
              ).map((a) => (
                <button
                  key={a.val}
                  type="button"
                  aria-label={a.lbl}
                  onClick={() => onUpdateTextNode(node.id, { textAnchor: a.val })}
                  className={`w-7 h-7 flex items-center justify-center cursor-pointer ${
                    props.textAnchor === a.val
                      ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                      : 'bg-white text-[#52525B] hover:bg-[#F4F4F5] dark:bg-[#0D0D0D] dark:text-[#999999] dark:hover:bg-[#252525]'
                  }`}
                >
                  {a.icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    if (prev.node !== next.node) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.fontRegistryVersion !== next.fontRegistryVersion) return false;
    if (prev.scene.cssRules !== next.scene.cssRules) return false;
    if (prev.ancestors.length !== next.ancestors.length) return false;
    for (let i = 0; i < prev.ancestors.length; i++) {
      if (prev.ancestors[i] !== next.ancestors[i]) return false;
    }
    return (
      prev.onSelectNodes === next.onSelectNodes &&
      prev.onUpdateTextNode === next.onUpdateTextNode &&
      prev.onCommitTextBoundary === next.onCommitTextBoundary &&
      prev.onToggleVisibility === next.onToggleVisibility &&
      prev.onToggleLock === next.onToggleLock &&
      prev.onDeleteNodes === next.onDeleteNodes
    );
  }
);

TextLayerCard.displayName = 'TextLayerCard';

export const FieldPanel: React.FC<FieldPanelProps> = ({
  scene,
  transparentBackground,
  selectedIds,
  activeNav: controlledNav,
  onChangeNav,
  onSelectNodes,
  onUpdateTextNode,
  onCommitTextBoundary,
  onApplyBatchTextUpdates,
  onAddTextPreset,
  onInsertSceneNode,
  onSetNodeFill,
  onSetNodeStroke,
  onSetNodeStrokeWidth,
  onToggleVisibility,
  onToggleLock,
  onDeleteNodes,
  onRecolorSwatchHex,
  onApplyCoordinatedPalette,
  onApplyBackground,
  onSetTransparentBackground,
  onSetBackgroundImage,
  onRemoveBackgroundNode,
  onOpenFontStudio,
  onOpenUploadFont,
  onOpenDownload,
  fontRegistryVersion = 0,
}) => {
  const [internalNav, setInternalNav] = useState<NavSectionId>('text');
  const currentNav = controlledNav ?? internalNav;
  const setActiveNav = (nav: NavSectionId) => {
    if (onChangeNav) onChangeNav(nav);
    else setInternalNav(nav);
  };

  // Elements library filter + image upload refs
  const [elementCategory, setElementCategory] = useState<
    'all' | 'shapes' | 'borders' | 'icons' | 'floral'
  >('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const elementImageInputRef = useRef<HTMLInputElement>(null);

  // Colors state
  const [colorTarget, setColorTarget] = useState<ColorTargetId>('background');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(COLOR_COLLECTIONS[0].id);
  const [hexDraft, setHexDraft] = useState<string>('');
  const [hexError, setHexError] = useState<string | null>(null);
  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => readFavoriteColors());
  const [appliedActionId, setAppliedActionId] = useState<string | null>(null);

  const triggerAppliedFeedback = (id: string) => {
    setAppliedActionId(id);
    window.setTimeout(() => {
      setAppliedActionId((prev) => (prev === id ? null : prev));
    }, 1600);
  };

  const textEntries = useMemo(() => collectTextNodesWithAncestors(scene.nodes), [scene.nodes]);
  const [fontSummary, setFontSummary] = useState<SceneFontScanSummary>(() =>
    scanSceneFontUsage(scene)
  );
  const lastFontSceneKeyRef = useRef<string>(`${scene.title}:${fontRegistryVersion}`);

  useEffect(() => {
    const key = `${scene.title}:${fontRegistryVersion}`;
    if (lastFontSceneKeyRef.current !== key) {
      lastFontSceneKeyRef.current = key;
      setFontSummary(scanSceneFontUsage(scene));
      return;
    }
    const timer = window.setTimeout(() => {
      setFontSummary(scanSceneFontUsage(scene));
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [scene, fontRegistryVersion]);

  const firstMissingEntry = useMemo(
    () => fontSummary.entries.find((entry) => entry.isMissing) ?? null,
    [fontSummary]
  );
  const sceneSwatches = useMemo(() => extractSceneColorSwatches(scene), [scene]);
  const bgConfig = useMemo(() => extractBackgroundConfig(scene), [scene]);
  const bgNodes = useMemo(
    () => collectAllNodes(scene.nodes).filter((n) => n.isBackground),
    [scene.nodes]
  );
  const primaryBgNode = bgNodes[0] ?? null;
  const activeBgImage = bgNodes.find((n) => n.tag === 'image' && n.visible) ?? null;

  const primaryId = selectedIds[0] ?? null;
  const primaryInfo = useMemo(
    () => (primaryId ? findNodeWithAncestors(scene.nodes, primaryId) : null),
    [scene.nodes, primaryId]
  );
  const primaryNode = primaryInfo?.node ?? null;

  const selectedTextEntry = useMemo(() => {
    if (primaryInfo?.node.tag === 'text') {
      return { node: primaryInfo.node, ancestors: primaryInfo.ancestors };
    }
    return textEntries[0] ?? null;
  }, [primaryInfo, textEntries]);

  const selectedTextProps = useMemo(
    () =>
      selectedTextEntry
        ? getTextNodeProperties(selectedTextEntry.node, scene.cssRules, selectedTextEntry.ancestors)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedTextEntry, scene.cssRules, fontRegistryVersion]
  );

  useEffect(() => {
    if (colorTarget.startsWith('swatch:')) {
      const hex = colorTarget.slice(7);
      if (!sceneSwatches.some((s) => s.color.toUpperCase() === hex.toUpperCase())) {
        setColorTarget(sceneSwatches[0] ? `swatch:${sceneSwatches[0].color}` : 'background');
      }
    }
  }, [colorTarget, sceneSwatches]);

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

  const currentTargetColor = useMemo(() => {
    if (colorTarget === 'background') {
      return normalizeColorToHex(scene.backgroundColor) ?? '#FFFFFF';
    }
    if (colorTarget.startsWith('swatch:')) {
      return normalizeColorToHex(colorTarget.slice(7)) ?? '#FFFFFF';
    }
    if (colorTarget === 'selected:fill') return primaryFillHex ?? '#28251F';
    if (colorTarget === 'selected:stroke') return primaryStrokeHex ?? '#28251F';
    if (colorTarget === 'text:all') return selectedTextProps?.color ?? '#28251F';
    return normalizeColorToHex(scene.backgroundColor) ?? '#FFFFFF';
  }, [colorTarget, scene.backgroundColor, primaryFillHex, primaryStrokeHex, selectedTextProps]);

  useEffect(() => {
    setHexDraft(currentTargetColor.toUpperCase());
    setHexError(null);
  }, [currentTargetColor]);

  const applyColorToActiveTarget = (hex: string, coalesce = false) => {
    const normalized = (normalizeColorToHex(hex) ?? hex).toUpperCase();
    if (colorTarget === 'background') {
      onApplyBackground({ ...bgConfig, mode: 'solid', solidColor: normalized }, coalesce);
      return;
    }
    if (colorTarget.startsWith('swatch:')) {
      const prevHex = colorTarget.slice(7);
      onRecolorSwatchHex(prevHex, normalized);
      setColorTarget(`swatch:${normalized}`);
      return;
    }
    if (colorTarget === 'selected:fill' && primaryNode && !primaryNode.locked) {
      onSetNodeFill(primaryNode.id, normalized, coalesce);
      return;
    }
    if (colorTarget === 'selected:stroke' && primaryNode && !primaryNode.locked) {
      onSetNodeStroke(primaryNode.id, normalized, coalesce);
      if (primaryStrokeWidth <= 0) {
        onSetNodeStrokeWidth(primaryNode.id, 2, coalesce);
      }
      return;
    }
    if (colorTarget === 'text:all') {
      const updates: Record<string, TextEditPatch> = {};
      for (const { node } of textEntries) {
        if (!node.locked) {
          updates[node.id] = { color: normalized };
        }
      }
      onApplyBatchTextUpdates(updates);
    }
  };

  const handleApplyCoordinatedPalette = (combo: {
    id: string;
    background: string;
    accent: string;
    secondaryAccent: string;
    headingText: string;
    bodyText: string;
  }) => {
    if (onApplyCoordinatedPalette) {
      onApplyCoordinatedPalette(combo);
      triggerAppliedFeedback(combo.id);
      return;
    }
    onApplyBackground({ ...bgConfig, mode: 'solid', solidColor: combo.background });
    const textUpdates: Record<string, TextEditPatch> = {};
    for (const entry of textEntries) {
      if (entry.node.locked) continue;
      const p = getTextNodeProperties(entry.node, scene.cssRules, entry.ancestors);
      const isHeadline = p.fontSize >= 36;
      textUpdates[entry.node.id] = { color: isHeadline ? combo.headingText : combo.bodyText };
    }
    if (Object.keys(textUpdates).length > 0) {
      onApplyBatchTextUpdates(textUpdates);
    }
    const shapeSwatches = sceneSwatches.filter((sw) =>
      sw.nodeIds.some((nid) => {
        const found = findNodeWithAncestors(scene.nodes, nid)?.node;
        return found && found.tag !== 'text';
      })
    );
    if (shapeSwatches[0]) {
      onRecolorSwatchHex(shapeSwatches[0].color, combo.accent);
    }
    if (shapeSwatches[1] && shapeSwatches[1].color !== shapeSwatches[0]?.color) {
      onRecolorSwatchHex(shapeSwatches[1].color, combo.secondaryAccent);
    }
    triggerAppliedFeedback(combo.id);
  };

  const handleToggleFavorite = (hex: string) => {
    const clean = hex.toUpperCase();
    setFavoriteColors((prev) => {
      const exists = prev.some((c) => c.toUpperCase() === clean);
      const next = exists
        ? prev.filter((c) => c.toUpperCase() !== clean)
        : [clean, ...prev].slice(0, 24);
      saveFavoriteColors(next);
      return next;
    });
  };

  const handleUploadEmbeddedImage = async (file: File | undefined, fullBleed: boolean) => {
    setUploadError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      setUploadError('Please upload a PNG, JPG, or WebP image to embed inside the SVG.');
      return;
    }
    try {
      const { dataUrl, width, height } = await readImageFileAsDataUrl(file);
      if (fullBleed) {
        onSetBackgroundImage(dataUrl);
      } else {
        const imgNode = createImageNode(scene, dataUrl, {
          width,
          height,
          label: file.name.replace(/\.[^.]+$/, '').slice(0, 26) || 'Embedded Image',
        });
        onInsertSceneNode(imgNode, 'top');
        onSelectNodes([imgNode.id]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to embed image.');
    }
  };

  const handleInsertVectorPreset = (preset: VectorPresetItem) => {
    const newNode = preset.buildNode(scene);
    onInsertSceneNode(newNode, 'top');
    onSelectNodes([newNode.id]);
  };

  const isCurrentFavorite = favoriteColors.some(
    (c) => c.toUpperCase() === currentTargetColor.toUpperCase()
  );
  const activeCollection =
    COLOR_COLLECTIONS.find((c) => c.id === selectedCollectionId) ?? COLOR_COLLECTIONS[0];

  const filteredPresets = useMemo(
    () =>
      elementCategory === 'all'
        ? VECTOR_PRESETS
        : VECTOR_PRESETS.filter((p) => p.category === elementCategory),
    [elementCategory]
  );

  const navItems: Array<{ id: NavSectionId; label: string; icon: React.ReactNode }> = [
    { id: 'background', label: 'BG', icon: <Paintbrush className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { id: 'elements', label: 'Elements', icon: <Shapes className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-4 h-4 sm:w-5 sm:h-5" /> },
    { id: 'colors', label: 'Colors', icon: <Palette className="w-4 h-4 sm:w-5 sm:h-5" /> },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* LEFT NAVIGATION RAIL */}
      <nav
        aria-label="Editor sections"
        className="shrink-0 border-b lg:border-b-0 lg:border-r lg:w-[70px] flex lg:flex-col items-stretch lg:items-center gap-1 p-1.5 lg:py-3 lg:px-1.5 bg-white border-[#E4E4E7] dark:bg-[#101010] dark:border-[#292929]"
      >
        {navItems.map((item) => {
          const active = currentNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 lg:flex-none lg:w-full min-h-[46px] lg:min-h-[56px] px-1.5 py-1.5 rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] sm:text-[11px] font-medium cursor-pointer transition-colors border ${
                active
                  ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#C0C0C0] dark:text-[#E5E5E5]'
                  : 'bg-transparent border-transparent text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#111111] dark:text-[#999999] dark:hover:bg-[#151515] dark:hover:text-[#F5F5F5]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* SECTION CONTENT AREA */}
      <div className="flex-1 min-w-0 lg:overflow-y-auto ea-scrollbar p-4 space-y-5 bg-[#FAFAFA] dark:bg-[#151515]">
        {/* 1. BACKGROUND PANEL */}
        {currentNav === 'background' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Background</h2>
              <p className="text-xs mt-0.5 text-[#52525B] dark:text-[#999999]">
                Customize solid fills, SVG gradients, opacity, or background images independently.
              </p>
            </div>

            {activeBgImage && (
              <div className="p-3 rounded-lg border border-[#A1A1AA] bg-white dark:border-[#C0C0C0]/40 dark:bg-[#101010] space-y-2 text-xs">
                <div className="flex items-start gap-2 text-[#111111] dark:text-[#E5E5E5]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#3F3F46] dark:text-[#C0C0C0]" />
                  <span className="leading-relaxed text-[11px] text-[#3F3F46] dark:text-[#C0C0C0]">
                    A background image is covering the canvas color fill. Hide or remove it to see solid or gradient colors.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(activeBgImage.id)}
                    className="h-7 px-2.5 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[11px] font-medium text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#F5F5F5] cursor-pointer"
                  >
                    Hide Image
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveBackgroundNode(activeBgImage.id)}
                    className="h-7 px-2.5 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[11px] font-medium text-[#3F3F46] hover:text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] cursor-pointer"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            )}

            {/* Solid / Linear / Radial Toggle */}
            <div className="space-y-3 p-3.5 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010]">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-[#F4F4F5] border border-[#E4E4E7] dark:bg-[#090909] dark:border-[#292929]">
                {(
                  [
                    { id: 'solid', label: 'Solid' },
                    { id: 'linear', label: 'Linear' },
                    { id: 'radial', label: 'Radial' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onApplyBackground({ ...bgConfig, mode: mode.id })}
                    className={`h-7 rounded text-xs font-medium cursor-pointer transition-colors ${
                      !transparentBackground && bgConfig.mode === mode.id
                        ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                        : 'text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {bgConfig.mode === 'solid' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#52525B] dark:text-[#999999]">Fill Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Background solid color"
                        value={bgConfig.solidColor}
                        onChange={(e) =>
                          onApplyBackground(
                            { ...bgConfig, mode: 'solid', solidColor: e.target.value.toUpperCase() },
                            true
                          )
                        }
                        className="w-8 h-8 rounded border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] cursor-pointer p-0"
                      />
                      <span className="text-xs font-mono uppercase text-[#3F3F46] dark:text-[#C0C0C0]">
                        {bgConfig.solidColor}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {BG_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Background color ${hex}`}
                        onClick={() =>
                          onApplyBackground({ ...bgConfig, mode: 'solid', solidColor: hex })
                        }
                        className={`h-8 rounded border cursor-pointer transition-transform hover:scale-105 ${
                          bgConfig.solidColor.toUpperCase() === hex.toUpperCase() && !transparentBackground
                            ? 'border-[#18181B] ring-1 ring-[#18181B] dark:border-[#E5E5E5] dark:ring-[#E5E5E5]'
                            : 'border-[#D4D4D8] dark:border-[#292929]'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1 block">
                      <span className="text-[11px] text-[#52525B] dark:text-[#999999]">Start Color</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          aria-label="Gradient start color"
                          value={bgConfig.gradStart}
                          onChange={(e) =>
                            onApplyBackground(
                              { ...bgConfig, gradStart: e.target.value.toUpperCase() },
                              true
                            )
                          }
                          className="w-8 h-8 rounded border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] cursor-pointer p-0"
                        />
                        <span className="text-[11px] font-mono text-[#3F3F46] dark:text-[#C0C0C0]">
                          {bgConfig.gradStart}
                        </span>
                      </div>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-[11px] text-[#52525B] dark:text-[#999999]">End Color</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          aria-label="Gradient end color"
                          value={bgConfig.gradEnd}
                          onChange={(e) =>
                            onApplyBackground(
                              { ...bgConfig, gradEnd: e.target.value.toUpperCase() },
                              true
                            )
                          }
                          className="w-8 h-8 rounded border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] cursor-pointer p-0"
                        />
                        <span className="text-[11px] font-mono text-[#3F3F46] dark:text-[#C0C0C0]">
                          {bgConfig.gradEnd}
                        </span>
                      </div>
                    </label>
                  </div>

                  {bgConfig.mode === 'linear' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#52525B] dark:text-[#999999]">
                        <span>Gradient Direction</span>
                        <span className="tabular-nums text-[#111111] dark:text-[#E5E5E5]">{bgConfig.gradAngle}°</span>
                      </div>
                      <input
                        type="range"
                        aria-label="Gradient direction angle"
                        min={0}
                        max={360}
                        step={5}
                        value={bgConfig.gradAngle}
                        onChange={(e) =>
                          onApplyBackground(
                            { ...bgConfig, gradAngle: Number(e.target.value) },
                            true
                          )
                        }
                        className="w-full h-4 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Background Opacity */}
              <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#292929] space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#52525B] dark:text-[#999999]">
                  <span>Background Opacity</span>
                  <span className="tabular-nums text-[#111111] dark:text-[#E5E5E5]">
                    {Math.round(bgConfig.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Background opacity"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(bgConfig.opacity * 100)}
                  onChange={(e) =>
                    onApplyBackground(
                      { ...bgConfig, opacity: Number(e.target.value) / 100 },
                      true
                    )
                  }
                  className="w-full h-4 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
                />
              </div>

              <label className="pt-2 border-t border-[#E4E4E7] dark:border-[#292929] flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-[#3F3F46] dark:text-[#C0C0C0]">Transparent Export Background</span>
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => onSetTransparentBackground(e.target.checked)}
                  className="w-4 h-4 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
                />
              </label>
            </div>

            {/* Background Image & Layer Controls */}
            <div className="p-3.5 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] space-y-3">
              <h3 className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">Background Shapes &amp; Image</h3>
              <input
                ref={bgImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void handleUploadEmbeddedImage(f, true);
                }}
              />
              <button
                type="button"
                onClick={() => bgImageInputRef.current?.click()}
                className="w-full h-9 px-3 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-xs font-medium text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#F5F5F5] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#3F3F46] dark:text-[#C0C0C0]" />
                <span>
                  {bgNodes.some((n) => n.tag === 'image')
                    ? 'Replace Background Image'
                    : 'Upload Background Image (PNG/JPG)'}
                </span>
              </button>

              {bgNodes.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {bgNodes.map((bg) => (
                    <div
                      key={bg.id}
                      className="px-2.5 py-1.5 rounded border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectNodes([bg.id])}
                        className="truncate text-left text-[#111111] dark:text-[#E5E5E5] hover:underline cursor-pointer"
                      >
                        {bg.label}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleVisibility(bg.id)}
                          title={bg.visible ? `Hide ${bg.label}` : `Show ${bg.label}`}
                          aria-label={bg.visible ? `Hide ${bg.label}` : `Show ${bg.label}`}
                          className="w-6 h-6 rounded flex items-center justify-center text-[#52525B] hover:text-[#111111] hover:bg-[#E4E4E7] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525] cursor-pointer"
                        >
                          {bg.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-[#71717A] dark:text-[#737373]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleLock(bg.id)}
                          title={bg.locked ? 'Unlock to move/resize/rotate' : 'Lock background'}
                          className="px-1.5 py-0.5 rounded border border-[#E4E4E7] text-[10px] text-[#3F3F46] hover:bg-[#E4E4E7] dark:border-[#292929] dark:text-[#C0C0C0] dark:hover:bg-[#252525] inline-flex items-center gap-1 cursor-pointer"
                        >
                          {bg.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          <span>{bg.locked ? 'Locked' : 'Unlocked'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveBackgroundNode(bg.id)}
                          title="Remove background layer"
                          className="w-6 h-6 rounded flex items-center justify-center text-[#52525B] hover:text-[#111111] hover:bg-[#E4E4E7] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {primaryBgNode && (
                <p className="text-[11px] text-[#71717A] dark:text-[#737373] leading-relaxed">
                  Unlock the background layer above if you want to move, resize, or rotate it directly on the canvas.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 2. ELEMENTS LIBRARY & EMBEDDED IMAGE */}
        {currentNav === 'elements' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Vector Elements</h2>
              <p className="text-xs mt-0.5 text-[#52525B] dark:text-[#999999]">
                Insert real editable SVG shapes, borders, icons, botanicals, or embedded images.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'shapes', label: 'Shapes' },
                  { id: 'borders', label: 'Borders' },
                  { id: 'icons', label: 'Icons' },
                  { id: 'floral', label: 'Floral' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setElementCategory(cat.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer border transition-colors ${
                    elementCategory === cat.id
                      ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                      : 'bg-white text-[#52525B] border-[#E4E4E7] hover:bg-[#F4F4F5] hover:text-[#111111] dark:bg-[#101010] dark:text-[#999999] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Vector Preset Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleInsertVectorPreset(preset)}
                  className="p-3 rounded-lg border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] hover:border-[#A1A1AA] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] flex flex-col items-center gap-2 cursor-pointer transition-colors text-center"
                >
                  <svg
                    viewBox={preset.viewBox}
                    className="w-11 h-11 text-[#18181B] dark:text-[#E5E5E5]"
                    aria-hidden="true"
                  >
                    {preset.previewPaths.map((item, idx) =>
                      React.createElement(item.tag, { key: idx, ...item.attrs })
                    )}
                  </svg>
                  <span className="text-xs font-medium text-[#111111] dark:text-[#E5E5E5]">{preset.name}</span>
                </button>
              ))}
            </div>

            {/* Embedded Image Insert */}
            <div className="p-3.5 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">Embedded SVG Image</span>
                <span className="text-[10px] text-[#71717A] dark:text-[#737373]">PNG / JPG / WebP</span>
              </div>
              <input
                ref={elementImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void handleUploadEmbeddedImage(f, false);
                }}
              />
              <button
                type="button"
                onClick={() => elementImageInputRef.current?.click()}
                className="w-full h-10 px-3 rounded-md border border-[#18181B] bg-[#18181B] hover:bg-[#27272A] text-white dark:border-[#E5E5E5] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:text-[#090909] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload Image into SVG</span>
              </button>
              <p className="text-[11px] text-[#71717A] dark:text-[#737373] leading-relaxed">
                Embedded images can be moved, resized, rotated, cropped/fitted, opacity-adjusted, or replaced. Pixel painting/erasing is not supported inside SVGs.
              </p>
              {uploadError && <p className="text-[11px] text-[#111111] dark:text-[#E5E5E5]">{uploadError}</p>}
            </div>
          </div>
        )}

        {/* 3. TEXT PANEL */}
        {currentNav === 'text' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Text &amp; Wording</h2>
                <p className="text-xs mt-0.5 text-[#52525B] dark:text-[#999999]">
                  {textEntries.length > 0
                    ? `${textEntries.length} editable SVG ${
                        textEntries.length === 1 ? 'text element' : 'text elements'
                      } detected.`
                    : 'Insert real SVG text headings or body copy below.'}
                </p>
              </div>
              {textEntries.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenFontStudio}
                  className="px-2.5 py-1.5 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] hover:border-[#A1A1AA] text-[11px] font-medium text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#E5E5E5] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Type className="w-3 h-3" />
                  <span>Font Studio</span>
                </button>
              )}
            </div>

            {/* Single document-level font scan summary */}
            {textEntries.length > 0 && fontSummary.missingCount > 0 && (
              <div
                role="status"
                className="p-3 rounded-lg border border-[#A1A1AA] bg-white dark:border-[#C0C0C0]/45 dark:bg-[#101010] space-y-2 text-xs"
              >
                <div className="flex items-start gap-2 text-[#111111] dark:text-[#E5E5E5]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#18181B] dark:text-[#E5E5E5]" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-[#111111] dark:text-[#F5F5F5] leading-snug break-words">
                      {fontSummary.summaryText}
                    </p>
                    <p className="text-[11px] text-[#52525B] dark:text-[#999999] leading-snug break-words">
                      {fontSummary.entries
                        .filter((e) => e.isMissing)
                        .map((e) => `${e.originalFamily} → ${e.resolvedFallback}`)
                        .join(' · ')}{' '}
                      (preview fallback applied; original font kept)
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = firstMissingEntry?.affectedNodeIds[0];
                      if (targetId) onSelectNodes([targetId]);
                      onOpenFontStudio();
                    }}
                    className="h-7 px-2.5 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-[11px] font-medium text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#F5F5F5] cursor-pointer"
                  >
                    Replace
                  </button>
                  {onOpenUploadFont && (
                    <button
                      type="button"
                      onClick={() => onOpenUploadFont(firstMissingEntry?.originalFamily)}
                      className="h-7 px-2.5 rounded border border-[#E4E4E7] bg-[#F4F4F5] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-[11px] font-medium text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#E5E5E5] cursor-pointer"
                    >
                      Upload font
                    </button>
                  )}
                </div>
              </div>
            )}

            {textEntries.length > 0 &&
              fontSummary.missingCount === 0 &&
              fontSummary.browserAvailableCount > 0 && (
                <div className="px-2.5 py-1.5 rounded border border-[#E4E4E7] bg-white text-[11px] text-[#52525B] dark:border-[#292929] dark:bg-[#101010] dark:text-[#999999] leading-snug">
                  {fontSummary.summaryText}
                </div>
              )}

            {/* Quick Text Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onAddTextPreset('heading')}
                className="h-9 px-2 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] hover:border-[#A1A1AA] text-xs font-semibold text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#F5F5F5] cursor-pointer"
              >
                + Heading
              </button>
              <button
                type="button"
                onClick={() => onAddTextPreset('subheading')}
                className="h-9 px-2 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] hover:border-[#A1A1AA] text-xs font-medium text-[#18181B] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#E5E5E5] cursor-pointer"
              >
                + Subhead
              </button>
              <button
                type="button"
                onClick={() => onAddTextPreset('body')}
                className="h-9 px-2 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#F4F4F5] hover:border-[#A1A1AA] text-xs text-[#3F3F46] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#C0C0C0] cursor-pointer"
              >
                + Body
              </button>
            </div>

            {textEntries.length === 0 ? (
              <div className="p-4 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] space-y-2 text-xs leading-relaxed text-[#52525B] dark:text-[#999999]">
                <p className="font-medium text-[#111111] dark:text-[#F5F5F5]">No existing &lt;text&gt; nodes found</p>
                <p>
                  If your design converted lettering to outlined vector paths, click any text preset button above to add real editable SVG text.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {textEntries.map(({ node, ancestors }) => (
                  <TextLayerCard
                    key={node.id}
                    node={node}
                    ancestors={ancestors}
                    scene={scene}
                    isSelected={selectedIds.includes(node.id)}
                    fontRegistryVersion={fontRegistryVersion}
                    onSelectNodes={onSelectNodes}
                    onUpdateTextNode={onUpdateTextNode}
                    onCommitTextBoundary={onCommitTextBoundary}
                    onToggleVisibility={onToggleVisibility}
                    onToggleLock={onToggleLock}
                    onDeleteNodes={onDeleteNodes}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. COLORS & PALETTES */}
        {currentNav === 'colors' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Colors &amp; Palettes</h2>
              <p className="text-xs mt-0.5 text-[#52525B] dark:text-[#999999]">
                Recolor detected SVG swatches, selected shapes, background, or text.
              </p>
            </div>

            <section className="space-y-2.5">
              <span className="block text-xs font-medium text-[#52525B] dark:text-[#999999]">Target to Recolor</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setColorTarget('background')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border inline-flex items-center gap-1.5 transition-colors ${
                    colorTarget === 'background'
                      ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                      : 'bg-white border-[#E4E4E7] text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5] dark:bg-[#101010] dark:border-[#292929] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-[#D4D4D8] dark:border-[#292929]"
                    style={{ backgroundColor: scene.backgroundColor }}
                  />
                  <span>Background</span>
                </button>

                {primaryNode && !primaryNode.locked && (
                  <>
                    <button
                      type="button"
                      onClick={() => setColorTarget('selected:fill')}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border transition-colors ${
                        colorTarget === 'selected:fill'
                          ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                          : 'bg-white border-[#E4E4E7] text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5] dark:bg-[#101010] dark:border-[#292929] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525]'
                      }`}
                    >
                      Selected Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorTarget('selected:stroke')}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border transition-colors ${
                        colorTarget === 'selected:stroke'
                          ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                          : 'bg-white border-[#E4E4E7] text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5] dark:bg-[#101010] dark:border-[#292929] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525]'
                      }`}
                    >
                      Selected Stroke
                    </button>
                  </>
                )}

                {textEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setColorTarget('text:all')}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border transition-colors ${
                      colorTarget === 'text:all'
                        ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                        : 'bg-white border-[#E4E4E7] text-[#52525B] hover:text-[#111111] hover:bg-[#F4F4F5] dark:bg-[#101010] dark:border-[#292929] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525]'
                    }`}
                  >
                    All Text
                  </button>
                )}
              </div>

              {sceneSwatches.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <span className="block text-[11px] text-[#71717A] dark:text-[#737373]">
                    Detected SVG Swatches (batch recolor matching elements)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sceneSwatches.map((sw) => {
                      const tid: ColorTargetId = `swatch:${sw.color}`;
                      const active = colorTarget === tid;
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          onClick={() => setColorTarget(tid)}
                          title={`${sw.color} (${sw.usageCount} uses)`}
                          className={`px-2 py-1 rounded border text-[11px] font-mono inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                              : 'bg-white border-[#E4E4E7] text-[#3F3F46] hover:bg-[#F4F4F5] dark:bg-[#101010] dark:border-[#292929] dark:text-[#C0C0C0] dark:hover:bg-[#252525]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-[#D4D4D8] dark:border-[#292929]"
                            style={{ backgroundColor: sw.color }}
                          />
                          <span>{sw.color}</span>
                          <span className="text-[10px] text-[#71717A] dark:text-[#737373]">×{sw.usageCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Color Picker + HEX */}
            <section className="p-3 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="custom-hex-input" className="text-xs font-medium text-[#52525B] dark:text-[#999999]">
                  Color Picker &amp; HEX
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(currentTargetColor)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    isCurrentFavorite
                      ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
                      : 'bg-[#F4F4F5] border-[#E4E4E7] text-[#3F3F46] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#151515] dark:border-[#292929] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  <Bookmark className="w-3 h-3" />
                  <span>{isCurrentFavorite ? 'Saved' : 'Save Color'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Color wheel picker"
                  value={currentTargetColor}
                  onChange={(e) => applyColorToActiveTarget(e.target.value, true)}
                  className="w-11 h-10 rounded border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] cursor-pointer p-0 shrink-0"
                />
                <input
                  id="custom-hex-input"
                  type="text"
                  value={hexDraft}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setHexDraft(nextVal);
                    const cleaned = nextVal.trim();
                    const normalized = normalizeHexInput(cleaned);
                    if (normalized && /^#?[0-9A-F]{6}$/i.test(cleaned)) {
                      setHexError(null);
                      applyColorToActiveTarget(normalized);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const normalized = normalizeHexInput(hexDraft);
                      if (normalized) {
                        setHexError(null);
                        applyColorToActiveTarget(normalized);
                      } else {
                        setHexError('Enter a valid 6-digit hex (e.g. #748660)');
                      }
                    }
                  }}
                  onBlur={() => {
                    const normalized = normalizeHexInput(hexDraft);
                    if (normalized) {
                      setHexError(null);
                      applyColorToActiveTarget(normalized);
                    } else {
                      setHexError('Enter a valid hex code like #748660');
                    }
                  }}
                  placeholder="#FAF7F0"
                  maxLength={7}
                  className="flex-1 min-h-[40px] px-3 rounded-md border text-xs font-mono uppercase bg-white border-[#E4E4E7] text-[#111111] focus:outline-none focus:border-[#18181B] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:focus:border-[#C0C0C0]"
                />
              </div>

              {hexError && <p className="text-[11px] text-[#3F3F46] dark:text-[#C0C0C0]">{hexError}</p>}
            </section>

            {/* Saved Favorite Colors */}
            {favoriteColors.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[#52525B] dark:text-[#999999]">Favorite Colors</h3>
                  <span className="text-[11px] text-[#71717A] dark:text-[#737373] tabular-nums">
                    {favoriteColors.length} saved
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favoriteColors.map((hex) => {
                    const active = hex.toLowerCase() === currentTargetColor.toLowerCase();
                    return (
                      <div key={hex} className="relative group">
                        <button
                          type="button"
                          onClick={() => applyColorToActiveTarget(hex)}
                          aria-label={`Apply favorite color ${hex}`}
                          title={hex}
                          className={`w-9 h-9 rounded-full border cursor-pointer transition-transform hover:scale-105 ${
                            active
                              ? 'border-[#18181B] ring-2 ring-[#52525B] dark:border-[#E5E5E5] dark:ring-[#C0C0C0] ring-offset-2 ring-offset-[#FAFAFA] dark:ring-offset-[#151515]'
                              : 'border-[#D4D4D8] dark:border-[#292929]'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(hex)}
                          aria-label={`Remove ${hex} from favorites`}
                          className="hidden group-hover:flex w-4 h-4 rounded-full bg-white border border-[#52525B] text-[#111111] dark:bg-[#090909] dark:border-[#C0C0C0] dark:text-[#F5F5F5] items-center justify-center absolute -top-1 -right-1 cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 15 Curated Color Collections */}
            <section className="space-y-3 pt-3 border-t border-[#E4E4E7] dark:border-[#292929]">
              <div className="space-y-1.5">
                <label
                  htmlFor="color-collection-select"
                  className="block text-xs font-medium text-[#52525B] dark:text-[#999999]"
                >
                  Color Collections ({COLOR_COLLECTIONS.length})
                </label>
                <select
                  id="color-collection-select"
                  value={activeCollection.id}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-md border text-xs font-medium cursor-pointer bg-white border-[#E4E4E7] text-[#111111] focus:outline-none focus:border-[#18181B] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:focus:border-[#C0C0C0]"
                >
                  {COLOR_COLLECTIONS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {activeCollection.swatches.map((sw) => {
                  const active = sw.hex.toLowerCase() === currentTargetColor.toLowerCase();
                  return (
                    <button
                      key={`${activeCollection.id}-${sw.hex}`}
                      type="button"
                      onClick={() => applyColorToActiveTarget(sw.hex)}
                      aria-label={`Apply ${sw.name} (${sw.hex})`}
                      title={`${sw.name} · ${sw.hex}`}
                      className={`w-9 h-9 rounded-full border cursor-pointer transition-transform hover:scale-105 ${
                        active
                          ? 'border-[#18181B] ring-2 ring-[#52525B] dark:border-[#E5E5E5] dark:ring-[#C0C0C0] ring-offset-2 ring-offset-[#FAFAFA] dark:ring-offset-[#151515]'
                          : 'border-[#D4D4D8] dark:border-[#292929]'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  );
                })}
              </div>

              {activeCollection.combinations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-medium text-[#52525B] dark:text-[#999999]">
                    Coordinated Combinations
                  </span>
                  <div className="space-y-2">
                    {activeCollection.combinations.map((combo) => {
                      const isJustApplied = appliedActionId === combo.id;
                      return (
                        <button
                          key={combo.id}
                          type="button"
                          onClick={() => handleApplyCoordinatedPalette(combo)}
                          className={`w-full px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                            isJustApplied
                              ? 'bg-[#E4E4E7] border-[#18181B] dark:bg-[#252525] dark:border-[#E5E5E5]'
                              : 'bg-white border-[#E4E4E7] hover:bg-[#F4F4F5] hover:border-[#A1A1AA] dark:bg-[#101010] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                              {combo.label}
                            </div>
                            <div className="text-[11px] text-[#52525B] dark:text-[#999999] truncate">
                              {combo.description}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {[combo.background, combo.accent, combo.headingText, combo.bodyText].map(
                                (dotHex, idx) => (
                                  <span
                                    key={`${combo.id}-${idx}`}
                                    className="w-4 h-4 rounded-full border border-[#D4D4D8] dark:border-[#292929]"
                                    style={{ backgroundColor: dotHex }}
                                  />
                                )
                              )}
                            </div>
                          </div>

                          <span className="text-xs font-medium shrink-0 inline-flex items-center gap-1 text-[#3F3F46] dark:text-[#C0C0C0]">
                            {isJustApplied && <Check className="w-3.5 h-3.5 text-[#18181B] dark:text-[#E5E5E5]" />}
                            {isJustApplied ? 'Applied' : 'Apply'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {onOpenDownload && (
          <div className="pt-2 lg:hidden">
            <button
              type="button"
              onClick={onOpenDownload}
              className="w-full min-h-[44px] px-4 rounded-md inline-flex items-center justify-center text-sm font-semibold cursor-pointer bg-[#18181B] hover:bg-[#27272A] text-white border border-[#18181B] hover:border-[#27272A] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:text-[#090909] dark:border-[#E5E5E5] dark:hover:border-[#C0C0C0] transition-colors"
            >
              Download SVG
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
