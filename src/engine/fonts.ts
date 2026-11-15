export type FontCategory = 'Serif' | 'Sans' | 'Script';

export const FONT_STYLE_CATEGORIES = [
  'Elegant Script',
  'Wedding Calligraphy',
  'Modern Sans Serif',
  'Classic Serif',
  'Luxury Typography',
  'Handwritten',
  'Minimalist',
  'Romantic',
  'Traditional',
  'Decorative',
  'Bold',
  'Vintage',
] as const;

export type FontStyleCategory = (typeof FONT_STYLE_CATEGORIES)[number];

export interface FontCatalogEntry {
  family: string;
  category: FontCategory;
  styleCategories: FontStyleCategory[];
  weights: string[];
  hasItalic: boolean;
  samplePhrase: string;
  pairingTags: string[];
  license: string;
}

export const SUPPORTED_FONT_CATALOG: FontCatalogEntry[] = [
  // ── ELEGANT SCRIPT & WEDDING CALLIGRAPHY & ROMANTIC & HANDWRITTEN ──
  {
    family: 'Great Vibes',
    category: 'Script',
    styleCategories: ['Elegant Script', 'Wedding Calligraphy', 'Romantic'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Emma & James',
    pairingTags: ['romantic', 'calligraphy', 'names'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Allura',
    category: 'Script',
    styleCategories: ['Elegant Script', 'Wedding Calligraphy', 'Romantic'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Olivia & Liam',
    pairingTags: ['soft', 'flowing', 'names'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Parisienne',
    category: 'Script',
    styleCategories: ['Elegant Script', 'Wedding Calligraphy', 'Romantic', 'Vintage'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Claire & Henri',
    pairingTags: ['airy', 'romantic', 'french'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Alex Brush',
    category: 'Script',
    styleCategories: ['Elegant Script', 'Wedding Calligraphy', 'Romantic'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Sophia & Ethan',
    pairingTags: ['brush', 'flowing', 'names'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Pinyon Script',
    category: 'Script',
    styleCategories: ['Wedding Calligraphy', 'Elegant Script', 'Luxury Typography', 'Traditional'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Eleanor & William',
    pairingTags: ['formal', 'copperplate', 'luxury'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Italianno',
    category: 'Script',
    styleCategories: ['Wedding Calligraphy', 'Elegant Script', 'Romantic'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Aria & Matteo',
    pairingTags: ['italian', 'calligraphy', 'refined'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Sacramento',
    category: 'Script',
    styleCategories: ['Elegant Script', 'Handwritten', 'Minimalist', 'Vintage'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Hannah & Lucas',
    pairingTags: ['monoline', 'airy', 'modern-script'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Tangerine',
    category: 'Script',
    styleCategories: ['Wedding Calligraphy', 'Elegant Script', 'Romantic'],
    weights: ['400', '700'],
    hasItalic: false,
    samplePhrase: 'Grace & Noah',
    pairingTags: ['tall', 'editorial', 'calligraphy'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Petit Formal Script',
    category: 'Script',
    styleCategories: ['Romantic', 'Wedding Calligraphy', 'Vintage'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Charlotte & Henry',
    pairingTags: ['formal', 'petite', 'classic'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Rouge Script',
    category: 'Script',
    styleCategories: ['Romantic', 'Elegant Script', 'Vintage'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Amelie & Leo',
    pairingTags: ['vintage', 'warm', 'script'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Mrs Saint Delafield',
    category: 'Script',
    styleCategories: ['Wedding Calligraphy', 'Luxury Typography', 'Romantic'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Victoria & Arthur',
    pairingTags: ['flourish', 'calligraphy', 'names'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Dancing Script',
    category: 'Script',
    styleCategories: ['Handwritten', 'Romantic', 'Decorative'],
    weights: ['400', '500', '600', '700'],
    hasItalic: false,
    samplePhrase: 'celebrate with us',
    pairingTags: ['lively', 'warm', 'casual'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Caveat',
    category: 'Script',
    styleCategories: ['Handwritten', 'Minimalist'],
    weights: ['400', '500', '600', '700'],
    hasItalic: false,
    samplePhrase: 'Save the Date',
    pairingTags: ['handwritten', 'relaxed', 'notes'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Satisfy',
    category: 'Script',
    styleCategories: ['Handwritten', 'Vintage', 'Elegant Script'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'Forever Begins',
    pairingTags: ['retro', 'brush', 'warm'],
    license: 'Apache License 2.0',
  },

  // ── CLASSIC SERIF, LUXURY, TRADITIONAL, VINTAGE, DECORATIVE ──
  {
    family: 'Cormorant Garamond',
    category: 'Serif',
    styleCategories: ['Classic Serif', 'Luxury Typography', 'Romantic', 'Traditional'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Together with their families',
    pairingTags: ['romantic', 'editorial', 'botanical', 'classic'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Playfair Display',
    category: 'Serif',
    styleCategories: ['Classic Serif', 'Luxury Typography', 'Vintage', 'Bold'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Eleanor & Alexander',
    pairingTags: ['modern-classic', 'art-deco', 'formal', 'luxury'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Libre Baskerville',
    category: 'Serif',
    styleCategories: ['Classic Serif', 'Traditional', 'Vintage'],
    weights: ['400', '700'],
    hasItalic: true,
    samplePhrase: 'Saturday, October 23',
    pairingTags: ['traditional', 'minimal', 'literary'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Lora',
    category: 'Serif',
    styleCategories: ['Classic Serif', 'Romantic', 'Traditional'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Dinner & Dancing to Follow',
    pairingTags: ['botanical', 'warm', 'body'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'EB Garamond',
    category: 'Serif',
    styleCategories: ['Classic Serif', 'Traditional', 'Romantic', 'Luxury Typography'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Request the honor of your presence',
    pairingTags: ['timeless', 'bookish', 'classic'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Cinzel',
    category: 'Serif',
    styleCategories: ['Luxury Typography', 'Decorative', 'Traditional', 'Bold'],
    weights: ['400', '500', '600', '700'],
    hasItalic: false,
    samplePhrase: 'THE MARRIAGE OF',
    pairingTags: ['engraved', 'architectural', 'monogram'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Bodoni Moda',
    category: 'Serif',
    styleCategories: ['Luxury Typography', 'Vintage', 'Classic Serif', 'Bold'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'BLACK TIE AFFAIR',
    pairingTags: ['editorial', 'fashion', 'high-contrast'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Marcellus',
    category: 'Serif',
    styleCategories: ['Luxury Typography', 'Minimalist', 'Traditional'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'GARDEN ESTATE · AUSTIN',
    pairingTags: ['sculpted', 'clean-serif', 'caps'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Crimson Pro',
    category: 'Serif',
    styleCategories: ['Traditional', 'Classic Serif', 'Romantic'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Reception immediately following',
    pairingTags: ['refined', 'warm', 'body'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Cardo',
    category: 'Serif',
    styleCategories: ['Vintage', 'Traditional', 'Classic Serif'],
    weights: ['400', '700'],
    hasItalic: true,
    samplePhrase: 'At four in the afternoon',
    pairingTags: ['vintage', 'scholarly', 'heritage'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Abril Fatface',
    category: 'Serif',
    styleCategories: ['Decorative', 'Bold', 'Vintage'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'CELEBRATE',
    pairingTags: ['statement', 'bold', 'display'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Yeseva One',
    category: 'Serif',
    styleCategories: ['Decorative', 'Vintage', 'Bold'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'June Fourteenth',
    pairingTags: ['ornate', 'editorial', 'display'],
    license: 'SIL Open Font License 1.1',
  },

  // ── MODERN SANS SERIF, MINIMALIST, BOLD ──
  {
    family: 'DM Sans',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'SATURDAY · JUNE 14',
    pairingTags: ['modern-classic', 'clean', 'details'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Montserrat',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist', 'Bold'],
    weights: ['300', '400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'NEW YORK · 2027',
    pairingTags: ['minimal', 'geometric', 'uppercase'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Lato',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist'],
    weights: ['300', '400', '700'],
    hasItalic: true,
    samplePhrase: 'Warmest celebration awaits',
    pairingTags: ['soft', 'friendly', 'details'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Raleway',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist', 'Luxury Typography'],
    weights: ['300', '400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'INVITES YOU TO CELEBRATE',
    pairingTags: ['airy', 'elegant', 'details'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Plus Jakarta Sans',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: '5:30 PM · Ceremony & Dinner',
    pairingTags: ['crisp', 'editorial', 'clean'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Jost',
    category: 'Sans',
    styleCategories: ['Minimalist', 'Modern Sans Serif', 'Vintage'],
    weights: ['300', '400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'COCKTAILS & DINNER',
    pairingTags: ['futura-inspired', 'geometric', 'architectural'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Josefin Sans',
    category: 'Sans',
    styleCategories: ['Minimalist', 'Vintage', 'Luxury Typography', 'Decorative'],
    weights: ['300', '400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'ART DECO PAVILION',
    pairingTags: ['1920s', 'geometric', 'deco'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Work Sans',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: '440 Mercer Street, New York',
    pairingTags: ['neutral', 'clean', 'details'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Poppins',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Bold'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'BIRTHDAY SOIREE',
    pairingTags: ['modern', 'geometric', 'party'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Oswald',
    category: 'Sans',
    styleCategories: ['Bold', 'Modern Sans Serif', 'Decorative'],
    weights: ['400', '500', '600', '700'],
    hasItalic: false,
    samplePhrase: 'RSVP SEPTEMBER 1ST',
    pairingTags: ['condensed', 'bold', 'poster'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Bebas Neue',
    category: 'Sans',
    styleCategories: ['Bold', 'Modern Sans Serif', 'Decorative'],
    weights: ['400'],
    hasItalic: false,
    samplePhrase: 'SAVE THE DATE',
    pairingTags: ['condensed', 'impact', 'display', 'poster'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'Inter',
    category: 'Sans',
    styleCategories: ['Modern Sans Serif', 'Minimalist'],
    weights: ['300', '400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'Saturday, June 14 at 5:00 PM',
    pairingTags: ['clean', 'neutral', 'ui', 'details'],
    license: 'SIL Open Font License 1.1',
  },
  {
    family: 'JetBrains Mono',
    category: 'Sans',
    styleCategories: ['Minimalist', 'Modern Sans Serif'],
    weights: ['400', '500', '600', '700'],
    hasItalic: true,
    samplePhrase: 'CODE // 06.14.2027',
    pairingTags: ['monospace', 'technical', 'code'],
    license: 'SIL Open Font License 1.1',
  },
];

export const SUPPORTED_FONT_NAMES = SUPPORTED_FONT_CATALOG.map((f) => f.family);
export const SUPPORTED_FONT_NAME_SET = new Set(SUPPORTED_FONT_NAMES);

export interface FontResolutionResult {
  originalFamily: string;
  resolvedFamily: string;
  wasFallback: boolean;
  fallbackSource: 'exact' | 'mapped' | 'heuristic' | 'default';
  category: FontCategory;
}

export interface SceneFontUsageEntry {
  originalFamily: string;
  resolvedFallback: string;
  isBundled: boolean;
  isBrowserAvailable: boolean;
  isMissing: boolean;
  affectedNodeIds: string[];
}

export interface SceneFontScanSummary {
  totalFonts: number;
  bundledCount: number;
  browserAvailableCount: number;
  missingCount: number;
  missingFonts: string[];
  entries: SceneFontUsageEntry[];
  summaryText: string;
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
]);

const fontAvailabilityCache = new Map<string, boolean>();
let cachedMeasureCanvas: HTMLCanvasElement | null = null;

interface UploadedFontEngineEntry {
  family: string;
  category: FontCategory;
}

const uploadedFontRegistry = new Map<string, UploadedFontEngineEntry>();

export function clearFontAvailabilityCache(): void {
  fontAvailabilityCache.clear();
}

export function registerUploadedFontInEngine(
  family: string,
  category: FontCategory = 'Serif'
): void {
  const cleaned = family.trim().replace(/^['"]|['"]$/g, '');
  if (!cleaned) return;
  uploadedFontRegistry.set(cleaned.toLowerCase(), { family: cleaned, category });
  clearFontAvailabilityCache();
}

export function unregisterUploadedFontInEngine(family: string): void {
  uploadedFontRegistry.delete(family.trim().toLowerCase());
  clearFontAvailabilityCache();
}

export function clearUploadedFontsInEngine(): void {
  uploadedFontRegistry.clear();
  clearFontAvailabilityCache();
}

export function getUploadedFontEngineEntry(
  family: string | null | undefined
): UploadedFontEngineEntry | undefined {
  if (!family) return undefined;
  const cleaned = family.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  if (!cleaned) return undefined;
  return uploadedFontRegistry.get(cleaned.toLowerCase());
}

/**
 * Checks whether a font family is actually rendered by the browser using canvas measureText
 * against generic serif / sans-serif / monospace baselines, with safe fallback and per-font caching.
 */
export function isFontAvailableInBrowser(fontFamily: string | null | undefined): boolean {
  if (!fontFamily) return false;
  const cleaned = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  if (!cleaned) return false;

  const cacheKey = cleaned.toLowerCase();
  if (GENERIC_FONT_FAMILIES.has(cacheKey)) {
    return true;
  }

  if (uploadedFontRegistry.has(cacheKey)) {
    return true;
  }

  const cached = fontAvailabilityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = cachedMeasureCanvas ?? document.createElement('canvas');
    if (!cachedMeasureCanvas) {
      cachedMeasureCanvas = canvas;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return false;
    }

    const testString = 'mmmmmmmmmmlliWWWWWWWWWW0123456789';
    const fontSize = '72px';
    const safeName = cleaned.replace(/"/g, '\\"');
    const baselines = ['serif', 'sans-serif', 'monospace'] as const;

    let available = false;
    for (const generic of baselines) {
      ctx.font = `${fontSize} ${generic}`;
      const baselineWidth = ctx.measureText(testString).width;
      ctx.font = `${fontSize} "${safeName}", ${generic}`;
      const measuredWidth = ctx.measureText(testString).width;

      if (
        Number.isFinite(baselineWidth) &&
        Number.isFinite(measuredWidth) &&
        Math.abs(measuredWidth - baselineWidth) > 0.1
      ) {
        available = true;
        break;
      }
    }

    fontAvailabilityCache.set(cacheKey, available);
    return available;
  } catch (err) {
    console.warn(`[fonts] Canvas measureText font check failed for "${cleaned}":`, err);
    return false;
  }
}

/**
 * Easily editable mapping table from common unbundled / system fonts
 * to bundled open-license (OFL) alternatives.
 * Keys must be lowercase. Do not add proprietary system fonts to the bundle.
 */
export const SYSTEM_FONT_FALLBACK_MAP: Record<string, string> = {
  georgia: 'Cormorant Garamond',
  impact: 'Bebas Neue',
  'courier new': 'JetBrains Mono',
  'times new roman': 'Playfair Display',
  arial: 'Inter',
  // Common system aliases
  helvetica: 'Inter',
  'helvetica neue': 'Inter',
  'segoe ui': 'Inter',
  'system-ui': 'Inter',
  times: 'Playfair Display',
  courier: 'JetBrains Mono',
  consolas: 'JetBrains Mono',
  monaco: 'JetBrains Mono',
  menlo: 'JetBrains Mono',
  'lucida console': 'JetBrains Mono',
  palatino: 'Cormorant Garamond',
  'palatino linotype': 'Cormorant Garamond',
  'book antiqua': 'Cormorant Garamond',
  garamond: 'EB Garamond',
  verdana: 'Plus Jakarta Sans',
  tahoma: 'Work Sans',
  'trebuchet ms': 'DM Sans',
};

const FONT_FALLBACK_HINTS: Array<{ pattern: RegExp; fallback: string }> = [
  { pattern: /callig|copperplate|pinyon|delafield/i, fallback: 'Pinyon Script' },
  { pattern: /brush|alex|satisfy/i, fallback: 'Alex Brush' },
  { pattern: /handwrit|caveat|note/i, fallback: 'Caveat' },
  { pattern: /script|cursive|vibes|sacramento|tangerine|petit|italianno|rouge/i, fallback: 'Great Vibes' },
  { pattern: /baskerville|caslon|century|book/i, fallback: 'Libre Baskerville' },
  { pattern: /cinzel|trajan|roman|engraved/i, fallback: 'Cinzel' },
  { pattern: /bodoni|didot/i, fallback: 'Bodoni Moda' },
  { pattern: /playfair|prata|times|display/i, fallback: 'Playfair Display' },
  { pattern: /garamond|georgia|serif|palatino|crimson|cardo/i, fallback: 'Cormorant Garamond' },
  { pattern: /mono|courier|consolas|menlo|monaco|code|jetbrains/i, fallback: 'JetBrains Mono' },
  { pattern: /bebas|impact|anton/i, fallback: 'Bebas Neue' },
  { pattern: /futura|jost|josefin|deco/i, fallback: 'Josefin Sans' },
  { pattern: /montserrat|gotham|avenir|proxima|geometric|poppins/i, fallback: 'Montserrat' },
  { pattern: /oswald|condensed/i, fallback: 'Oswald' },
  { pattern: /raleway|quicksand|spartan/i, fallback: 'Raleway' },
  { pattern: /arial|helvetica|inter|open sans|roboto|segoe/i, fallback: 'Inter' },
  { pattern: /lato|sans|jakarta|work/i, fallback: 'DM Sans' },
];

export function cleanSvgFontName(rawFont: string | null | undefined): string {
  if (!rawFont) return 'Cormorant Garamond';
  const first = rawFont.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || '';
  return first || 'Cormorant Garamond';
}

export function resolveFontFamily(rawFont: string | null | undefined): FontResolutionResult {
  const cleaned = cleanSvgFontName(rawFont);
  const lower = cleaned.toLowerCase();

  const exact = SUPPORTED_FONT_CATALOG.find(
    (entry) => entry.family.toLowerCase() === lower
  );
  if (exact) {
    return {
      originalFamily: cleaned,
      resolvedFamily: exact.family,
      wasFallback: false,
      fallbackSource: 'exact',
      category: exact.category,
    };
  }

  const uploaded = uploadedFontRegistry.get(lower);
  if (uploaded) {
    return {
      originalFamily: cleaned,
      resolvedFamily: uploaded.family,
      wasFallback: false,
      fallbackSource: 'exact',
      category: uploaded.category,
    };
  }

  const mappedFamily = SYSTEM_FONT_FALLBACK_MAP[lower];
  if (mappedFamily) {
    const mappedTarget = SUPPORTED_FONT_CATALOG.find((e) => e.family === mappedFamily);
    if (mappedTarget) {
      return {
        originalFamily: cleaned,
        resolvedFamily: mappedTarget.family,
        wasFallback: true,
        fallbackSource: 'mapped',
        category: mappedTarget.category,
      };
    }
  }

  for (const hint of FONT_FALLBACK_HINTS) {
    if (hint.pattern.test(cleaned)) {
      const target = SUPPORTED_FONT_CATALOG.find((e) => e.family === hint.fallback)!;
      return {
        originalFamily: cleaned,
        resolvedFamily: target.family,
        wasFallback: true,
        fallbackSource: 'heuristic',
        category: target.category,
      };
    }
  }

  return {
    originalFamily: cleaned,
    resolvedFamily: 'Cormorant Garamond',
    wasFallback: true,
    fallbackSource: 'default',
    category: 'Serif',
  };
}

export function summarizeFontUsage(
  usages: Array<{ rawFont: string | null | undefined; nodeId: string }>,
  checkBrowserAvailable: (fontFamily: string) => boolean = isFontAvailableInBrowser
): SceneFontScanSummary {
  const map = new Map<string, SceneFontUsageEntry>();

  for (const item of usages) {
    const resolved = resolveFontFamily(item.rawFont);
    const displayName = item.rawFont
      ? item.rawFont.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || resolved.originalFamily
      : resolved.resolvedFamily;
    const key = displayName.toLowerCase();

    const existing = map.get(key);
    if (existing) {
      if (!existing.affectedNodeIds.includes(item.nodeId)) {
        existing.affectedNodeIds.push(item.nodeId);
      }
      continue;
    }

    const isBundled = !resolved.wasFallback;
    const isBrowserAvailable = isBundled ? true : checkBrowserAvailable(displayName);
    const isMissing = !isBundled && !isBrowserAvailable;

    map.set(key, {
      originalFamily: displayName,
      resolvedFallback: resolved.resolvedFamily,
      isBundled,
      isBrowserAvailable,
      isMissing,
      affectedNodeIds: [item.nodeId],
    });
  }

  const entries = Array.from(map.values());
  const totalFonts = entries.length;
  const bundledCount = entries.filter((e) => e.isBundled).length;
  const browserAvailableCount = entries.filter((e) => !e.isBundled && e.isBrowserAvailable).length;
  const missingFonts = entries.filter((e) => e.isMissing).map((e) => e.originalFamily);
  const missingCount = missingFonts.length;

  const fontWord = totalFonts === 1 ? 'font' : 'fonts';
  let summaryText = 'No fonts detected';
  if (totalFonts > 0) {
    if (missingCount > 0) {
      summaryText = `${totalFonts} ${fontWord}, ${missingCount} missing: ${missingFonts.join(', ')}`;
    } else if (browserAvailableCount > 0) {
      summaryText = `${totalFonts} ${fontWord}, all available (${browserAvailableCount} local system)`;
    } else {
      summaryText = `${totalFonts} ${fontWord} (all bundled)`;
    }
  }

  return {
    totalFonts,
    bundledCount,
    browserAvailableCount,
    missingCount,
    missingFonts,
    entries,
    summaryText,
  };
}

