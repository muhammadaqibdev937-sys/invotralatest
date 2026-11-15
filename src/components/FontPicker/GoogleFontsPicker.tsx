import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, Type, X } from 'lucide-react';
import {
  FONT_STYLE_CATEGORIES,
  FontStyleCategory,
  getUploadedFontEngineEntry,
  SUPPORTED_FONT_CATALOG,
} from '../../engine/fonts';
import {
  getTextNodeProperties,
  SvgSceneNode,
  TextEditPatch,
} from '../../engine/svgScene';
import { ensureFontsLoaded, getFontDefinition } from '../../services/fontLoader';
import { getSvgFontPairingSuggestions } from '../../services/fontPairingService';
import { usePersistedUploadedFonts } from '../../hooks/usePersistedUploadedFonts';

interface GoogleFontsPickerProps {
  textNodes: Array<{ node: SvgSceneNode; ancestors: SvgSceneNode[] }>;
  cssRules: Record<string, Record<string, string>>;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  onUpdateTextNode: (nodeId: string, patch: TextEditPatch, coalesce?: boolean) => void;
  onApplyBatchTextUpdates: (updates: Record<string, TextEditPatch>) => void;
  onPreviewFont?: (nodeId: string, fontFamily: string | null) => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

type FontSubTab = 'library' | 'pairings';

function getCssFallback(family: string): string {
  const cat = getFontDefinition(family)?.category ?? getUploadedFontEngineEntry(family)?.category;
  if (cat === 'Script') return `"${family}", cursive`;
  if (cat === 'Sans') return `"${family}", sans-serif`;
  if (cat === 'Serif') return `"${family}", serif`;
  return family;
}

export const GoogleFontsPicker: React.FC<GoogleFontsPickerProps> = ({
  textNodes,
  cssRules,
  selectedNodeId,
  onSelectNode,
  onUpdateTextNode,
  onApplyBatchTextUpdates,
  onPreviewFont,
  isModal = false,
  onCloseModal,
}) => {
  const [fontSubTab, setFontSubTab] = useState<FontSubTab>('library');
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategory, setFontCategory] = useState<'All' | FontStyleCategory>('All');
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);
  const [appliedActionId, setAppliedActionId] = useState<string | null>(null);

  const triggerAppliedFeedback = (id: string) => {
    setAppliedActionId(id);
    window.setTimeout(() => {
      setAppliedActionId((prev) => (prev === id ? null : prev));
    }, 1600);
  };

  const activeEntry =
    textNodes.find((t) => t.node.id === selectedNodeId) ?? textNodes[0];

  const activeProps = useMemo(
    () =>
      activeEntry
        ? getTextNodeProperties(activeEntry.node, cssRules, activeEntry.ancestors)
        : null,
    [activeEntry, cssRules]
  );

  const { compatibleOptions } = useMemo(() => {
    if (!activeEntry || !activeProps) {
      return { compatibleOptions: [] };
    }
    return getSvgFontPairingSuggestions({
      activeNode: activeEntry.node,
      activeFont: activeProps.fontFamily,
      textNodes,
      cssRules,
    });
  }, [activeEntry, activeProps, textNodes, cssRules]);

  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    return SUPPORTED_FONT_CATALOG.filter((entry) => {
      if (fontCategory !== 'All' && !entry.styleCategories.includes(fontCategory)) {
        return false;
      }
      if (!q) return true;
      return (
        entry.family.toLowerCase().includes(q) ||
        entry.styleCategories.some((c) => c.toLowerCase().includes(q)) ||
        entry.pairingTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [fontSearch, fontCategory]);

  useEffect(() => {
    let cancelled = false;
    const reqs = filteredFonts.map((f) => ({
      family: f.family,
      weight: '400',
      style: 'normal' as const,
    }));
    ensureFontsLoaded(reqs)
      .then(() => {
        if (!cancelled) setFontsLoadedTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filteredFonts]);

  useEffect(() => {
    if (fontSubTab !== 'pairings') return;
    const fams = compatibleOptions.map((c) => c.companionFont);
    if (fams.length === 0) return;
    ensureFontsLoaded(
      fams.map((family) => ({ family, weight: '400', style: 'normal' as const }))
    ).catch(() => {});
  }, [fontSubTab, compatibleOptions]);

  const activeFontMeta = activeProps ? getFontDefinition(activeProps.fontFamily) : undefined;

  const { uploadedFonts: uploadedSessionFonts } = usePersistedUploadedFonts({
    hydrateOnMount: false,
  });

  const handleSelectFontFamily = async (nodeId: string, family: string) => {
    onPreviewFont?.(nodeId, null);
    if (getFontDefinition(family)) {
      try {
        await ensureFontsLoaded([{ family, weight: '400', style: 'normal' }]);
      } catch {
        // Proceed even if already loaded
      }
    }
    const meta = getFontDefinition(family);
    const nextWeight =
      meta && activeProps && meta.weights.includes(activeProps.fontWeight)
        ? activeProps.fontWeight
        : '400';
    const nextStyle =
      meta?.hasItalic && activeProps?.fontStyle === 'italic' ? 'italic' : 'normal';

    onUpdateTextNode(nodeId, {
      fontFamily: family,
      fontWeight: meta?.category === 'Script' ? '400' : nextWeight,
      fontStyle: meta?.category === 'Script' ? 'normal' : nextStyle,
    });
    triggerAppliedFeedback(`font-${family}`);
  };

  const handleWeightOrStyleChange = async (
    nodeId: string,
    family: string,
    weight: string,
    style: 'normal' | 'italic'
  ) => {
    const def = getFontDefinition(family);
    if (def) {
      try {
        await ensureFontsLoaded([{ family: def.family, weight, style }]);
      } catch {
        // Continue
      }
    }
    onUpdateTextNode(nodeId, { fontWeight: weight, fontStyle: style });
  };

  if (!activeEntry || !activeProps) {
    return null;
  }

  const pickerBody = (
    <div className="space-y-4" data-fonts-tick={fontsLoadedTick}>
      <div className="space-y-1.5">
        <label
          htmlFor={isModal ? 'modal-style-field-picker' : 'style-field-picker'}
          className="block text-xs font-medium text-[#52525B] dark:text-[#999999]"
        >
          Target Text Element
        </label>
        <select
          id={isModal ? 'modal-style-field-picker' : 'style-field-picker'}
          value={activeEntry.node.id}
          onChange={(e) => {
            onPreviewFont?.(activeEntry.node.id, null);
            onSelectNode(e.target.value);
          }}
          className="w-full min-h-[42px] px-3 rounded-md border text-sm font-medium cursor-pointer bg-white border-[#E4E4E7] text-[#111111] focus:outline-none focus:border-[#3F3F46] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:focus:border-[#C0C0C0]"
        >
          {textNodes.map(({ node }) => (
            <option key={node.id} value={node.id}>
              {node.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weight & Italic Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010]">
        <span className="text-[11px] font-medium text-[#52525B] dark:text-[#999999]">Weight &amp; Style</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {(activeFontMeta?.weights ?? ['400', '500', '600', '700']).map((w) => {
            const active = activeProps.fontWeight === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() =>
                  void handleWeightOrStyleChange(
                    activeEntry.node.id,
                    activeProps.fontFamily,
                    w,
                    activeProps.fontStyle
                  )
                }
                className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer border transition-colors ${
                  active
                    ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                    : 'bg-white text-[#3F3F46] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#151515] dark:text-[#C0C0C0] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {w === '300'
                  ? 'Light'
                  : w === '400'
                  ? 'Regular'
                  : w === '500'
                  ? 'Medium'
                  : w === '600'
                  ? 'Semibold'
                  : 'Bold'}
              </button>
            );
          })}

          {(!activeFontMeta || activeFontMeta.hasItalic) && (
            <button
              type="button"
              onClick={() =>
                void handleWeightOrStyleChange(
                  activeEntry.node.id,
                  activeProps.fontFamily,
                  activeProps.fontWeight,
                  activeProps.fontStyle === 'italic' ? 'normal' : 'italic'
                )
              }
              className={`px-2.5 py-1 rounded text-[11px] italic font-medium cursor-pointer border transition-colors ${
                activeProps.fontStyle === 'italic'
                  ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                  : 'bg-white text-[#3F3F46] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#151515] dark:text-[#C0C0C0] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
              }`}
            >
              Italic
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-md border border-[#E4E4E7] bg-[#F4F4F5] dark:border-[#292929] dark:bg-[#0D0D0D]">
        <button
          type="button"
          onClick={() => setFontSubTab('library')}
          className={`min-h-[34px] rounded text-xs font-medium cursor-pointer transition-colors ${
            fontSubTab === 'library'
              ? 'bg-white text-[#111111] border border-[#D4D4D8] dark:bg-[#252525] dark:text-[#F5F5F5] dark:border-[#C0C0C0]/40'
              : 'text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5]'
          }`}
        >
          Google Fonts ({SUPPORTED_FONT_CATALOG.length})
        </button>
        <button
          type="button"
          onClick={() => setFontSubTab('pairings')}
          className={`min-h-[34px] rounded text-xs font-medium cursor-pointer transition-colors ${
            fontSubTab === 'pairings'
              ? 'bg-white text-[#111111] border border-[#D4D4D8] dark:bg-[#252525] dark:text-[#F5F5F5] dark:border-[#C0C0C0]/40'
              : 'text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5]'
          }`}
        >
          Smart Pairings
        </button>
      </div>

      {fontSubTab === 'library' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#52525B] dark:text-[#999999] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search Google Fonts"
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              placeholder="Search Google Fonts (e.g. calligraphy, vintage, serif)..."
              className="w-full min-h-[38px] pl-8 pr-8 rounded-md border text-xs bg-white border-[#E4E4E7] text-[#111111] placeholder:text-[#71717A] focus:outline-none focus:border-[#3F3F46] dark:bg-[#0D0D0D] dark:border-[#292929] dark:text-[#F5F5F5] dark:placeholder:text-[#737373] dark:focus:border-[#C0C0C0]"
            />
            {fontSearch && (
              <button
                type="button"
                onClick={() => setFontSearch('')}
                aria-label="Clear font search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Typography style categories">
            {(['All', ...FONT_STYLE_CATEGORIES] as const).map((cat) => {
              const active = fontCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFontCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors border whitespace-nowrap ${
                    active
                      ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                      : 'bg-[#FAFAFA] text-[#52525B] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#101010] dark:text-[#999999] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {uploadedSessionFonts.length > 0 && (
            <div className="p-2.5 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010] space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#52525B] dark:text-[#999999]">
                Saved Custom Fonts
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uploadedSessionFonts.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => void handleSelectFontFamily(activeEntry.node.id, rec.family)}
                    className={`px-2.5 py-1 rounded text-xs border cursor-pointer transition-colors ${
                      activeProps.fontFamily.toLowerCase() === rec.family.toLowerCase()
                        ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5] font-medium'
                        : 'bg-white text-[#111111] border-[#E4E4E7] hover:bg-[#E4E4E7] dark:bg-[#151515] dark:text-[#F5F5F5] dark:border-[#292929] dark:hover:bg-[#252525]'
                    }`}
                  >
                    {rec.family}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            className={`${
              isModal ? 'max-h-[340px]' : 'max-h-[260px]'
            } overflow-y-auto ea-scrollbar space-y-1.5 pr-1`}
            onMouseLeave={() => onPreviewFont?.(activeEntry.node.id, null)}
          >
            {filteredFonts.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#52525B] dark:text-[#999999] border border-[#E4E4E7] dark:border-[#292929] rounded-md bg-[#FAFAFA] dark:bg-[#101010]">
                No Google Fonts matched “{fontSearch}”.
              </div>
            ) : (
              filteredFonts.map((entry) => {
                const isSelected =
                  activeProps.fontFamily.toLowerCase() === entry.family.toLowerCase();
                const previewSample =
                  activeProps.fullText.trim().split('\n')[0]?.slice(0, 26) ||
                  entry.samplePhrase;

                return (
                  <button
                    key={entry.family}
                    type="button"
                    onMouseEnter={() => onPreviewFont?.(activeEntry.node.id, entry.family)}
                    onFocus={() => onPreviewFont?.(activeEntry.node.id, entry.family)}
                    onBlur={() => onPreviewFont?.(activeEntry.node.id, null)}
                    onClick={() => void handleSelectFontFamily(activeEntry.node.id, entry.family)}
                    className={`w-full px-3 py-2.5 rounded-md border flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#E4E4E7] border-[#18181B] dark:bg-[#252525] dark:border-[#E5E5E5]'
                        : 'bg-[#FAFAFA] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#101010] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5] truncate">
                          {entry.family}
                        </span>
                        <span className="text-[10px] text-[#71717A] dark:text-[#737373] truncate shrink-0">
                          {entry.styleCategories.slice(0, 2).join(' · ')}
                        </span>
                      </div>
                      <div
                        className="text-lg leading-snug text-[#27272A] dark:text-[#E5E5E5] truncate mt-0.5"
                        style={{ fontFamily: getCssFallback(entry.family) }}
                      >
                        {previewSample}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-[#111111] dark:text-[#E5E5E5] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {fontSubTab === 'pairings' && (
        <div className="space-y-4">
          {compatibleOptions.length > 0 ? (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52525B] dark:text-[#999999]">
                Pairs Well with {activeProps.fontFamily}
              </h3>

              <div className="space-y-2">
                {compatibleOptions.map((option) => {
                  const isJustApplied = appliedActionId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onApplyBatchTextUpdates(option.updates);
                        triggerAppliedFeedback(option.id);
                      }}
                      className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-lg border flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                        isJustApplied
                          ? 'bg-[#E4E4E7] border-[#18181B] dark:bg-[#252525] dark:border-[#E5E5E5]'
                          : 'bg-[#FAFAFA] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#101010] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0]'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span
                            className="text-base leading-snug text-[#111111] dark:text-[#F5F5F5]"
                            style={{ fontFamily: getCssFallback(option.companionFont) }}
                          >
                            {option.companionFont}
                          </span>
                          <span className="text-[11px] font-medium text-[#71717A] dark:text-[#737373]">
                            {option.collectionLabel}
                          </span>
                        </div>
                        <div className="text-xs text-[#52525B] dark:text-[#999999]">{option.description}</div>
                        <div className="text-[11px] text-[#71717A] dark:text-[#737373]">{option.targetSummary}</div>
                      </div>

                      <span className="text-xs font-medium shrink-0 inline-flex items-center gap-1 text-[#3F3F46] dark:text-[#C0C0C0]">
                        {isJustApplied && <Check className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5]" />}
                        {isJustApplied ? 'Applied' : 'Apply'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="p-4 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] dark:border-[#292929] dark:bg-[#101010] dark:text-[#999999] text-xs">
              Add a second SVG text layer to apply coordinated font pairings across headings and body text.
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!isModal) {
    return pickerBody;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-[#090909]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Google Fonts Picker"
      onClick={(e) => {
        if (e.target === e.currentTarget && onCloseModal) {
          onPreviewFont?.(activeEntry.node.id, null);
          onCloseModal();
        }
      }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-xl sm:rounded-lg border p-5 sm:p-6 max-h-[90vh] overflow-y-auto ea-scrollbar bg-white border-[#E4E4E7] text-[#111111] dark:bg-[#151515] dark:border-[#292929] dark:text-[#F5F5F5]"
        style={{ boxShadow: 'var(--ea-shadow-paper)' }}
      >
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E4E4E7] dark:border-[#292929]">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-[#52525B] dark:text-[#C0C0C0]" />
            <div>
              <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">
                Google Fonts Studio
              </h2>
              <p className="text-xs text-[#52525B] dark:text-[#999999]">
                Curated typography styles · Hover to preview live on SVG.
              </p>
            </div>
          </div>

          {onCloseModal && (
            <button
              type="button"
              onClick={() => {
                onPreviewFont?.(activeEntry.node.id, null);
                onCloseModal();
              }}
              aria-label="Close Google Fonts picker"
              className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer text-[#52525B] hover:text-[#111111] hover:bg-[#E4E4E7] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {pickerBody}
      </div>
    </div>
  );
};
