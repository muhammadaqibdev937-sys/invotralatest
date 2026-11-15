import {
  FONT_STYLE_CATEGORIES,
  FontCatalogEntry,
  FontStyleCategory,
  SUPPORTED_FONT_CATALOG,
} from '../engine/fonts';
import { uint8ToBase64, unpackWoff1ToTtf } from './woffToTtf';

export type { FontCatalogEntry, FontStyleCategory };
export { FONT_STYLE_CATEGORIES };

export interface SupportedFontDefinition extends FontCatalogEntry {
  displayCategory: 'Script' | 'Editorial Serif' | 'Modern Sans';
  loadCss: () => Promise<unknown>;
  variants: Record<string, () => Promise<{ default: string }>>;
}

interface PackageSpec {
  family: string;
  pkg: string;
  weights: string[];
  hasItalic: boolean;
  italicWeights?: string[];
}

// Explicit static Vite-analyzable dynamic import loaders for every @fontsource package & .woff binary
const FONT_LOADERS: Record<
  string,
  {
    loadCss: () => Promise<unknown>;
    variants: Record<string, () => Promise<{ default: string }>>;
  }
> = {
  'Cormorant Garamond': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/cormorant-garamond/400.css'),
        import('@fontsource/cormorant-garamond/500.css'),
        import('@fontsource/cormorant-garamond/600.css'),
        import('@fontsource/cormorant-garamond/700.css'),
        import('@fontsource/cormorant-garamond/400-italic.css'),
        import('@fontsource/cormorant-garamond/600-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff?url'),
      '600-italic': () => import('@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff?url'),
    },
  },
  'Playfair Display': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/playfair-display/400.css'),
        import('@fontsource/playfair-display/500.css'),
        import('@fontsource/playfair-display/600.css'),
        import('@fontsource/playfair-display/700.css'),
        import('@fontsource/playfair-display/400-italic.css'),
        import('@fontsource/playfair-display/600-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff?url'),
      '600-italic': () => import('@fontsource/playfair-display/files/playfair-display-latin-600-italic.woff?url'),
    },
  },
  'Libre Baskerville': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/libre-baskerville/400.css'),
        import('@fontsource/libre-baskerville/700.css'),
        import('@fontsource/libre-baskerville/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff?url'),
      '700-normal': () => import('@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff?url'),
    },
  },
  Lora: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/lora/400.css'),
        import('@fontsource/lora/500.css'),
        import('@fontsource/lora/600.css'),
        import('@fontsource/lora/700.css'),
        import('@fontsource/lora/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/lora/files/lora-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/lora/files/lora-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/lora/files/lora-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/lora/files/lora-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/lora/files/lora-latin-400-italic.woff?url'),
    },
  },
  'EB Garamond': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/eb-garamond/400.css'),
        import('@fontsource/eb-garamond/500.css'),
        import('@fontsource/eb-garamond/600.css'),
        import('@fontsource/eb-garamond/700.css'),
        import('@fontsource/eb-garamond/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/eb-garamond/files/eb-garamond-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff?url'),
    },
  },
  Cinzel: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/cinzel/400.css'),
        import('@fontsource/cinzel/500.css'),
        import('@fontsource/cinzel/600.css'),
        import('@fontsource/cinzel/700.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/cinzel/files/cinzel-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/cinzel/files/cinzel-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/cinzel/files/cinzel-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/cinzel/files/cinzel-latin-700-normal.woff?url'),
    },
  },
  'Bodoni Moda': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/bodoni-moda/400.css'),
        import('@fontsource/bodoni-moda/500.css'),
        import('@fontsource/bodoni-moda/600.css'),
        import('@fontsource/bodoni-moda/700.css'),
        import('@fontsource/bodoni-moda/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/bodoni-moda/files/bodoni-moda-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/bodoni-moda/files/bodoni-moda-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/bodoni-moda/files/bodoni-moda-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/bodoni-moda/files/bodoni-moda-latin-400-italic.woff?url'),
    },
  },
  Marcellus: {
    loadCss: () => import('@fontsource/marcellus/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/marcellus/files/marcellus-latin-400-normal.woff?url'),
    },
  },
  'Crimson Pro': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/crimson-pro/400.css'),
        import('@fontsource/crimson-pro/500.css'),
        import('@fontsource/crimson-pro/600.css'),
        import('@fontsource/crimson-pro/700.css'),
        import('@fontsource/crimson-pro/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/crimson-pro/files/crimson-pro-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/crimson-pro/files/crimson-pro-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/crimson-pro/files/crimson-pro-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/crimson-pro/files/crimson-pro-latin-400-italic.woff?url'),
    },
  },
  Cardo: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/cardo/400.css'),
        import('@fontsource/cardo/700.css'),
        import('@fontsource/cardo/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/cardo/files/cardo-latin-400-normal.woff?url'),
      '700-normal': () => import('@fontsource/cardo/files/cardo-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/cardo/files/cardo-latin-400-italic.woff?url'),
    },
  },
  'Abril Fatface': {
    loadCss: () => import('@fontsource/abril-fatface/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/abril-fatface/files/abril-fatface-latin-400-normal.woff?url'),
    },
  },
  'Yeseva One': {
    loadCss: () => import('@fontsource/yeseva-one/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/yeseva-one/files/yeseva-one-latin-400-normal.woff?url'),
    },
  },
  'DM Sans': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/dm-sans/400.css'),
        import('@fontsource/dm-sans/500.css'),
        import('@fontsource/dm-sans/600.css'),
        import('@fontsource/dm-sans/700.css'),
        import('@fontsource/dm-sans/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/dm-sans/files/dm-sans-latin-400-italic.woff?url'),
    },
  },
  Montserrat: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/montserrat/300.css'),
        import('@fontsource/montserrat/400.css'),
        import('@fontsource/montserrat/500.css'),
        import('@fontsource/montserrat/600.css'),
        import('@fontsource/montserrat/700.css'),
        import('@fontsource/montserrat/400-italic.css'),
      ]),
    variants: {
      '300-normal': () => import('@fontsource/montserrat/files/montserrat-latin-300-normal.woff?url'),
      '400-normal': () => import('@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/montserrat/files/montserrat-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/montserrat/files/montserrat-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/montserrat/files/montserrat-latin-400-italic.woff?url'),
    },
  },
  Lato: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/lato/300.css'),
        import('@fontsource/lato/400.css'),
        import('@fontsource/lato/700.css'),
        import('@fontsource/lato/400-italic.css'),
      ]),
    variants: {
      '300-normal': () => import('@fontsource/lato/files/lato-latin-300-normal.woff?url'),
      '400-normal': () => import('@fontsource/lato/files/lato-latin-400-normal.woff?url'),
      '700-normal': () => import('@fontsource/lato/files/lato-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/lato/files/lato-latin-400-italic.woff?url'),
    },
  },
  Raleway: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/raleway/300.css'),
        import('@fontsource/raleway/400.css'),
        import('@fontsource/raleway/500.css'),
        import('@fontsource/raleway/600.css'),
        import('@fontsource/raleway/700.css'),
        import('@fontsource/raleway/400-italic.css'),
      ]),
    variants: {
      '300-normal': () => import('@fontsource/raleway/files/raleway-latin-300-normal.woff?url'),
      '400-normal': () => import('@fontsource/raleway/files/raleway-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/raleway/files/raleway-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/raleway/files/raleway-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/raleway/files/raleway-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/raleway/files/raleway-latin-400-italic.woff?url'),
    },
  },
  'Plus Jakarta Sans': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/plus-jakarta-sans/400.css'),
        import('@fontsource/plus-jakarta-sans/500.css'),
        import('@fontsource/plus-jakarta-sans/600.css'),
        import('@fontsource/plus-jakarta-sans/700.css'),
        import('@fontsource/plus-jakarta-sans/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-italic.woff?url'),
    },
  },
  Jost: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/jost/300.css'),
        import('@fontsource/jost/400.css'),
        import('@fontsource/jost/500.css'),
        import('@fontsource/jost/600.css'),
        import('@fontsource/jost/700.css'),
        import('@fontsource/jost/400-italic.css'),
      ]),
    variants: {
      '300-normal': () => import('@fontsource/jost/files/jost-latin-300-normal.woff?url'),
      '400-normal': () => import('@fontsource/jost/files/jost-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/jost/files/jost-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/jost/files/jost-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/jost/files/jost-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/jost/files/jost-latin-400-italic.woff?url'),
    },
  },
  'Josefin Sans': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/josefin-sans/300.css'),
        import('@fontsource/josefin-sans/400.css'),
        import('@fontsource/josefin-sans/500.css'),
        import('@fontsource/josefin-sans/600.css'),
        import('@fontsource/josefin-sans/700.css'),
        import('@fontsource/josefin-sans/400-italic.css'),
      ]),
    variants: {
      '300-normal': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-300-normal.woff?url'),
      '400-normal': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/josefin-sans/files/josefin-sans-latin-400-italic.woff?url'),
    },
  },
  'Work Sans': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/work-sans/400.css'),
        import('@fontsource/work-sans/500.css'),
        import('@fontsource/work-sans/600.css'),
        import('@fontsource/work-sans/700.css'),
        import('@fontsource/work-sans/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/work-sans/files/work-sans-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/work-sans/files/work-sans-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/work-sans/files/work-sans-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/work-sans/files/work-sans-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/work-sans/files/work-sans-latin-400-italic.woff?url'),
    },
  },
  Poppins: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/poppins/400.css'),
        import('@fontsource/poppins/500.css'),
        import('@fontsource/poppins/600.css'),
        import('@fontsource/poppins/700.css'),
        import('@fontsource/poppins/400-italic.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/poppins/files/poppins-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/poppins/files/poppins-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/poppins/files/poppins-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/poppins/files/poppins-latin-700-normal.woff?url'),
      '400-italic': () => import('@fontsource/poppins/files/poppins-latin-400-italic.woff?url'),
    },
  },
  Oswald: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/oswald/400.css'),
        import('@fontsource/oswald/500.css'),
        import('@fontsource/oswald/600.css'),
        import('@fontsource/oswald/700.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/oswald/files/oswald-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/oswald/files/oswald-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/oswald/files/oswald-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/oswald/files/oswald-latin-700-normal.woff?url'),
    },
  },
  'Great Vibes': {
    loadCss: () => import('@fontsource/great-vibes/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?url'),
    },
  },
  Allura: {
    loadCss: () => import('@fontsource/allura/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/allura/files/allura-latin-400-normal.woff?url'),
    },
  },
  Parisienne: {
    loadCss: () => import('@fontsource/parisienne/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/parisienne/files/parisienne-latin-400-normal.woff?url'),
    },
  },
  'Alex Brush': {
    loadCss: () => import('@fontsource/alex-brush/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/alex-brush/files/alex-brush-latin-400-normal.woff?url'),
    },
  },
  'Pinyon Script': {
    loadCss: () => import('@fontsource/pinyon-script/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff?url'),
    },
  },
  Italianno: {
    loadCss: () => import('@fontsource/italianno/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/italianno/files/italianno-latin-400-normal.woff?url'),
    },
  },
  Sacramento: {
    loadCss: () => import('@fontsource/sacramento/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/sacramento/files/sacramento-latin-400-normal.woff?url'),
    },
  },
  Tangerine: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/tangerine/400.css'),
        import('@fontsource/tangerine/700.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/tangerine/files/tangerine-latin-400-normal.woff?url'),
      '700-normal': () => import('@fontsource/tangerine/files/tangerine-latin-700-normal.woff?url'),
    },
  },
  'Petit Formal Script': {
    loadCss: () => import('@fontsource/petit-formal-script/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/petit-formal-script/files/petit-formal-script-latin-400-normal.woff?url'),
    },
  },
  'Rouge Script': {
    loadCss: () => import('@fontsource/rouge-script/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/rouge-script/files/rouge-script-latin-400-normal.woff?url'),
    },
  },
  'Mrs Saint Delafield': {
    loadCss: () => import('@fontsource/mrs-saint-delafield/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/mrs-saint-delafield/files/mrs-saint-delafield-latin-400-normal.woff?url'),
    },
  },
  'Dancing Script': {
    loadCss: () =>
      Promise.all([
        import('@fontsource/dancing-script/400.css'),
        import('@fontsource/dancing-script/500.css'),
        import('@fontsource/dancing-script/600.css'),
        import('@fontsource/dancing-script/700.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/dancing-script/files/dancing-script-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff?url'),
    },
  },
  Caveat: {
    loadCss: () =>
      Promise.all([
        import('@fontsource/caveat/400.css'),
        import('@fontsource/caveat/500.css'),
        import('@fontsource/caveat/600.css'),
        import('@fontsource/caveat/700.css'),
      ]),
    variants: {
      '400-normal': () => import('@fontsource/caveat/files/caveat-latin-400-normal.woff?url'),
      '500-normal': () => import('@fontsource/caveat/files/caveat-latin-500-normal.woff?url'),
      '600-normal': () => import('@fontsource/caveat/files/caveat-latin-600-normal.woff?url'),
      '700-normal': () => import('@fontsource/caveat/files/caveat-latin-700-normal.woff?url'),
    },
  },
  Satisfy: {
    loadCss: () => import('@fontsource/satisfy/400.css'),
    variants: {
      '400-normal': () => import('@fontsource/satisfy/files/satisfy-latin-400-normal.woff?url'),
    },
  },
};

export const SUPPORTED_FONTS: SupportedFontDefinition[] = SUPPORTED_FONT_CATALOG.map((entry) => {
  const loader = FONT_LOADERS[entry.family];
  if (!loader) {
    throw new Error(`Missing font loader definition for "${entry.family}".`);
  }
  const displayCategory: SupportedFontDefinition['displayCategory'] =
    entry.category === 'Script'
      ? 'Script'
      : entry.category === 'Sans'
      ? 'Modern Sans'
      : 'Editorial Serif';

  return {
    ...entry,
    displayCategory,
    loadCss: loader.loadCss,
    variants: loader.variants,
  };
});

export const SUPPORTED_FONT_SET = new Set(SUPPORTED_FONTS.map((f) => f.family));

const loadedCssFamilies = new Set<string>();
const pendingFamilyLoads = new Map<string, Promise<void>>();
const woffDataUriCache = new Map<string, string>();
const ttfBase64Cache = new Map<string, string>();

// Keeps PackageSpec referenced without unused export noise
export type { PackageSpec };

export function getFontDefinition(family: string): SupportedFontDefinition | undefined {
  return SUPPORTED_FONTS.find((f) => f.family.toLowerCase() === family.toLowerCase());
}

export function isFontFamilyLoaded(family: string): boolean {
  return loadedCssFamilies.has(family);
}

/**
 * Loads only the @fontsource CSS stylesheets needed for the requested font families
 * and blocks until document.fonts.load confirms every font & weight is ready.
 */
export async function ensureFontsLoaded(
  reqs: Array<{ family: string; weight?: string; style?: 'normal' | 'italic' }>
): Promise<void> {
  const uniqueFamilies = Array.from(new Set(reqs.map((r) => r.family)));

  await Promise.all(
    uniqueFamilies.map(async (fam) => {
      if (loadedCssFamilies.has(fam)) return;
      const existing = pendingFamilyLoads.get(fam);
      if (existing) return existing;

      const def = getFontDefinition(fam);
      if (!def) {
        throw new Error(`Unsupported font family "${fam}".`);
      }

      const promise = (async () => {
        await def.loadCss();
        loadedCssFamilies.add(fam);
      })().finally(() => {
        pendingFamilyLoads.delete(fam);
      });

      pendingFamilyLoads.set(fam, promise);
      return promise;
    })
  );

  if (typeof document !== 'undefined' && 'fonts' in document) {
    const loadTasks: Promise<FontFace[]>[] = [];
    for (const req of reqs) {
      const def = getFontDefinition(req.family);
      if (!def) continue;
      const w = def.weights.includes(req.weight || '400') ? req.weight || '400' : '400';
      const st = def.hasItalic && req.style === 'italic' ? 'italic' : 'normal';
      loadTasks.push(document.fonts.load(`${st} ${w} 48px "${def.family}"`));
    }
    await Promise.all(loadTasks);
    await document.fonts.ready;
  }
}

function resolveVariantKey(
  def: SupportedFontDefinition,
  weight: string,
  style: 'normal' | 'italic'
): string {
  const normalizedStyle = def.hasItalic && style === 'italic' ? 'italic' : 'normal';
  const exact = `${weight}-${normalizedStyle}`;
  if (def.variants[exact]) return exact;
  if (def.variants[`400-${normalizedStyle}`]) return `400-${normalizedStyle}`;
  if (def.variants[`${weight}-normal`]) return `${weight}-normal`;
  return '400-normal';
}

async function fetchLocalWoffBytes(
  family: string,
  weight: string,
  style: 'normal' | 'italic'
): Promise<{ bytes: Uint8Array; variantKey: string; def: SupportedFontDefinition }> {
  const def = getFontDefinition(family);
  if (!def) {
    throw new Error(`Font "${family}" is not in the bundled font catalog.`);
  }
  const variantKey = resolveVariantKey(def, weight, style);
  const importer = def.variants[variantKey];
  if (!importer) {
    throw new Error(`Font variant ${family} (${variantKey}) is unavailable.`);
  }
  const mod = await importer();
  const res = await fetch(mod.default);
  if (!res.ok) {
    throw new Error(`Could not load local font binary for ${family}.`);
  }
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), variantKey, def };
}

/**
 * Generates self-contained @font-face CSS with base64-encoded WOFF binaries
 * for embedding inside standalone PNG/SVG exports.
 */
export async function buildEmbeddedLocalFontCss(
  reqs: Array<{ family: string; weight: string; style: 'normal' | 'italic' }>
): Promise<string> {
  const blocks: string[] = [];
  const seen = new Set<string>();

  for (const req of reqs) {
    const def = getFontDefinition(req.family);
    if (!def) continue;
    const resolvedKey = resolveVariantKey(def, req.weight, req.style);
    const cacheKey = `${def.family}::${resolvedKey}`;
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);

    let dataUri = woffDataUriCache.get(cacheKey);
    if (!dataUri) {
      const { bytes } = await fetchLocalWoffBytes(req.family, req.weight, req.style);
      dataUri = `data:font/woff;base64,${uint8ToBase64(bytes)}`;
      woffDataUriCache.set(cacheKey, dataUri);
    }

    const [w, st] = resolvedKey.split('-');
    blocks.push(
      `@font-face { font-family: '${def.family}'; font-style: ${st}; font-weight: ${w}; src: url('${dataUri}') format('woff'); }`
    );
  }

  return blocks.join('\n');
}

/**
 * Loads and unpacks a local @fontsource .woff file into a TTF base64 string
 * suitable for jsPDF.addFileToVFS() & jsPDF.addFont().
 */
export async function getEmbeddedTtfBase64(
  family: string,
  weight: string,
  style: 'normal' | 'italic'
): Promise<{
  ttfBase64: string;
  vfsName: string;
  jsPdfFamily: string;
  jsPdfStyle: 'normal' | 'italic' | 'bold' | 'bolditalic';
}> {
  const def = getFontDefinition(family);
  if (!def) {
    throw new Error(`Font "${family}" cannot be embedded because it is unsupported.`);
  }
  const resolvedKey = resolveVariantKey(def, weight, style);
  const cacheKey = `${def.family}::${resolvedKey}`;

  let ttfBase64 = ttfBase64Cache.get(cacheKey);
  if (!ttfBase64) {
    const { bytes } = await fetchLocalWoffBytes(def.family, weight, style);
    const ttfBytes = await unpackWoff1ToTtf(bytes);
    ttfBase64 = uint8ToBase64(ttfBytes);
    ttfBase64Cache.set(cacheKey, ttfBase64);
  }

  const [w, st] = resolvedKey.split('-');
  const isBold = Number(w) >= 600;
  const isItalic = st === 'italic';
  const jsPdfStyle = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
  const vfsName = `${def.family.replace(/\s+/g, '_')}-${resolvedKey}.ttf`;

  return {
    ttfBase64,
    vfsName,
    jsPdfFamily: def.family,
    jsPdfStyle,
  };
}
