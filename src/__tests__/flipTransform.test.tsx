import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RightInspector } from '../components/RightInspector/RightInspector';
import {
  buildTransformString,
  estimateNodeLocalCenter,
  findNodeWithAncestors,
  parseSvgToScene,
  resolveTransformPivotPatch,
  SvgSceneDocument,
  SvgTransformState,
} from '../engine/svgScene';

const noop = () => {};

function makeScene(svgMarkup: string): SvgSceneDocument {
  return parseSvgToScene(svgMarkup, 'Flip Test Design');
}

describe('Flip H / Flip V & Transform Pivot Controls', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  it('estimateNodeLocalCenter computes local coordinates inside transformed <g> without adding ancestor offset', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
        <defs>
          <symbol id="leaf" viewBox="0 0 60 60">
            <path d="M30 5 L50 55 L10 55 Z" fill="#6F8F72" />
          </symbol>
        </defs>
        <g transform="translate(350, 350)">
          <use id="leafLeft" href="#leaf" x="-160" y="-30" width="60" height="60" />
        </g>
      </svg>
    `;
    const scene = makeScene(svg);
    const leaf = findNodeWithAncestors(scene.nodes, 'leafLeft')?.node;
    expect(leaf).toBeDefined();

    // Local center inside <g transform="translate(350, 350)"> must be (-130, 0), NOT (220, 350)
    const center = estimateNodeLocalCenter(leaf!, scene);
    expect(center).toEqual({ x: -130, y: 0 });
  });

  it('resolveTransformPivotPatch pins the visual center when flipping an element that has an unpivoted initial rotation', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
        <rect id="rotBox" x="100" y="100" width="80" height="40" transform="rotate(90)" fill="#D4AF37" />
      </svg>
    `;
    const scene = makeScene(svg);
    const node = findNodeWithAncestors(scene.nodes, 'rotBox')?.node;
    expect(node).toBeDefined();
    expect(node!.transform.rotation).toBe(90);
    expect(node!.transform.pivotX).toBeUndefined();

    const center = estimateNodeLocalCenter(node!, scene); // (140, 120)
    expect(center).toEqual({ x: 140, y: 120 });

    const patch = resolveTransformPivotPatch(node!, center);
    // Before: rotate(90) mapped (140, 120) -> (-120, 140).
    // Pinning pivot=(140, 120) requires tx = -120 - 140 = -260, ty = 140 - 120 = 20
    expect(patch.pivotX).toBe(140);
    expect(patch.pivotY).toBe(120);
    expect(patch.tx).toBe(-260);
    expect(patch.ty).toBe(20);
  });

  it('clicking Flip H and Flip V in RightInspector toggles scaleX/scaleY, updates aria-pressed, and Reset clears pivot', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
        <g transform="translate(350, 350)">
          <rect id="badgeBox" x="-160" y="-30" width="60" height="60" fill="#D4AF37" />
        </g>
      </svg>
    `;
    const initialScene = makeScene(svg);

    const Harness: React.FC = () => {
      const [scene, setScene] = useState(initialScene);

      const updateXform = (nodeId: string, patch: Partial<SvgTransformState>) => {
        setScene((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, transform: { ...n.transform, ...patch } }
              : n.children
              ? {
                  ...n,
                  children: n.children.map((ch) =>
                    ch.id === nodeId ? { ...ch, transform: { ...ch.transform, ...patch } } : ch
                  ),
                }
              : n
          ),
        }));
      };

      const handleFlip = (nodeId: string, axis: 'x' | 'y') => {
        const node = findNodeWithAncestors(scene.nodes, nodeId)?.node;
        if (!node) return;
        const localCenter = estimateNodeLocalCenter(node, scene);
        const pivotPatch = resolveTransformPivotPatch(node, localCenter);
        updateXform(nodeId, {
          ...pivotPatch,
          ...(axis === 'x'
            ? { scaleX: -node.transform.scaleX }
            : { scaleY: -node.transform.scaleY }),
        });
      };

      const target = findNodeWithAncestors(scene.nodes, 'badgeBox')?.node;
      return (
        <div>
          <div data-testid="xform-readout">
            {target ? buildTransformString(target.transform) ?? 'none' : 'missing'}
          </div>
          <RightInspector
            scene={scene}
            transparentBackground={false}
            selectedIds={['badgeBox']}
            onSelectNodes={noop}
            onUpdateTextNode={noop}
            onUpdateNodeTransform={updateXform}
            onSetNodeFill={noop}
            onSetNodeStroke={noop}
            onSetNodeStrokeWidth={noop}
            onSetNodeOpacity={noop}
            onSetNodeCornerRadius={noop}
            onReplaceImageSource={noop}
            onSetImageFitMode={noop}
            onReplaceNodeWithPreset={noop}
            onRenameNode={noop}
            onToggleVisibility={noop}
            onToggleLock={noop}
            onDuplicateNodes={noop}
            onCopyNodes={noop}
            onDeleteNodes={noop}
            onReorderNode={noop}
            onGroupNodes={noop}
            onUngroupNode={noop}
            onAlignNodes={noop}
            onDistributeNodes={noop}
            onFlipNode={handleFlip}
            onApplyBackground={noop}
            onSetTransparentBackground={noop}
            onOpenFontStudio={noop}
            onOpenBackgroundTab={noop}
          />
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<Harness />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const flipHBtn = buttons.find((b) => b.textContent?.trim() === 'Flip H')!;
    const flipVBtn = buttons.find((b) => b.textContent?.trim() === 'Flip V')!;
    const resetBtn = buttons.find((b) => b.textContent?.trim() === 'Reset')!;
    expect(flipHBtn).toBeDefined();
    expect(flipVBtn).toBeDefined();
    expect(resetBtn).toBeDefined();
    expect(flipHBtn.getAttribute('aria-pressed')).toBe('false');
    expect(flipVBtn.getAttribute('aria-pressed')).toBe('false');

    // Click Flip H -> pivots around local (-130, 0)
    await act(async () => {
      flipHBtn.click();
    });
    expect(flipHBtn.getAttribute('aria-pressed')).toBe('true');
    expect(flipVBtn.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="xform-readout"]')?.textContent).toBe(
      'translate(-130 0) scale(-1 1) translate(130 0)'
    );

    // Click Flip V -> scale(-1 -1) around same local pivot
    await act(async () => {
      flipVBtn.click();
    });
    expect(flipHBtn.getAttribute('aria-pressed')).toBe('true');
    expect(flipVBtn.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="xform-readout"]')?.textContent).toBe(
      'translate(-130 0) scale(-1 -1) translate(130 0)'
    );

    // Click Flip H again -> toggles back to unflipped X
    await act(async () => {
      flipHBtn.click();
    });
    expect(flipHBtn.getAttribute('aria-pressed')).toBe('false');
    expect(flipVBtn.getAttribute('aria-pressed')).toBe('true');

    // Click Reset -> clears scale, rotation, translation, and pivot
    await act(async () => {
      resetBtn.click();
    });
    expect(flipHBtn.getAttribute('aria-pressed')).toBe('false');
    expect(flipVBtn.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-testid="xform-readout"]')?.textContent).toBe('none');
  });
});
