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
  BackgroundConfig,
  collectAllNodes,
  collectTextNodesWithAncestors,
  createImageNode,
  extractBackgroundConfig,
  extractSceneColorSwatches,
  findNodeWithAncestors,
  getEffectiveNodeProp,
  getTextNodeProperties,
  normalizeColorToHex,
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
  onOpenDownload?: () => void;
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

export const FieldPanel: React.FC<FieldPanelProps> = ({
  scene,
  transparentBackground,
  selectedIds,
  activeNav: controlledNav,
  onChangeNav,
  onSelectNodes,
  onUpdateTextNode,
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
  onOpenDownload,
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
    [selectedTextEntry, scene.cssRules]
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
        className="shrink-0 border-b lg:border-b-0 lg:border-r lg:w-[70px] flex lg:flex-col items-stretch lg:items-center gap-1 p-1.5 lg:py-3 lg:px-1.5 bg-[#101010] border-[#292929]"
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
                  ? 'bg-[#252525] border-[#C0C0C0] text-[#E5E5E5]'
                  : 'bg-transparent border-transparent text-[#999999] hover:bg-[#151515] hover:text-[#F5F5F5]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* SECTION CONTENT AREA */}
      <div className="flex-1 min-w-0 lg:overflow-y-auto ea-scrollbar p-4 space-y-5 bg-[#151515]">
        {/* 1. BACKGROUND PANEL */}
        {currentNav === 'background' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#F5F5F5]">Background</h2>
              <p className="text-xs mt-0.5 text-[#999999]">
                Customize solid fills, SVG gradients, opacity, or background images independently.
              </p>
            </div>

            {activeBgImage && (
              <div className="p-3 rounded-lg border border-[#C0C0C0]/40 bg-[#101010] space-y-2 text-xs">
                <div className="flex items-start gap-2 text-[#E5E5E5]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#C0C0C0]" />
                  <span className="leading-relaxed text-[11px] text-[#C0C0C0]">
                    A background image is covering the canvas color fill. Hide or remove it to see solid or gradient colors.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(activeBgImage.id)}
                    className="h-7 px-2.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[11px] font-medium text-[#F5F5F5] cursor-pointer"
                  >
                    Hide Image
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveBackgroundNode(activeBgImage.id)}
                    className="h-7 px-2.5 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] text-[11px] font-medium text-[#C0C0C0] hover:text-[#F5F5F5] cursor-pointer"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            )}

            {/* Solid / Linear / Radial Toggle */}
            <div className="space-y-3 p-3.5 rounded-lg border border-[#292929] bg-[#101010]">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-[#090909] border border-[#292929]">
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
                        ? 'bg-[#E5E5E5] text-[#090909]'
                        : 'text-[#999999] hover:text-[#F5F5F5]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {bgConfig.mode === 'solid' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#999999]">Fill Color</span>
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
                        className="w-8 h-8 rounded border border-[#292929] bg-[#0D0D0D] cursor-pointer p-0"
                      />
                      <span className="text-xs font-mono uppercase text-[#C0C0C0]">
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
                            ? 'border-[#E5E5E5] ring-1 ring-[#E5E5E5]'
                            : 'border-[#292929]'
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
                      <span className="text-[11px] text-[#999999]">Start Color</span>
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
                          className="w-8 h-8 rounded border border-[#292929] bg-[#0D0D0D] cursor-pointer p-0"
                        />
                        <span className="text-[11px] font-mono text-[#C0C0C0]">
                          {bgConfig.gradStart}
                        </span>
                      </div>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-[11px] text-[#999999]">End Color</span>
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
                          className="w-8 h-8 rounded border border-[#292929] bg-[#0D0D0D] cursor-pointer p-0"
                        />
                        <span className="text-[11px] font-mono text-[#C0C0C0]">
                          {bgConfig.gradEnd}
                        </span>
                      </div>
                    </label>
                  </div>

                  {bgConfig.mode === 'linear' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#999999]">
                        <span>Gradient Direction</span>
                        <span className="tabular-nums text-[#E5E5E5]">{bgConfig.gradAngle}°</span>
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
                        className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Background Opacity */}
              <div className="pt-2 border-t border-[#292929] space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#999999]">
                  <span>Background Opacity</span>
                  <span className="tabular-nums text-[#E5E5E5]">
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
                  className="w-full h-4 accent-[#E5E5E5] cursor-pointer"
                />
              </div>

              <label className="pt-2 border-t border-[#292929] flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs text-[#C0C0C0]">Transparent Export Background</span>
                <input
                  type="checkbox"
                  checked={transparentBackground}
                  onChange={(e) => onSetTransparentBackground(e.target.checked)}
                  className="w-4 h-4 accent-[#E5E5E5] cursor-pointer"
                />
              </label>
            </div>

            {/* Background Image & Layer Controls */}
            <div className="p-3.5 rounded-lg border border-[#292929] bg-[#101010] space-y-3">
              <h3 className="text-xs font-medium text-[#F5F5F5]">Background Shapes &amp; Image</h3>
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
                className="w-full h-9 px-3 rounded-md border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] text-xs font-medium text-[#F5F5F5] inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#C0C0C0]" />
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
                      className="px-2.5 py-1.5 rounded border border-[#292929] bg-[#151515] flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectNodes([bg.id])}
                        className="truncate text-left text-[#E5E5E5] hover:underline cursor-pointer"
                      >
                        {bg.label}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleVisibility(bg.id)}
                          title={bg.visible ? `Hide ${bg.label}` : `Show ${bg.label}`}
                          aria-label={bg.visible ? `Hide ${bg.label}` : `Show ${bg.label}`}
                          className="w-6 h-6 rounded flex items-center justify-center text-[#C0C0C0] hover:text-[#F5F5F5] hover:bg-[#252525] cursor-pointer"
                        >
                          {bg.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-[#737373]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleLock(bg.id)}
                          title={bg.locked ? 'Unlock to move/resize/rotate' : 'Lock background'}
                          className="px-1.5 py-0.5 rounded border border-[#292929] text-[10px] text-[#C0C0C0] hover:bg-[#252525] inline-flex items-center gap-1 cursor-pointer"
                        >
                          {bg.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          <span>{bg.locked ? 'Locked' : 'Unlocked'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveBackgroundNode(bg.id)}
                          title="Remove background layer"
                          className="w-6 h-6 rounded flex items-center justify-center text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {primaryBgNode && (
                <p className="text-[11px] text-[#737373] leading-relaxed">
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
              <h2 className="text-base font-medium text-[#F5F5F5]">Vector Elements</h2>
              <p className="text-xs mt-0.5 text-[#999999]">
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
                      ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                      : 'bg-[#101010] text-[#999999] border-[#292929] hover:bg-[#252525] hover:text-[#F5F5F5]'
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
                  className="p-3 rounded-lg border border-[#292929] bg-[#101010] hover:bg-[#252525] hover:border-[#C0C0C0] flex flex-col items-center gap-2 cursor-pointer transition-colors text-center"
                >
                  <svg
                    viewBox={preset.viewBox}
                    className="w-11 h-11 text-[#E5E5E5]"
                    aria-hidden="true"
                  >
                    {preset.previewPaths.map((item, idx) =>
                      React.createElement(item.tag, { key: idx, ...item.attrs })
                    )}
                  </svg>
                  <span className="text-xs font-medium text-[#E5E5E5]">{preset.name}</span>
                </button>
              ))}
            </div>

            {/* Embedded Image Insert */}
            <div className="p-3.5 rounded-lg border border-[#292929] bg-[#101010] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#F5F5F5]">Embedded SVG Image</span>
                <span className="text-[10px] text-[#737373]">PNG / JPG / WebP</span>
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
                className="w-full h-10 px-3 rounded-md border border-[#E5E5E5] bg-[#E5E5E5] hover:bg-[#C0C0C0] text-[#090909] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload Image into SVG</span>
              </button>
              <p className="text-[11px] text-[#737373] leading-relaxed">
                Embedded images can be moved, resized, rotated, cropped/fitted, opacity-adjusted, or replaced. Pixel painting/erasing is not supported inside SVGs.
              </p>
              {uploadError && <p className="text-[11px] text-[#E5E5E5]">{uploadError}</p>}
            </div>
          </div>
        )}

        {/* 3. TEXT PANEL */}
        {currentNav === 'text' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-medium text-[#F5F5F5]">Text &amp; Wording</h2>
                <p className="text-xs mt-0.5 text-[#999999]">
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
                  className="px-2.5 py-1.5 rounded-md border border-[#292929] bg-[#101010] hover:bg-[#252525] hover:border-[#C0C0C0] text-[11px] font-medium text-[#E5E5E5] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Type className="w-3 h-3" />
                  <span>Font Studio</span>
                </button>
              )}
            </div>

            {/* Quick Text Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onAddTextPreset('heading')}
                className="h-9 px-2 rounded-md border border-[#292929] bg-[#101010] hover:bg-[#252525] hover:border-[#C0C0C0] text-xs font-semibold text-[#F5F5F5] cursor-pointer"
              >
                + Heading
              </button>
              <button
                type="button"
                onClick={() => onAddTextPreset('subheading')}
                className="h-9 px-2 rounded-md border border-[#292929] bg-[#101010] hover:bg-[#252525] hover:border-[#C0C0C0] text-xs font-medium text-[#E5E5E5] cursor-pointer"
              >
                + Subhead
              </button>
              <button
                type="button"
                onClick={() => onAddTextPreset('body')}
                className="h-9 px-2 rounded-md border border-[#292929] bg-[#101010] hover:bg-[#252525] hover:border-[#C0C0C0] text-xs text-[#C0C0C0] cursor-pointer"
              >
                + Body
              </button>
            </div>

            {textEntries.length === 0 ? (
              <div className="p-4 rounded-lg border border-[#292929] bg-[#101010] space-y-2 text-xs leading-relaxed text-[#999999]">
                <p className="font-medium text-[#F5F5F5]">No existing &lt;text&gt; nodes found</p>
                <p>
                  If your design converted lettering to outlined vector paths, click any text preset button above to add real editable SVG text.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {textEntries.map(({ node, ancestors }) => {
                  const props = getTextNodeProperties(node, scene.cssRules, ancestors);
                  const isSelected = selectedIds.includes(node.id);
                  const fontDef = getFontDefinition(props.fontFamily);

                  return (
                    <div
                      key={node.id}
                      onClick={() => onSelectNodes([node.id])}
                      className={`p-3 rounded-lg border space-y-2.5 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#1A1A1A] border-[#E5E5E5]'
                          : 'bg-[#101010] border-[#292929] hover:border-[#C0C0C0]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="text-xs font-medium text-[#F5F5F5] truncate">
                            {node.label}
                          </span>
                          <span className="text-[10px] text-[#737373] truncate">
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
                            className="w-7 h-7 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-center text-[#C0C0C0] cursor-pointer"
                          >
                            {node.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-[#737373]" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleLock(node.id);
                            }}
                            aria-label={node.locked ? `Unlock ${node.label}` : `Lock ${node.label}`}
                            className="w-7 h-7 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-center text-[#C0C0C0] cursor-pointer"
                          >
                            {node.locked ? (
                              <Lock className="w-3.5 h-3.5 text-[#E5E5E5]" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-[#737373]" />
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
                              className="w-7 h-7 rounded border border-[#292929] bg-[#151515] hover:bg-[#252525] flex items-center justify-center text-[#999999] hover:text-[#F5F5F5] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {props.isFontFallback && (
                        <div className="px-2 py-1.5 rounded border border-[#C0C0C0]/40 bg-[#151515] text-[11px] text-[#C0C0C0] flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <AlertTriangle className="w-3 h-3 shrink-0 text-[#E5E5E5]" />
                            <span className="truncate">
                              &ldquo;{props.originalFontFamily}&rdquo; not bundled · previewing as{' '}
                              {props.fallbackPreviewFamily}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNodes([node.id]);
                              onOpenFontStudio();
                            }}
                            className="underline text-[#F5F5F5] shrink-0 cursor-pointer"
                          >
                            Replace
                          </button>
                        </div>
                      )}

                      {node.tspans && node.tspans.length > 1 ? (
                        <div className="space-y-1.5">
                          <div className="text-[10px] text-[#737373]">
                            Multi-line spans ({node.tspans.length}) — positions preserved
                          </div>
                          {node.tspans.map((ts, idx) => (
                            <input
                              key={ts.id}
                              type="text"
                              disabled={node.locked}
                              aria-label={`${node.label} line ${idx + 1}`}
                              value={ts.text}
                              onFocus={() => onSelectNodes([node.id])}
                              onChange={(e) =>
                                onUpdateTextNode(
                                  node.id,
                                  { tspanIndex: idx, tspanText: e.target.value },
                                  true
                                )
                              }
                              className="w-full min-h-[34px] px-2.5 py-1 rounded border text-xs bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0] disabled:opacity-50"
                            />
                          ))}
                        </div>
                      ) : (
                        <textarea
                          rows={props.fullText.includes('\n') ? 3 : 2}
                          disabled={node.locked}
                          aria-label={node.label}
                          value={props.fullText}
                          onFocus={() => onSelectNodes([node.id])}
                          onChange={(e) =>
                            onUpdateTextNode(node.id, { text: e.target.value }, true)
                          }
                          className="w-full px-2.5 py-1.5 rounded border text-xs leading-relaxed bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0] resize-y disabled:opacity-50"
                        />
                      )}

                      {isSelected && !node.locked && (
                        <div className="pt-2 border-t border-[#292929] flex flex-wrap items-center justify-between gap-2">
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
                              className="w-6 h-6 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0"
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
                                  ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                                  : 'bg-[#0D0D0D] text-[#C0C0C0] border-[#292929]'
                              }`}
                            >
                              B
                            </button>
                            {(!fontDef || fontDef.hasItalic) && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateTextNode(node.id, {
                                    fontStyle:
                                      props.fontStyle === 'italic' ? 'normal' : 'italic',
                                  })
                                }
                                className={`h-7 px-2 rounded border text-[11px] italic cursor-pointer ${
                                  props.fontStyle === 'italic'
                                    ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                                    : 'bg-[#0D0D0D] text-[#C0C0C0] border-[#292929]'
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
                                  ? 'bg-[#E5E5E5] text-[#090909] border-[#E5E5E5]'
                                  : 'bg-[#0D0D0D] text-[#C0C0C0] border-[#292929]'
                              }`}
                            >
                              <Underline className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="inline-flex rounded border border-[#292929] overflow-hidden">
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
                                    ? 'bg-[#E5E5E5] text-[#090909]'
                                    : 'bg-[#0D0D0D] text-[#999999] hover:bg-[#252525]'
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
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. COLORS & PALETTES */}
        {currentNav === 'colors' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-medium text-[#F5F5F5]">Colors &amp; Palettes</h2>
              <p className="text-xs mt-0.5 text-[#999999]">
                Recolor detected SVG swatches, selected shapes, background, or text.
              </p>
            </div>

            <section className="space-y-2.5">
              <span className="block text-xs font-medium text-[#999999]">Target to Recolor</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setColorTarget('background')}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border inline-flex items-center gap-1.5 transition-colors ${
                    colorTarget === 'background'
                      ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                      : 'bg-[#101010] border-[#292929] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-[#292929]"
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
                          ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                          : 'bg-[#101010] border-[#292929] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525]'
                      }`}
                    >
                      Selected Fill
                    </button>
                    <button
                      type="button"
                      onClick={() => setColorTarget('selected:stroke')}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer border transition-colors ${
                        colorTarget === 'selected:stroke'
                          ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                          : 'bg-[#101010] border-[#292929] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525]'
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
                        ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                        : 'bg-[#101010] border-[#292929] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525]'
                    }`}
                  >
                    All Text
                  </button>
                )}
              </div>

              {sceneSwatches.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <span className="block text-[11px] text-[#737373]">
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
                              ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                              : 'bg-[#101010] border-[#292929] text-[#C0C0C0] hover:bg-[#252525]'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-[#292929]"
                            style={{ backgroundColor: sw.color }}
                          />
                          <span>{sw.color}</span>
                          <span className="text-[10px] text-[#737373]">×{sw.usageCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Color Picker + HEX */}
            <section className="p-3 rounded-lg border border-[#292929] bg-[#101010] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="custom-hex-input" className="text-xs font-medium text-[#999999]">
                  Color Picker &amp; HEX
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(currentTargetColor)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    isCurrentFavorite
                      ? 'bg-[#252525] border-[#E5E5E5] text-[#F5F5F5]'
                      : 'bg-[#151515] border-[#292929] text-[#C0C0C0] hover:bg-[#252525] hover:text-[#F5F5F5]'
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
                  className="w-11 h-10 rounded border border-[#292929] cursor-pointer bg-[#0D0D0D] p-0 shrink-0"
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
                  className="flex-1 min-h-[40px] px-3 rounded-md border text-xs font-mono uppercase bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0]"
                />
              </div>

              {hexError && <p className="text-[11px] text-[#C0C0C0]">{hexError}</p>}
            </section>

            {/* Saved Favorite Colors */}
            {favoriteColors.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[#999999]">Favorite Colors</h3>
                  <span className="text-[11px] text-[#737373] tabular-nums">
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
                              ? 'border-[#E5E5E5] ring-2 ring-[#C0C0C0] ring-offset-2 ring-offset-[#151515]'
                              : 'border-[#292929]'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(hex)}
                          aria-label={`Remove ${hex} from favorites`}
                          className="hidden group-hover:flex w-4 h-4 rounded-full bg-[#090909] border border-[#C0C0C0] text-[#F5F5F5] items-center justify-center absolute -top-1 -right-1 cursor-pointer"
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
            <section className="space-y-3 pt-3 border-t border-[#292929]">
              <div className="space-y-1.5">
                <label
                  htmlFor="color-collection-select"
                  className="block text-xs font-medium text-[#999999]"
                >
                  Color Collections ({COLOR_COLLECTIONS.length})
                </label>
                <select
                  id="color-collection-select"
                  value={activeCollection.id}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-md border text-xs font-medium cursor-pointer bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] focus:outline-none focus:border-[#C0C0C0]"
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
                          ? 'border-[#E5E5E5] ring-2 ring-[#C0C0C0] ring-offset-2 ring-offset-[#151515]'
                          : 'border-[#292929]'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  );
                })}
              </div>

              {activeCollection.combinations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-medium text-[#999999]">
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
                              ? 'bg-[#252525] border-[#E5E5E5]'
                              : 'bg-[#101010] border-[#292929] hover:bg-[#252525] hover:border-[#C0C0C0]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-xs font-medium text-[#F5F5F5]">
                              {combo.label}
                            </div>
                            <div className="text-[11px] text-[#999999] truncate">
                              {combo.description}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {[combo.background, combo.accent, combo.headingText, combo.bodyText].map(
                                (dotHex, idx) => (
                                  <span
                                    key={`${combo.id}-${idx}`}
                                    className="w-4 h-4 rounded-full border border-[#292929]"
                                    style={{ backgroundColor: dotHex }}
                                  />
                                )
                              )}
                            </div>
                          </div>

                          <span className="text-xs font-medium shrink-0 inline-flex items-center gap-1 text-[#C0C0C0]">
                            {isJustApplied && <Check className="w-3.5 h-3.5 text-[#E5E5E5]" />}
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
              className="w-full min-h-[44px] px-4 rounded-md inline-flex items-center justify-center text-sm font-semibold cursor-pointer bg-[#E5E5E5] hover:bg-[#C0C0C0] text-[#090909] border border-[#E5E5E5] hover:border-[#C0C0C0] transition-colors"
            >
              Download SVG
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
