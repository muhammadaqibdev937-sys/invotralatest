import { SUPPORTED_FONT_CATALOG } from '../engine/fonts';
import { SvgSceneNode, getTextNodeProperties } from '../engine/svgScene';
import { getFontDefinition } from './fontLoader';

export type FontCollectionKey = 'serif' | 'sans' | 'script';

export const PREDEFINED_FONT_COLLECTIONS: Record<
  FontCollectionKey,
  { label: string; fonts: string[] }
> = {
  serif: {
    label: 'Elegant Serif',
    fonts: SUPPORTED_FONT_CATALOG.filter((f) => f.category === 'Serif').map((f) => f.family),
  },
  sans: {
    label: 'Modern Sans-Serif',
    fonts: SUPPORTED_FONT_CATALOG.filter((f) => f.category === 'Sans').map((f) => f.family),
  },
  script: {
    label: 'Elegant Script',
    fonts: SUPPORTED_FONT_CATALOG.filter((f) => f.category === 'Script').map((f) => f.family),
  },
};

export interface CompatibleCompanionOption {
  id: string;
  companionFont: string;
  collectionLabel: string;
  description: string;
  targetSummary: string;
  updates: Record<string, { fontFamily: string; fontWeight?: string; fontStyle?: 'normal' | 'italic' }>;
}

export function getFontCollectionKey(family: string): FontCollectionKey {
  const cat = getFontDefinition(family)?.category;
  if (cat === 'Script') return 'script';
  if (cat === 'Sans') return 'sans';
  return 'serif';
}

export function getSvgFontPairingSuggestions(params: {
  activeNode: SvgSceneNode;
  activeFont: string;
  textNodes: Array<{ node: SvgSceneNode; ancestors: SvgSceneNode[] }>;
  cssRules: Record<string, Record<string, string>>;
}): {
  compatibleOptions: CompatibleCompanionOption[];
} {
  const { activeNode, activeFont, textNodes, cssRules } = params;
  const compatibleOptions: CompatibleCompanionOption[] = [];
  const otherTextNodes = textNodes.filter((t) => t.node.id !== activeNode.id);

  if (otherTextNodes.length === 0) {
    return { compatibleOptions };
  }

  const activeKey = getFontCollectionKey(activeFont);
  const activeProps = getTextNodeProperties(activeNode, cssRules);
  const activeIsHeading =
    activeProps.fontSize >= 42 ||
    /name|couple|title|header|monogram/i.test(`${activeNode.id} ${activeNode.label}`);

  const candidateRules: Array<{ collection: FontCollectionKey; reason: string }> =
    activeKey === 'script'
      ? [
          { collection: 'serif', reason: 'Classic contrast for dates & ceremony details' },
          { collection: 'sans', reason: 'Clean modern balance for venue & schedule lines' },
        ]
      : activeKey === 'serif'
      ? [
          { collection: 'sans', reason: 'Crisp modern contrast for supporting details' },
          ...(activeIsHeading
            ? [{ collection: 'serif' as const, reason: 'Harmonious all-serif typography hierarchy' }]
            : [{ collection: 'script' as const, reason: 'Romantic calligraphy highlight for names' }]),
        ]
      : [
          ...(activeIsHeading
            ? [{ collection: 'sans' as const, reason: 'Clean minimal pairing across all lines' }]
            : [
                { collection: 'serif' as const, reason: 'Timeless editorial contrast for main headings' },
                { collection: 'script' as const, reason: 'Elegant calligraphy accent for names' },
              ]),
          { collection: 'sans', reason: 'Unified architectural sans-serif styling' },
        ];

  const seenCompanions = new Set<string>();

  for (const rule of candidateRules) {
    const pool = PREDEFINED_FONT_COLLECTIONS[rule.collection].fonts.filter(
      (f) => f !== activeFont
    );
    const pick = pool[0];
    if (!pick || seenCompanions.has(pick)) continue;
    seenCompanions.add(pick);

    const pickDef = getFontDefinition(pick);
    const isCompanionScript = pickDef?.category === 'Script';

    const matchingTargets = isCompanionScript
      ? otherTextNodes.filter(({ node, ancestors }) => {
          const p = getTextNodeProperties(node, cssRules, ancestors);
          return (
            p.fontSize >= 40 ||
            /name|couple|title|monogram/i.test(`${node.id} ${node.label}`)
          );
        })
      : otherTextNodes;

    const effectiveTargets = matchingTargets.length > 0 ? matchingTargets : [otherTextNodes[0]];
    const updates: CompatibleCompanionOption['updates'] = {};

    for (const { node } of effectiveTargets) {
      updates[node.id] = {
        fontFamily: pick,
        ...(isCompanionScript ? { fontWeight: '400', fontStyle: 'normal' } : {}),
      };
    }

    const targetSummary =
      effectiveTargets.length === otherTextNodes.length
        ? 'Updates all other text layers'
        : `Applies to ${effectiveTargets.map((t) => t.node.label).join(', ')}`;

    compatibleOptions.push({
      id: `compat-${activeKey}-${pick.toLowerCase().replace(/\s+/g, '-')}`,
      companionFont: pick,
      collectionLabel: PREDEFINED_FONT_COLLECTIONS[rule.collection].label,
      description: rule.reason,
      targetSummary,
      updates,
    });
  }

  return { compatibleOptions };
}
