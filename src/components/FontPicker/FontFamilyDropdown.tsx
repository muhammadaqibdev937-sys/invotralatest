import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal, Type, X } from 'lucide-react';
import {
  FontCategory,
  getUploadedFontEngineEntry,
  SUPPORTED_FONT_CATALOG,
} from '../../engine/fonts';
import { TextEditPatch } from '../../engine/svgScene';
import { ensureFontsLoaded, getFontDefinition } from '../../services/fontLoader';
import { usePersistedUploadedFonts } from '../../hooks/usePersistedUploadedFonts';

interface FontFamilyDropdownProps {
  nodeId: string;
  nodeLabel: string;
  textPreview: string;
  currentFontFamily: string;
  currentFontWeight?: string;
  currentFontStyle?: 'normal' | 'italic';
  align?: 'left' | 'right';
  compact?: boolean;
  onSelectFont: (nodeId: string, patch: TextEditPatch) => void;
  onPreviewFont?: (nodeId: string, fontFamily: string | null) => void;
  onOpenFullStudio?: () => void;
}

type CategoryFilter = 'All' | FontCategory;

function getCssFallback(family: string): string {
  const cat = getFontDefinition(family)?.category ?? getUploadedFontEngineEntry(family)?.category;
  if (cat === 'Script') return `"${family}", cursive`;
  if (cat === 'Sans') return `"${family}", sans-serif`;
  if (cat === 'Serif') return `"${family}", serif`;
  return family;
}

export const FontFamilyDropdown: React.FC<FontFamilyDropdownProps> = ({
  nodeId,
  nodeLabel,
  textPreview,
  currentFontFamily,
  currentFontWeight = '400',
  currentFontStyle = 'normal',
  align = 'left',
  compact = false,
  onSelectFont,
  onPreviewFont,
  onOpenFullStudio,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [previewFamily, setPreviewFamily] = useState<string | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);
  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  const { uploadedFonts, fontRegistryVersion } = usePersistedUploadedFonts({
    hydrateOnMount: false,
  });

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const uploadedEntries = uploadedFonts.map((rec) => ({
      family: rec.family,
      category: rec.category,
      styleCategories: ['Saved Custom Font'] as unknown as string[],
      pairingTags: ['uploaded', 'custom', 'saved'],
      samplePhrase: 'Saved Custom Font',
    }));
    const combined = [
      ...uploadedEntries,
      ...SUPPORTED_FONT_CATALOG.map((entry) => ({
        family: entry.family,
        category: entry.category,
        styleCategories: entry.styleCategories as unknown as string[],
        pairingTags: entry.pairingTags,
        samplePhrase: entry.samplePhrase,
      })),
    ];
    return combined.filter((entry) => {
      if (categoryFilter !== 'All' && entry.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        entry.family.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.styleCategories.some((c) => c.toLowerCase().includes(q)) ||
        entry.pairingTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [categoryFilter, searchQuery, isOpen, uploadedFonts, fontRegistryVersion]);

  useEffect(() => {
    const def = getFontDefinition(currentFontFamily);
    if (!def) return;
    ensureFontsLoaded([
      { family: def.family, weight: currentFontWeight, style: currentFontStyle },
    ])
      .then(() => setFontsLoadedTick((t) => t + 1))
      .catch(() => {});
  }, [currentFontFamily, currentFontWeight, currentFontStyle]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const reqs = SUPPORTED_FONT_CATALOG.map((entry) => ({
      family: entry.family,
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPreviewFamily(null);
        setHighlightedIdx(-1);
        onPreviewFont?.(nodeId, null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setPreviewFamily(null);
        setHighlightedIdx(-1);
        onPreviewFont?.(nodeId, null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, nodeId, onPreviewFont]);

  useEffect(() => {
    if (isOpen && !compact) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, compact]);

  useEffect(() => {
    setIsOpen(false);
    setPreviewFamily(null);
    setHighlightedIdx(-1);
  }, [nodeId]);

  const closeAndClearPreview = () => {
    setIsOpen(false);
    setPreviewFamily(null);
    setHighlightedIdx(-1);
    onPreviewFont?.(nodeId, null);
  };

  const applyFontChoice = async (family: string) => {
    onPreviewFont?.(nodeId, null);
    setPreviewFamily(null);
    setHighlightedIdx(-1);
    setIsOpen(false);

    if (getFontDefinition(family)) {
      try {
        await ensureFontsLoaded([{ family, weight: '400', style: 'normal' }]);
      } catch {
        // Proceed even if already loaded
      }
    }

    const meta = getFontDefinition(family);
    const nextWeight = meta && meta.weights.includes(currentFontWeight) ? currentFontWeight : '400';
    const nextStyle = meta?.hasItalic && currentFontStyle === 'italic' ? 'italic' : 'normal';

    onSelectFont(nodeId, {
      fontFamily: family,
      fontWeight: meta?.category === 'Script' ? '400' : nextWeight,
      fontStyle: meta?.category === 'Script' ? 'normal' : nextStyle,
    });
  };

  const handleOptionHover = (family: string, idx: number) => {
    setPreviewFamily(family);
    setHighlightedIdx(idx);
    onPreviewFont?.(nodeId, family);
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredEntries.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (highlightedIdx + 1) % filteredEntries.length;
      const entry = filteredEntries[nextIdx];
      handleOptionHover(entry.family, nextIdx);
      optionRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = highlightedIdx <= 0 ? filteredEntries.length - 1 : highlightedIdx - 1;
      const entry = filteredEntries[nextIdx];
      handleOptionHover(entry.family, nextIdx);
      optionRefs.current[nextIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && highlightedIdx >= 0 && filteredEntries[highlightedIdx]) {
      e.preventDefault();
      void applyFontChoice(filteredEntries[highlightedIdx].family);
    }
  };

  const effectiveDisplayFamily = previewFamily || currentFontFamily;
  const effectiveMeta = getFontDefinition(effectiveDisplayFamily);
  const sampleTextSnippet =
    textPreview.trim().split('\n')[0]?.slice(0, 32) ||
    effectiveMeta?.samplePhrase ||
    'Together with our families';

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      data-fonts-tick={fontsLoadedTick}
      onKeyDown={handleDropdownKeyDown}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Font family for ${nodeLabel}: ${currentFontFamily}`}
        onClick={() => {
          if (isOpen) {
            closeAndClearPreview();
          } else {
            setIsOpen(true);
            setSearchQuery('');
            setHighlightedIdx(-1);
          }
        }}
        className={`${
          compact ? 'min-h-[32px] px-2.5 text-xs' : 'min-h-[32px] px-3 text-xs'
        } rounded-md border inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
          isOpen
            ? 'bg-[#E4E4E7] border-[#18181B] text-[#111111] dark:bg-[#252525] dark:border-[#E5E5E5] dark:text-[#F5F5F5]'
            : 'bg-[#FAFAFA] border-[#E4E4E7] text-[#111111] hover:bg-[#E4E4E7] hover:border-[#A1A1AA] dark:bg-[#151515] dark:border-[#292929] dark:text-[#E5E5E5] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0]'
        }`}
      >
        <Type className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0] shrink-0" />
        <span
          className="truncate max-w-[140px] sm:max-w-[190px] text-sm leading-none py-0.5 text-[#111111] dark:text-[#F5F5F5]"
          style={{ fontFamily: getCssFallback(effectiveDisplayFamily) }}
        >
          {effectiveDisplayFamily}
        </span>
        {effectiveMeta && !compact && (
          <span className="text-[10px] text-[#71717A] dark:text-[#737373] shrink-0 hidden sm:inline">
            {effectiveMeta.category}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#52525B] dark:text-[#999999] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#111111] dark:text-[#E5E5E5]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-[308px] sm:w-[368px] rounded-lg border border-[#E4E4E7] bg-white text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:text-[#F5F5F5] overflow-hidden ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ boxShadow: 'var(--ea-shadow-paper)' }}
        >
          <div className="px-3.5 py-2.5 border-b border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010] space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-[#52525B] dark:text-[#999999]">
              <span>
                {previewFamily && previewFamily !== currentFontFamily
                  ? 'Live Hover Preview'
                  : 'Active Font Preview'}
              </span>
              <span className="normal-case tracking-normal text-[#3F3F46] dark:text-[#C0C0C0] truncate max-w-[170px]">
                {effectiveDisplayFamily}
                {effectiveMeta ? ` · ${effectiveMeta.category}` : ''}
              </span>
            </div>
            <div
              className="text-xl leading-snug text-[#111111] dark:text-[#F5F5F5] truncate pt-0.5"
              style={{ fontFamily: getCssFallback(effectiveDisplayFamily) }}
            >
              {sampleTextSnippet}
            </div>
          </div>

          <div className="p-2.5 border-b border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010] space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#71717A] dark:text-[#737373] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Filter fonts in dropdown"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIdx(-1);
                }}
                placeholder="Search font family or style..."
                className="w-full h-8 pl-8 pr-7 rounded border border-[#E4E4E7] bg-white text-xs text-[#111111] placeholder:text-[#71717A] focus:outline-none focus:border-[#3F3F46] dark:border-[#292929] dark:bg-[#0D0D0D] dark:text-[#F5F5F5] dark:placeholder:text-[#737373] dark:focus:border-[#C0C0C0]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear font search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1" role="group" aria-label="Font family filter">
              {(['All', 'Serif', 'Sans', 'Script'] as const).map((cat) => {
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat);
                      setHighlightedIdx(-1);
                    }}
                    className={`h-7 rounded text-[11px] font-medium cursor-pointer border transition-colors ${
                      active
                        ? 'bg-[#18181B] text-white border-[#18181B] dark:bg-[#E5E5E5] dark:text-[#090909] dark:border-[#E5E5E5]'
                        : 'bg-white text-[#52525B] border-[#E4E4E7] hover:bg-[#E4E4E7] hover:text-[#111111] dark:bg-[#151515] dark:text-[#999999] dark:border-[#292929] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Font families with live preview"
            className="max-h-[264px] overflow-y-auto ea-scrollbar divide-y divide-[#E4E4E7] dark:divide-[#292929]/60"
            onMouseLeave={() => {
              setPreviewFamily(null);
              onPreviewFont?.(nodeId, null);
            }}
          >
            {filteredEntries.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#52525B] dark:text-[#999999]">
                No fonts match “{searchQuery}”.
              </div>
            ) : (
              filteredEntries.map((entry, idx) => {
                const isSelected =
                  currentFontFamily.toLowerCase() === entry.family.toLowerCase();
                const isHighlighted = highlightedIdx === idx;
                const rowSpecimen =
                  textPreview.trim().split('\n')[0]?.slice(0, 28) || entry.samplePhrase;

                return (
                  <button
                    key={entry.family}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => handleOptionHover(entry.family, idx)}
                    onFocus={() => handleOptionHover(entry.family, idx)}
                    onClick={() => void applyFontChoice(entry.family)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#E4E4E7] text-[#111111] dark:bg-[#252525] dark:text-[#F5F5F5]'
                        : isHighlighted
                        ? 'bg-[#F4F4F5] text-[#111111] dark:bg-[#1F1F1F] dark:text-[#F5F5F5]'
                        : 'bg-transparent text-[#111111] hover:bg-[#F4F4F5] dark:text-[#F5F5F5] dark:hover:bg-[#1F1F1F]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-sm font-medium text-[#111111] dark:text-[#F5F5F5] truncate"
                          style={{ fontFamily: getCssFallback(entry.family) }}
                        >
                          {entry.family}
                        </span>
                        <span className="text-[10px] text-[#71717A] dark:text-[#737373] shrink-0">
                          {entry.styleCategories.slice(0, 2).join(' · ')}
                        </span>
                      </div>
                      <div
                        className="text-base leading-snug text-[#3F3F46] dark:text-[#C0C0C0] truncate mt-0.5"
                        style={{ fontFamily: getCssFallback(entry.family) }}
                      >
                        {rowSpecimen}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-[#111111] dark:text-[#E5E5E5] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {onOpenFullStudio && (
            <div className="p-2 border-t border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010]">
              <button
                type="button"
                onClick={() => {
                  closeAndClearPreview();
                  onOpenFullStudio();
                }}
                className="w-full h-8 px-2.5 rounded flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#3F3F46] hover:text-[#111111] hover:bg-[#E4E4E7] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525] cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Pairings, Weights &amp; Fine Studio</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
