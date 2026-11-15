import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorDiagnosticFooter } from '../components/Editor/EditorDiagnosticFooter';
import { LiveTextControl } from '../components/Editor/LiveTextControl';
import { ExportPanel } from '../components/ExportPanel/ExportPanel';
import { FieldPanel } from '../components/FieldPanel/FieldPanel';
import { GoogleFontsPicker } from '../components/FontPicker/GoogleFontsPicker';
import { InvitationCanvas } from '../components/InvitationCanvas/InvitationCanvas';
import { RightInspector } from '../components/RightInspector/RightInspector';
import { ThemeToggleSwitch } from '../components/Toolbar/ThemeToggleSwitch';
import {
  computeSceneDiagnostics,
  formatMemoryBytes,
} from '../engine/sceneDiagnostics';
import { LoadedTemplateV1 } from '../engine/schema';
import {
  applyTextEditToNode,
  collectTextNodesWithAncestors,
  findNodeWithAncestors,
  getNodeTspans,
  getTextNodeProperties,
  parseSvgToScene,
  SvgSceneDocument,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
} from '../engine/svgScene';
import { useEditorState } from '../hooks/useEditorState';
import { EditorPage } from '../pages/EditorPage';

const noop = () => {};

function mapNodesRecursive(
  nodes: SvgSceneNode[],
  fn: (node: SvgSceneNode) => SvgSceneNode
): SvgSceneNode[] {
  return nodes.map((n) => {
    const mapped = n.children ? { ...n, children: mapNodesRecursive(n.children, fn) } : n;
    return fn(mapped);
  });
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  coords: { clientX: number; clientY: number; button?: number }
): void {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clientX: number;
    clientY: number;
    button: number;
    pointerId: number;
    shiftKey: boolean;
    altKey: boolean;
  };
  Object.defineProperties(ev, {
    clientX: { value: coords.clientX },
    clientY: { value: coords.clientY },
    button: { value: coords.button ?? 0 },
    pointerId: { value: 1 },
    shiftKey: { value: false },
    altKey: { value: false },
  });
  target.dispatchEvent(ev);
}

function setNativeControlValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  nextValue: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  valueSetter?.call(el, nextValue);
}

function makeTemplate(svg: string, name = 'Test Design'): LoadedTemplateV1 {
  const scene = parseSvgToScene(svg, name);
  return {
    id: `tpl_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    designVersion: 'v1',
    exportFilename: 'test-export.svg',
    originalScene: scene,
    sourceInfo: {
      fileName: 'test.svg',
      fileType: 'svg',
      fileSizeBytes: svg.length,
      textCount: collectTextNodesWithAncestors(scene.nodes).length,
      shapeCount: 0,
      groupCount: 0,
      imageCount: 0,
      warnings: [],
    },
  };
}

describe('Editor Enhancements: Live Text Editing, Undo Grouping, IME, Footer Diagnostics & Theme Switch', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    window.localStorage.clear();
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });

  afterEach(() => {
    vi.useRealTimers();
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container?.remove();
    container = null;
  });

  it('computes active layers synchronously and debounces font-summary & memory recalculation by 350ms in EditorDiagnosticFooter', async () => {
    vi.useFakeTimers();

    const baseSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <rect id="bgRect" x="0" y="0" width="600" height="800" fill="#FFFFFF" />
        <rect id="frame" x="40" y="40" width="520" height="720" fill="none" stroke="#111111" />
        <text id="title" x="300" y="200" font-family="Playfair Display" font-size="36" fill="#111111">Save the Date</text>
        <text id="subtitle" x="300" y="260" font-family="DM Sans" font-size="18" fill="#444444">October 18</text>
      </svg>
    `;
    const initialScene = parseSvgToScene(baseSvg, 'Diag Design');

    const FooterHarness: React.FC = () => {
      const [scene, setScene] = useState<SvgSceneDocument>(initialScene);

      const hideFrame = () => {
        setScene((prev) => ({
          ...prev,
          nodes: mapNodesRecursive(prev.nodes, (n) =>
            n.id === 'frame' ? { ...n, visible: false } : n
          ),
        }));
      };

      const addThirdFontNode = () => {
        const extraSvg = parseSvgToScene(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><text id="rsvp" x="300" y="500" font-family="Cinzel" font-size="20" fill="#111111">Kindly Reply By September</text></svg>`,
          'Extra'
        );
        const newNode = extraSvg.nodes[0];
        setScene((prev) => ({
          ...prev,
          nodes: [...prev.nodes, newNode],
        }));
      };

      return (
        <div>
          <button type="button" data-testid="hide-frame" onClick={hideFrame}>
            Hide Frame
          </button>
          <button type="button" data-testid="add-font-node" onClick={addThirdFontNode}>
            Add Font Node
          </button>
          <EditorDiagnosticFooter
            scene={scene}
            transparentBackground={false}
            selectedCount={1}
          />
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<FooterHarness />);
    });

    const initialDiag = computeSceneDiagnostics(initialScene);
    expect(container.querySelector('[data-testid="diag-active-layers"]')?.textContent).toBe(
      String(initialDiag.activeLayerCount)
    );
    expect(container.querySelector('[data-testid="diag-font-count"]')?.textContent).toBe('2');
    expect(container.querySelector('[data-testid="diag-memory-footprint"]')?.textContent).toBe(
      formatMemoryBytes(initialDiag.sceneBytes)
    );

    // Hide a layer -> active layers decrements synchronously and shows "/ total"
    await act(async () => {
      (container!.querySelector('[data-testid="hide-frame"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="diag-active-layers"]')?.textContent).toBe(
      String(initialDiag.activeLayerCount - 1)
    );
    expect(container.textContent).toContain(`/ ${initialDiag.totalLayerCount}`);

    // Add a new text node with Cinzel -> still debounced before 350ms, then updates after 400ms
    const beforeMemText = container.querySelector('[data-testid="diag-memory-footprint"]')?.textContent;
    await act(async () => {
      (container!.querySelector('[data-testid="add-font-node"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="diag-font-count"]')?.textContent).toBe('2');

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(container.querySelector('[data-testid="diag-font-count"]')?.textContent).toBe('3');
    const afterMemText = container.querySelector('[data-testid="diag-memory-footprint"]')?.textContent;
    expect(afterMemText).toBeTruthy();
    expect(afterMemText).not.toBe(beforeMemText);
  });

  it('ThemeToggleSwitch toggles light and dark mode on documentElement and persists preference', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ThemeToggleSwitch />);
    });

    const toggle = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Toggle to light mode
    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('invitora:theme')).toBe('light');

    // Toggle back to dark mode
    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('invitora:theme')).toBe('dark');
  });

  it('single click on canvas <text> updates live on every keystroke without Done button, preserves caret, and keeps text on outside tap, Escape, and layer switch', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <text id="headline" x="300" y="240" font-family="DM Sans" font-size="32" text-anchor="middle" fill="#111111">Hello World</text>
        <text id="subtitle" x="300" y="340" font-family="DM Sans" font-size="20" text-anchor="middle" fill="#444444">October 18</text>
      </svg>
    `;
    const initialScene = parseSvgToScene(svg, 'Direct Edit Test');
    const directEditCalls: string[] = [];

    const CanvasHarness: React.FC = () => {
      const [scene, setScene] = useState(initialScene);
      const [selectedIds, setSelectedIds] = useState<string[]>([]);
      const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');

      const handleUpdateText = (nodeId: string, patch: TextEditPatch) => {
        setScene((prev) => ({
          ...prev,
          nodes: mapNodesRecursive(prev.nodes, (n) =>
            n.id === nodeId ? applyTextEditToNode(n, patch, prev.cssRules) : n
          ),
        }));
      };

      const handleUpdateTransform = (nodeId: string, patch: Partial<SvgTransformState>) => {
        setScene((prev) => ({
          ...prev,
          nodes: mapNodesRecursive(prev.nodes, (n) =>
            n.id === nodeId ? { ...n, transform: { ...n.transform, ...patch } } : n
          ),
        }));
      };

      const headlineInfo = findNodeWithAncestors(scene.nodes, 'headline');
      const headline = headlineInfo?.node;
      const headlineText = headline
        ? getTextNodeProperties(headline, scene.cssRules, headlineInfo?.ancestors).fullText
        : '';

      return (
        <div>
          <div data-testid="live-text-readout">{headlineText}</div>
          <div data-testid="live-tx-readout">{headline?.transform.tx ?? 0}</div>
          <button
            type="button"
            data-testid="outside-tap-target"
            onClick={() => {}}
          >
            Outside
          </button>
          <button
            type="button"
            data-testid="switch-to-subtitle"
            onClick={() => setSelectedIds(['subtitle'])}
          >
            Select Subtitle
          </button>
          <InvitationCanvas
            designId="test-design"
            scene={scene}
            transparentBackground={false}
            selectedIds={selectedIds}
            toolMode={toolMode}
            onChangeToolMode={setToolMode}
            onSelectNodes={setSelectedIds}
            onUpdateNodeTransform={handleUpdateTransform}
            onUpdateTextNode={handleUpdateText}
            onDirectTextEdit={(id) => directEditCalls.push(id)}
            onToggleLock={noop}
          />
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<CanvasHarness />);
    });

    const svgEl = container.querySelector('svg[role="img"]') as SVGSVGElement | null;
    const textGroup = container.querySelector('[data-scene-id="headline"]') as SVGElement | null;
    expect(svgEl).not.toBeNull();
    expect(textGroup).not.toBeNull();

    if (svgEl) {
      vi.spyOn(svgEl, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 600,
        height: 800,
        right: 600,
        bottom: 800,
        toJSON: () => ({}),
      } as DOMRect);
    }
    if (textGroup) {
      vi.spyOn(textGroup, 'getBoundingClientRect').mockReturnValue({
        x: 200,
        y: 210,
        left: 200,
        top: 210,
        width: 200,
        height: 40,
        right: 400,
        bottom: 250,
        toJSON: () => ({}),
      } as DOMRect);
    }

    // 1. Dragging > 3px moves without opening direct text editor
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup!, 'pointermove', { clientX: 274, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerup', { clientX: 274, clientY: 225, button: 0 });
    });

    expect(container.querySelector('[data-direct-text-editor="true"]')).toBeNull();
    expect(directEditCalls).toEqual([]);
    expect(Number(container.querySelector('[data-testid="live-tx-readout"]')?.textContent)).not.toBe(0);

    // 2. Single click enters direct on-design editing WITHOUT any Done/Save/Apply/OK button
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerup', { clientX: 251, clientY: 225, button: 0 });
    });

    expect(directEditCalls).toEqual(['headline']);
    const editorWrap = container.querySelector('[data-direct-text-editor="true"]');
    expect(editorWrap).not.toBeNull();
    expect(editorWrap!.querySelectorAll('button')).toHaveLength(0);

    const textarea = editorWrap!.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Hello World');

    // 3. Typing mid-string updates SVG text live AND preserves caret position + focus
    textarea.focus();
    setNativeControlValue(textarea, 'HeXllo World');
    textarea.setSelectionRange(3, 3);
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="live-text-readout"]')?.textContent).toBe(
      'HeXllo World'
    );
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(3);
    expect(textarea.selectionEnd).toBe(3);

    // 4. Clicking/tapping outside closes editor WITHOUT losing typed text
    const outsideTarget = container.querySelector('[data-testid="outside-tap-target"]') as HTMLElement;
    await act(async () => {
      dispatchPointer(outsideTarget, 'pointerdown', { clientX: 10, clientY: 10, button: 0 });
    });
    expect(container.querySelector('[data-direct-text-editor="true"]')).toBeNull();
    expect(container.querySelector('[data-testid="live-text-readout"]')?.textContent).toBe(
      'HeXllo World'
    );

    // 5. Re-enter, type more, press Escape -> closes without reverting typed text
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerup', { clientX: 250, clientY: 225, button: 0 });
    });
    const textarea2 = container.querySelector('[data-direct-text-editor="true"] textarea') as HTMLTextAreaElement;
    setNativeControlValue(textarea2, 'Escaped Save');
    await act(async () => {
      textarea2.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      textarea2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[data-direct-text-editor="true"]')).toBeNull();
    expect(container.querySelector('[data-testid="live-text-readout"]')?.textContent).toBe(
      'Escaped Save'
    );

    // 6. Re-enter, type, and switch to another layer -> closes without losing typed text
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup!, 'pointerup', { clientX: 250, clientY: 225, button: 0 });
    });
    const textarea3 = container.querySelector('[data-direct-text-editor="true"] textarea') as HTMLTextAreaElement;
    setNativeControlValue(textarea3, 'Layer Switched Kept');
    await act(async () => {
      textarea3.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      (container!.querySelector('[data-testid="switch-to-subtitle"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-direct-text-editor="true"]')).toBeNull();
    expect(container.querySelector('[data-testid="live-text-readout"]')?.textContent).toBe(
      'Layer Switched Kept'
    );
  });

  it('has no Done/Save/Apply/OK buttons for text editing in FieldPanel, RightInspector, or GoogleFontsPicker while keeping Export Download buttons intact', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <text id="title" x="300" y="200" font-family="DM Sans" font-size="32" fill="#111111">Invite Title</text>
      </svg>
    `;
    const template = makeTemplate(svg, 'Modal Check');
    const scene = template.originalScene;
    const textEntries = collectTextNodesWithAncestors(scene.nodes);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <div>
          <div data-testid="panel-wrap">
            <FieldPanel
              scene={scene}
              transparentBackground={false}
              selectedIds={['title']}
              activeNav="text"
              onSelectNodes={noop}
              onUpdateTextNode={noop}
              onApplyBatchTextUpdates={noop}
              onAddTextPreset={noop}
              onInsertSceneNode={noop}
              onSetNodeFill={noop}
              onSetNodeStroke={noop}
              onSetNodeStrokeWidth={noop}
              onToggleVisibility={noop}
              onToggleLock={noop}
              onDeleteNodes={noop}
              onRecolorSwatchHex={noop}
              onApplyBackground={noop}
              onSetTransparentBackground={noop}
              onSetBackgroundImage={noop}
              onRemoveBackgroundNode={noop}
              onOpenFontStudio={noop}
            />
          </div>
          <div data-testid="inspector-wrap">
            <RightInspector
              scene={scene}
              transparentBackground={false}
              selectedIds={['title']}
              onSelectNodes={noop}
              onUpdateTextNode={noop}
              onUpdateNodeTransform={noop}
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
              onApplyBackground={noop}
              onSetTransparentBackground={noop}
              onOpenFontStudio={noop}
              onOpenBackgroundTab={noop}
            />
          </div>
          <div data-testid="fonts-modal-wrap">
            <GoogleFontsPicker
              textNodes={textEntries}
              cssRules={scene.cssRules}
              selectedNodeId="title"
              onSelectNode={noop}
              onUpdateTextNode={noop}
              onApplyBatchTextUpdates={noop}
              isModal
              onCloseModal={noop}
            />
          </div>
          <div data-testid="export-wrap">
            <ExportPanel
              template={template}
              docState={{ designVersion: 'v1', scene, transparentBackground: false }}
              onToggleTransparent={noop}
              onOpenHelp={noop}
            />
          </div>
        </div>
      );
    });

    const textUiRoots = [
      container.querySelector('[data-testid="panel-wrap"]')!,
      container.querySelector('[data-testid="inspector-wrap"]')!,
      container.querySelector('[data-testid="fonts-modal-wrap"]')!,
    ];

    for (const uiRoot of textUiRoots) {
      const buttons = Array.from(uiRoot.querySelectorAll('button'));
      const doneLike = buttons.filter((b) =>
        /^(done|ok|save|apply|confirm)$/i.test((b.textContent || '').trim())
      );
      expect(doneLike).toHaveLength(0);
    }

    // Export confirmation / Download buttons remain present
    const exportWrap = container.querySelector('[data-testid="export-wrap"]')!;
    const exportButtonsText = Array.from(exportWrap.querySelectorAll('button'))
      .map((b) => b.textContent || '')
      .join(' | ');
    expect(exportButtonsText).toContain('Download Editable SVG');
  });

  it('respects compositionstart and compositionend so Urdu/Hindi IME input never duplicates or breaks text', async () => {
    const emitted: string[] = [];

    const ImeHarness: React.FC = () => {
      const [val, setVal] = useState('Welcome');
      return (
        <div>
          <div data-testid="ime-state">{val}</div>
          <LiveTextControl
            as="textarea"
            nodeKey="ime-node"
            aria-label="IME Input"
            value={val}
            onLiveChange={(next) => {
              emitted.push(next);
              setVal(next);
            }}
          />
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ImeHarness />);
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    // Begin Urdu / Hindi IME composition
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });

    // Intermediate composing input events should NOT trigger duplicate/intermediate state commits
    setNativeControlValue(textarea, 'س');
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(emitted).toEqual([]);

    setNativeControlValue(textarea, 'سلام');
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(emitted).toEqual([]);

    // Composition ends -> emits final Urdu text cleanly once
    await act(async () => {
      textarea.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: 'سلام' })
      );
    });
    // Browser may also dispatch a trailing input event with identical value after compositionend
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(emitted).toEqual(['سلام']);
    expect(textarea.value).toBe('سلام');
    expect(container.querySelector('[data-testid="ime-state"]')?.textContent).toBe('سلام');

    // Second composition with Hindi Devanagari "नमस्ते"
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });
    setNativeControlValue(textarea, 'سلام नमस्ते');
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      textarea.dispatchEvent(
        new CompositionEvent('compositionend', { bubbles: true, data: 'سلام नमस्ते' })
      );
    });

    expect(emitted).toEqual(['سلام', 'سلام नमस्ते']);
    expect(container.querySelector('[data-testid="ime-state"]')?.textContent).toBe('سلام नमस्ते');
  });

  it('groups continuous typing into one undo step and starts a new step after 500ms idle or on blur/boundary', async () => {
    vi.useFakeTimers();

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <text id="headline" x="300" y="200" font-family="DM Sans" font-size="32" fill="#111111">Start</text>
      </svg>
    `;
    const template = makeTemplate(svg, 'Undo Group Test');

    const UndoHarness: React.FC = () => {
      const { docState, updateTextNode, commitUndoBoundary, undo, redo } =
        useEditorState(template);
      const node = docState?.scene.nodes[0];
      const currentText = node ? getTextNodeProperties(node, docState!.scene.cssRules).fullText : '';

      return (
        <div>
          <div data-testid="undo-text">{currentText}</div>
          <LiveTextControl
            as="input"
            type="text"
            nodeKey="headline"
            aria-label="Live undo input"
            value={currentText}
            onLiveChange={(next) => updateTextNode('headline', { text: next }, true)}
            onCommitBoundary={commitUndoBoundary}
          />
          <button type="button" data-testid="btn-undo" onClick={undo}>
            Undo
          </button>
          <button type="button" data-testid="btn-redo" onClick={redo}>
            Redo
          </button>
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<UndoHarness />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    const undoBtn = container.querySelector('[data-testid="btn-undo"]') as HTMLButtonElement;
    input.focus();

    // Burst 1: rapid keystrokes (< 500ms apart) coalesce into ONE undo step
    for (const next of ['Hello', 'Hello ', 'Hello World']) {
      await act(async () => {
        vi.advanceTimersByTime(100);
        setNativeControlValue(input, next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Hello World');

    // Idle > 500ms creates a new undo group
    await act(async () => {
      vi.advanceTimersByTime(550);
    });

    // Burst 2: another rapid typing sequence
    for (const next of ['Hello World!', 'Hello World!!']) {
      await act(async () => {
        vi.advanceTimersByTime(80);
        setNativeControlValue(input, next);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Hello World!!');

    // Blur ends Burst 2; Burst 3 starts a third distinct undo step immediately even before 500ms
    await act(async () => {
      input.blur();
    });
    input.focus();
    setNativeControlValue(input, 'Final Line');
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Final Line');

    // First undo -> reverts Burst 3 back to end of Burst 2
    await act(async () => {
      undoBtn.click();
    });
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Hello World!!');

    // Second undo -> reverts whole Burst 2 back to end of Burst 1
    await act(async () => {
      undoBtn.click();
    });
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Hello World');

    // Third undo -> reverts whole Burst 1 back to 'Start'
    await act(async () => {
      undoBtn.click();
    });
    expect(container.querySelector('[data-testid="undo-text"]')?.textContent).toBe('Start');
  });

  it('preserves <textPath> curve, tspan structure, and per-tspan styling while typing live', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <defs>
          <path id="curvePath" d="M 60 220 Q 300 80 540 220" fill="none" />
        </defs>
        <text id="curvedText" font-family="Playfair Display" font-size="28" fill="#111111">
          <textPath href="#curvePath" startOffset="50%" text-anchor="middle">Curved Header</textPath>
        </text>
        <text id="multiTspan" x="300" y="420" text-anchor="middle" font-family="DM Sans">
          <tspan x="300" dy="0" fill="#B8860B" font-size="26">Bride Name</tspan>
          <tspan x="300" dy="34" fill="#333333" font-size="16">And Groom Name</tspan>
        </text>
      </svg>
    `;
    const initialScene = parseSvgToScene(svg, 'TextPath Preserve');

    const CurvedHarness: React.FC = () => {
      const [scene, setScene] = useState(initialScene);
      const [selectedIds, setSelectedIds] = useState<string[]>(['multiTspan']);

      const handleUpdateText = (nodeId: string, patch: TextEditPatch) => {
        setScene((prev) => ({
          ...prev,
          nodes: mapNodesRecursive(prev.nodes, (n) =>
            n.id === nodeId ? applyTextEditToNode(n, patch, prev.cssRules) : n
          ),
        }));
      };

      return (
        <div className="flex flex-col">
          <InvitationCanvas
            designId="curved-design"
            scene={scene}
            transparentBackground={false}
            selectedIds={selectedIds}
            toolMode="select"
            onChangeToolMode={noop}
            onSelectNodes={setSelectedIds}
            onUpdateNodeTransform={noop}
            onUpdateTextNode={handleUpdateText}
          />
          <RightInspector
            scene={scene}
            transparentBackground={false}
            selectedIds={selectedIds}
            onSelectNodes={setSelectedIds}
            onUpdateTextNode={handleUpdateText}
            onUpdateNodeTransform={noop}
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
            onApplyBackground={noop}
            onSetTransparentBackground={noop}
            onOpenFontStudio={noop}
            onOpenBackgroundTab={noop}
          />
          <div data-testid="curved-href">
            {scene.nodes.find((n) => n.id === 'curvedText')?.textPath?.attrs.href ?? ''}
          </div>
          <div data-testid="tspan1-fill">
            {getNodeTspans(scene.nodes.find((n) => n.id === 'multiTspan')!)?.[0]?.attrs.fill ?? ''}
          </div>
          <div data-testid="tspan2-fill">
            {getNodeTspans(scene.nodes.find((n) => n.id === 'multiTspan')!)?.[1]?.attrs.fill ?? ''}
          </div>
        </div>
      );
    };

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<CurvedHarness />);
    });

    // 1. Edit line 1 of multiTspan via RightInspector -> preserves tspan count and per-tspan fill styling
    const line1Input = container.querySelector('input[aria-label="Line 1"]') as HTMLInputElement;
    expect(line1Input).not.toBeNull();
    setNativeControlValue(line1Input, 'Amina');
    await act(async () => {
      line1Input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const renderedTspans = container.querySelectorAll('[data-scene-id="multiTspan"] tspan');
    expect(renderedTspans).toHaveLength(2);
    expect(renderedTspans[0].textContent).toBe('Amina');
    expect(renderedTspans[1].textContent).toBe('And Groom Name');
    expect(container.querySelector('[data-testid="tspan1-fill"]')?.textContent).toBe('#B8860B');
    expect(container.querySelector('[data-testid="tspan2-fill"]')?.textContent).toBe('#333333');

    // 2. Click curvedText on canvas -> opens inline fallback without Done button and preserves <textPath> curve
    const curvedGroup = container.querySelector('[data-scene-id="curvedText"]') as SVGElement;
    expect(curvedGroup).not.toBeNull();
    await act(async () => {
      dispatchPointer(curvedGroup, 'pointerdown', { clientX: 200, clientY: 140, button: 0 });
    });
    await act(async () => {
      dispatchPointer(curvedGroup, 'pointerup', { clientX: 200, clientY: 140, button: 0 });
    });

    const directBox = container.querySelector('[data-direct-text-editor="true"]');
    expect(directBox).not.toBeNull();
    expect(directBox!.querySelectorAll('button')).toHaveLength(0);

    const curvedTextarea = directBox!.querySelector('textarea') as HTMLTextAreaElement;
    setNativeControlValue(curvedTextarea, 'Grand Celebration Arc');
    await act(async () => {
      curvedTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const svgTextPath = container.querySelector('[data-scene-id="curvedText"] textPath');
    expect(svgTextPath).not.toBeNull();
    expect(svgTextPath!.textContent).toBe('Grand Celebration Arc');
    expect(container.querySelector('[data-testid="curved-href"]')?.textContent).toBe('#curvePath');
  });

  it('does not trigger Maximum update depth exceeded when clicking and typing rapidly inside full EditorPage (normal storage)', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <rect id="bgRect" x="0" y="0" width="600" height="800" fill="#FFFFFF" />
        <text id="headline" x="300" y="240" font-family="DM Sans" font-size="32" text-anchor="middle" fill="#111111">Initial Title</text>
        <text id="subtitle" x="300" y="340" font-family="DM Sans" font-size="20" text-anchor="middle" fill="#444444">October 18</text>
      </svg>
    `;
    const template = makeTemplate(svg, 'Full Editor Typing');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<EditorPage template={template} onClearDesign={noop} />);
    });

    const svgEl = container.querySelector('svg[role="img"]') as SVGSVGElement;
    const textGroup = container.querySelector('[data-scene-id="headline"]') as SVGElement;
    expect(svgEl).not.toBeNull();
    expect(textGroup).not.toBeNull();

    vi.spyOn(svgEl, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 600,
      height: 800,
      right: 600,
      bottom: 800,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(textGroup, 'getBoundingClientRect').mockReturnValue({
      x: 200,
      y: 210,
      left: 200,
      top: 210,
      width: 200,
      height: 40,
      right: 400,
      bottom: 250,
      toJSON: () => ({}),
    } as DOMRect);

    // Click text directly on canvas to open live editor
    await act(async () => {
      dispatchPointer(textGroup, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup, 'pointerup', { clientX: 250, clientY: 225, button: 0 });
    });

    const textarea = container.querySelector('[data-direct-text-editor="true"] textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    textarea.focus();

    // Type multiple characters rapidly (within debounce window)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockClear();

    for (const next of ['A', 'Al', 'Ali', 'Alin', 'Alina']) {
      setNativeControlValue(textarea, next);
      await act(async () => {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // Autosave is still debounced by 400ms (must not flush synchronously per keystroke)
    expect(setItemSpy).not.toHaveBeenCalled();

    // Advance past 400ms debounce so autosave writes once cleanly
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    // Blur and switch layer
    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[data-direct-text-editor="true"]')).toBeNull();
    expect(textGroup.textContent).toContain('Alina');

    const errorMessages = consoleErrorSpy.mock.calls.map((c) => c.map(String).join(' '));
    expect(errorMessages.some((m) => m.includes('Maximum update depth exceeded'))).toBe(false);

    setItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('does not enter an infinite useEffect loop when localStorage.setItem throws QuotaExceededError during live typing in EditorPage', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <text id="headline" x="300" y="240" font-family="DM Sans" font-size="32" fill="#111111">Start Text</text>
      </svg>
    `;
    const template = makeTemplate(svg, 'Quota Failure Check');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<EditorPage template={template} onClearDesign={noop} />);
    });

    // Simulate localStorage becoming full (QuotaExceededError on subsequent writes)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    const svgEl = container.querySelector('svg[role="img"]') as SVGSVGElement;
    const textGroup = container.querySelector('[data-scene-id="headline"]') as SVGElement;
    vi.spyOn(svgEl, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 600,
      height: 800,
      right: 600,
      bottom: 800,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(textGroup, 'getBoundingClientRect').mockReturnValue({
      x: 200,
      y: 210,
      left: 200,
      top: 210,
      width: 200,
      height: 40,
      right: 400,
      bottom: 250,
      toJSON: () => ({}),
    } as DOMRect);

    await act(async () => {
      dispatchPointer(textGroup, 'pointerdown', { clientX: 250, clientY: 225, button: 0 });
    });
    await act(async () => {
      dispatchPointer(textGroup, 'pointerup', { clientX: 250, clientY: 225, button: 0 });
    });

    const textarea = container.querySelector('[data-direct-text-editor="true"] textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    textarea.focus();

    for (const next of ['Updated', 'Updated 1', 'Updated 123']) {
      setNativeControlValue(textarea, next);
      await act(async () => {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Clearing text to empty string should also not unmount/remount or loop
    setNativeControlValue(textarea, '');
    await act(async () => {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(setItemSpy).toHaveBeenCalledTimes(2);
    const errorMessages = consoleErrorSpy.mock.calls.map((c) => c.map(String).join(' '));
    expect(errorMessages.some((m) => m.includes('Maximum update depth exceeded'))).toBe(false);

    setItemSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
