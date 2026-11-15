export interface NamedColorSwatch {
  name: string;
  hex: string;
}

export interface ColorCombinationScheme {
  id: string;
  label: string;
  description: string;
  background: string;
  accent: string;
  secondaryAccent: string;
  headingText: string;
  bodyText: string;
}

export interface ColorCollection {
  id: string;
  name: string;
  swatches: NamedColorSwatch[];
  combinations: ColorCombinationScheme[];
}

export const COLOR_COLLECTIONS: ColorCollection[] = [
  {
    id: 'classic-wedding',
    name: 'Classic Wedding',
    swatches: [
      { name: 'Pure Ivory', hex: '#FAF7F0' },
      { name: 'Warm Vellum', hex: '#F3ECE0' },
      { name: 'Champagne Mist', hex: '#EADCC6' },
      { name: 'Espresso Ink', hex: '#2E261F' },
      { name: 'Warm Taupe', hex: '#6B5E4A' },
      { name: 'Slate Charcoal', hex: '#383A3D' },
      { name: 'Antique Brass', hex: '#B5904B' },
    ],
    combinations: [
      {
        id: 'classic-ivory-espresso',
        label: 'Ivory & Espresso',
        description: 'Timeless letterpress cream with rich dark espresso ink',
        background: '#FAF7F0',
        accent: '#B5904B',
        secondaryAccent: '#F3ECE0',
        headingText: '#2E261F',
        bodyText: '#6B5E4A',
      },
      {
        id: 'classic-vellum-charcoal',
        label: 'Warm Vellum & Charcoal',
        description: 'Soft linen paper paired with clean engraved slate',
        background: '#F3ECE0',
        accent: '#6B5E4A',
        secondaryAccent: '#FAF7F0',
        headingText: '#1F1E1C',
        bodyText: '#57524A',
      },
    ],
  },
  {
    id: 'romantic-pink',
    name: 'Romantic Pink',
    swatches: [
      { name: 'Rosewater Paper', hex: '#FDF4F5' },
      { name: 'Blush Petal', hex: '#F7DDE2' },
      { name: 'Dusty Rose', hex: '#D8A1AC' },
      { name: 'Antique Mauve', hex: '#B47987' },
      { name: 'Deep Mulberry', hex: '#643242' },
      { name: 'Warm Plum', hex: '#4B2834' },
      { name: 'Soft Peony', hex: '#EAC0C8' },
    ],
    combinations: [
      {
        id: 'romantic-blush-plum',
        label: 'Rosewater & Plum',
        description: 'Delicate blush stationery with romantic mulberry text',
        background: '#FDF4F5',
        accent: '#B47987',
        secondaryAccent: '#F7DDE2',
        headingText: '#4B2834',
        bodyText: '#784A57',
      },
    ],
  },
  {
    id: 'soft-pastels',
    name: 'Soft Pastels',
    swatches: [
      { name: 'Cloud Cream', hex: '#FBF9F5' },
      { name: 'Powder Blue', hex: '#D7E5F0' },
      { name: 'Mist Mint', hex: '#DCECE2' },
      { name: 'Buttercream', hex: '#F9EFD7' },
      { name: 'Periwinkle Mist', hex: '#CBD4EC' },
      { name: 'Petal Lilac', hex: '#E8DFF1' },
      { name: 'Soft Slate', hex: '#4D5866' },
    ],
    combinations: [
      {
        id: 'pastel-garden-spring',
        label: 'Spring Garden',
        description: 'Airy cream paper with pastel mint and powder slate ink',
        background: '#FBF9F5',
        accent: '#90B0A0',
        secondaryAccent: '#D7E5F0',
        headingText: '#3A4652',
        bodyText: '#5D6A77',
      },
    ],
  },
  {
    id: 'botanical-green',
    name: 'Botanical Green',
    swatches: [
      { name: 'Parchment Tint', hex: '#F6F7F2' },
      { name: 'Eucalyptus', hex: '#748660' },
      { name: 'Forest Moss', hex: '#485A3C' },
      { name: 'Olive Branch', hex: '#636E48' },
      { name: 'Deep Pine', hex: '#243528' },
      { name: 'Fern Leaf', hex: '#889B74' },
      { name: 'Garden Moss', hex: '#354832' },
    ],
    combinations: [
      {
        id: 'botanical-pine-parchment',
        label: 'Deep Pine & Eucalyptus',
        description: 'Natural botanical greens on soft organic paper',
        background: '#F6F7F2',
        accent: '#485A3C',
        secondaryAccent: '#FFFDF8',
        headingText: '#243528',
        bodyText: '#53624D',
      },
    ],
  },
  {
    id: 'earthy-neutrals',
    name: 'Earthy Neutrals',
    swatches: [
      { name: 'Oatmeal', hex: '#F4EFE6' },
      { name: 'Sandstone', hex: '#E3D7C3' },
      { name: 'Warm Clay', hex: '#B79C82' },
      { name: 'Chestnut Brown', hex: '#6F5542' },
      { name: 'Deep Umber', hex: '#3E2F24' },
      { name: 'Dune Stone', hex: '#C7B8A1' },
      { name: 'Muted Linen', hex: '#ECE5D8' },
    ],
    combinations: [
      {
        id: 'earthy-oatmeal-umber',
        label: 'Oatmeal & Umber',
        description: 'Organic desert sandstone paper with warm chestnut ink',
        background: '#F4EFE6',
        accent: '#9C7B5E',
        secondaryAccent: '#FAF6EE',
        headingText: '#3E2F24',
        bodyText: '#6F5542',
      },
    ],
  },
  {
    id: 'luxury-black',
    name: 'Luxury Black',
    swatches: [
      { name: 'Obsidian Matte', hex: '#141414' },
      { name: 'Velvet Onyx', hex: '#1C1B1A' },
      { name: 'Graphite Paper', hex: '#262626' },
      { name: 'Pearl White', hex: '#F6F4EF' },
      { name: 'Brushed Silver', hex: '#C4C7CC' },
      { name: 'Burnished Gold', hex: '#C8A45D' },
      { name: 'Warm Champagne', hex: '#E6D6B8' },
    ],
    combinations: [
      {
        id: 'luxury-obsidian-champagne',
        label: 'Obsidian & Champagne',
        description: 'Dramatic black cardstock illuminated by warm champagne',
        background: '#141414',
        accent: '#C8A45D',
        secondaryAccent: '#E6D6B8',
        headingText: '#F6F4EF',
        bodyText: '#D6CEBE',
      },
      {
        id: 'luxury-onyx-silver',
        label: 'Onyx & Sterling Silver',
        description: 'Evening monochrome black-tie cardstock with crisp pearl ink',
        background: '#1C1B1A',
        accent: '#C4C7CC',
        secondaryAccent: '#F6F4EF',
        headingText: '#F6F4EF',
        bodyText: '#B8BBC0',
      },
    ],
  },
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    swatches: [
      { name: 'Porcelain White', hex: '#F7F9FC' },
      { name: 'Powder Azure', hex: '#D8E3F2' },
      { name: 'Slate Cobalt', hex: '#4B6994' },
      { name: 'Coastal Navy', hex: '#233B63' },
      { name: 'Midnight Royal', hex: '#162440' },
      { name: 'Delft Blue', hex: '#375480' },
      { name: 'Silver Slate', hex: '#8FA2BD' },
    ],
    combinations: [
      {
        id: 'royal-porcelain-midnight',
        label: 'Porcelain & Midnight Royal',
        description: 'Crisp blue-white paper paired with formal midnight ink',
        background: '#F7F9FC',
        accent: '#375480',
        secondaryAccent: '#D8E3F2',
        headingText: '#162440',
        bodyText: '#445875',
      },
    ],
  },
  {
    id: 'lavender',
    name: 'Lavender',
    swatches: [
      { name: 'Soft Alabaster', hex: '#FAF8FC' },
      { name: 'Wisteria Mist', hex: '#EAE2F3' },
      { name: 'French Lavender', hex: '#B59ECF' },
      { name: 'Muted Violet', hex: '#866EA2' },
      { name: 'Deep Aubergine', hex: '#423059' },
      { name: 'Iris Petal', hex: '#CBB8DF' },
      { name: 'Heather Gray', hex: '#6E637B' },
    ],
    combinations: [
      {
        id: 'lavender-wisteria-aubergine',
        label: 'French Lavender & Aubergine',
        description: 'Romantic Provençal lavender tones with deep plum ink',
        background: '#FAF8FC',
        accent: '#866EA2',
        secondaryAccent: '#EAE2F3',
        headingText: '#423059',
        bodyText: '#6E637B',
      },
    ],
  },
  {
    id: 'burgundy',
    name: 'Burgundy',
    swatches: [
      { name: 'Alabaster Cream', hex: '#FAF5F2' },
      { name: 'Blush Wine', hex: '#E8D5D8' },
      { name: 'Merlot', hex: '#7A2E3D' },
      { name: 'Deep Burgundy', hex: '#541B27' },
      { name: 'Bordeaux Ink', hex: '#38131B' },
      { name: 'Spiced Rose', hex: '#A65B68' },
      { name: 'Antique Gold', hex: '#BC9959' },
    ],
    combinations: [
      {
        id: 'burgundy-alabaster-merlot',
        label: 'Alabaster & Deep Burgundy',
        description: 'Autumn formal wine and merlot balanced with warm ivory',
        background: '#FAF5F2',
        accent: '#7A2E3D',
        secondaryAccent: '#F2E5E7',
        headingText: '#38131B',
        bodyText: '#6A474D',
      },
    ],
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    swatches: [
      { name: 'Sunlit Linen', hex: '#FBF5EE' },
      { name: 'Apricot Clay', hex: '#E7B9A0' },
      { name: 'Rust Terracotta', hex: '#B86245' },
      { name: 'Burnt Sienna', hex: '#8E432C' },
      { name: 'Canyon Clay', hex: '#C97E61' },
      { name: 'Espresso Bark', hex: '#3D271E' },
      { name: 'Desert Sand', hex: '#EFE2D3' },
    ],
    combinations: [
      {
        id: 'terracotta-linen-sienna',
        label: 'Sunlit Linen & Terracotta',
        description: 'Warm Mediterranean clay tones with grounded espresso ink',
        background: '#FBF5EE',
        accent: '#B86245',
        secondaryAccent: '#F3DFCF',
        headingText: '#3D271E',
        bodyText: '#7D4E3D',
      },
    ],
  },
  {
    id: 'sage',
    name: 'Sage',
    swatches: [
      { name: 'Misty Sage Paper', hex: '#F3F6F1' },
      { name: 'Soft Willow', hex: '#DCE4D7' },
      { name: 'Dusty Sage', hex: '#9BAE94' },
      { name: 'Herb Garden', hex: '#73886D' },
      { name: 'Deep Olive', hex: '#3F4F3B' },
      { name: 'Charcoal Moss', hex: '#283126' },
      { name: 'Warm Cream', hex: '#FAF8F3' },
    ],
    combinations: [
      {
        id: 'sage-willow-olive',
        label: 'Soft Willow & Olive',
        description: 'Restful sage garden palette with deep olive typography',
        background: '#F3F6F1',
        accent: '#73886D',
        secondaryAccent: '#FFFDF8',
        headingText: '#283126',
        bodyText: '#53624F',
      },
    ],
  },
  {
    id: 'minimalist-monochrome',
    name: 'Minimalist Monochrome',
    swatches: [
      { name: 'Gallery White', hex: '#FFFFFF' },
      { name: 'Chalk Paper', hex: '#F5F5F3' },
      { name: 'Dove Gray', hex: '#D4D4D0' },
      { name: 'Stone Gray', hex: '#787874' },
      { name: 'Carbon Ink', hex: '#1F1F1E' },
      { name: 'Pure Jet', hex: '#0D0D0D' },
      { name: 'Warm Ash', hex: '#EBEBE7' },
    ],
    combinations: [
      {
        id: 'mono-gallery-carbon',
        label: 'Gallery White & Carbon',
        description: 'Architectural editorial black-and-white contrast',
        background: '#FFFFFF',
        accent: '#1F1F1E',
        secondaryAccent: '#F5F5F3',
        headingText: '#0D0D0D',
        bodyText: '#5E5E5A',
      },
    ],
  },
  {
    id: 'modern-vibrant',
    name: 'Modern Vibrant',
    swatches: [
      { name: 'Crisp Bright', hex: '#FCFCFA' },
      { name: 'Coral Punch', hex: '#E05A47' },
      { name: 'Marigold', hex: '#D9912B' },
      { name: 'Cobalt Electric', hex: '#2653B8' },
      { name: 'Emerald Teal', hex: '#1E7A6D' },
      { name: 'Fuchsia Berry', hex: '#B8336A' },
      { name: 'Ink Navy', hex: '#182138' },
    ],
    combinations: [
      {
        id: 'vibrant-cobalt-coral',
        label: 'Cobalt & Coral Celebration',
        description: 'Playful contemporary palette for parties and modern events',
        background: '#FCFCFA',
        accent: '#E05A47',
        secondaryAccent: '#D8E4F8',
        headingText: '#182138',
        bodyText: '#2653B8',
      },
    ],
  },
  {
    id: 'vintage',
    name: 'Vintage',
    swatches: [
      { name: 'Aged Parchment', hex: '#F2E8D5' },
      { name: 'Antique Lace', hex: '#FAF2E4' },
      { name: 'Sepia Rust', hex: '#8A563E' },
      { name: 'Faded Teal', hex: '#5D7B7C' },
      { name: 'Heritage Walnut', hex: '#433126' },
      { name: 'Dusty Ochre', hex: '#B8925A' },
      { name: 'Victorian Mauve', hex: '#8C6B73' },
    ],
    combinations: [
      {
        id: 'vintage-parchment-walnut',
        label: 'Aged Parchment & Walnut',
        description: 'Nostalgic heirloom cream with sepia and muted teal',
        background: '#F2E8D5',
        accent: '#5D7B7C',
        secondaryAccent: '#FAF2E4',
        headingText: '#433126',
        bodyText: '#6F5444',
      },
    ],
  },
  {
    id: 'gold-and-metallic',
    name: 'Gold & Metallic',
    swatches: [
      { name: 'Gilded Ivory', hex: '#FCFBF7' },
      { name: 'Champagne Gold', hex: '#D4B47D' },
      { name: 'Antique Foil', hex: '#B5904B' },
      { name: 'Rose Gold', hex: '#C48477' },
      { name: 'Burnished Copper', hex: '#A46447' },
      { name: 'Sterling Pewter', hex: '#8C9197' },
      { name: 'Deep Bronze', hex: '#4D3D2A' },
    ],
    combinations: [
      {
        id: 'metallic-ivory-foil',
        label: 'Gilded Ivory & Foil Gold',
        description: 'Classic foil gold borders framed against warm ivory paper',
        background: '#FCFBF7',
        accent: '#B5904B',
        secondaryAccent: '#F5EFE2',
        headingText: '#26211A',
        bodyText: '#6B5D47',
      },
      {
        id: 'metallic-obsidian-rosegold',
        label: 'Rose Gold Evening',
        description: 'Warm rose-gold metallic sheen on soft cream paper',
        background: '#FBF7F5',
        accent: '#C48477',
        secondaryAccent: '#F2E4DF',
        headingText: '#3A2825',
        bodyText: '#755852',
      },
    ],
  },
];

const FAVORITE_COLORS_STORAGE_KEY = 'invitora:favorite-colors:v1';

export function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export function normalizeHexInput(value: string): string | null {
  const cleaned = value.trim().replace(/^#?/, '#').toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^#[0-9A-F]{3}$/.test(cleaned)) {
    const [, r, g, b] = cleaned;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export function readFavoriteColors(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITE_COLORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === 'string' && isValidHexColor(c));
  } catch {
    return [];
  }
}

export function saveFavoriteColors(colors: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITE_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignore storage quota / privacy mode failures silently
  }
}
