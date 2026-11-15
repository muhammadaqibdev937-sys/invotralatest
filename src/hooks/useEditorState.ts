import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../engine/schema';
import {
  applyBackgroundConfig,
  applyTextEditToNode,
  BackgroundConfig,
  collectAllNodes,
  collectTextNodesWithAncestors,
  createImageNode,
  createNewTextNode,
  deleteNodesInTree,
  duplicateNodesInTree,
  extractBackgroundConfig,
  extractSceneColorSwatches,
  findNodeWithAncestors,
  getTextNodeProperties,
  groupNodesInTree,
  hasBackgroundShapeNode,
  instantiateClipboardNodes,
  moveNodeRelativeInTree,
  recolorNodesMatchingHex,
  reorderNodeInTree,
  replaceImageNodeSource,
  setNodeStyleProp,
  SvgSceneDocument,
  SvgSceneNode,
  SvgTransformState,
  TextEditPatch,
  ungroupNodeInTree,
  updateNodeInTree,
  updateSceneBackgroundColor,
} from '../engine/svgScene';
import { useHistory } from './useHistory';
import { useLocalStorageSupport } from './useLocalStorage';

export type SaveStatus = 'ready' | 'saved' | 'saving' | 'unavailable';

export function storageKeyForSvgDesign(designId: string): string {
  return `invitation-svg:v1:${designId}`;
}

function cloneScene(scene: SvgSceneDocument): SvgSceneDocument {
  return JSON.parse(JSON.stringify(scene)) as SvgSceneDocument;
}

export function createInitialSvgDocumentState(
  loaded: LoadedTemplateV1
): SvgEditorDocumentStateV1 {
  return {
    designVersion: loaded.designVersion,
    scene: cloneScene(loaded.originalScene),
    transparentBackground: false,
  };
}

function isValidSavedSvgState(
  saved: Partial<SvgEditorDocumentStateV1> | null,
  designVersion: string
): saved is SvgEditorDocumentStateV1 {
  if (!saved || typeof saved !== 'object') return false;
  if (saved.designVersion !== designVersion) return false;
  if (!saved.scene || typeof saved.scene !== 'object') return false;
  if (!Array.isArray(saved.scene.nodes) || typeof saved.scene.viewBox !== 'string') return false;
  return true;
}

export function useEditorState(loaded: LoadedTemplateV1 | null) {
  const { isAvailable, readItem, writeItem, removeItem } = useLocalStorageSupport();
  const {
    state: docState,
    canUndo,
    canRedo,
    commit,
    undo: rawUndo,
    redo: rawRedo,
    resetHistory,
  } = useHistory<SvgEditorDocumentStateV1>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    isAvailable ? 'ready' : 'unavailable'
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  const isDirtyRef = useRef<boolean>(false);
  const pendingWriteRef = useRef<{ key: string; state: SvgEditorDocumentStateV1 } | null>(null);

  const flushPendingSave = useCallback(() => {
    const pending = pendingWriteRef.current;
    if (!pending || !isAvailable) return false;
    const ok = writeItem(pending.key, pending.state);
    if (ok) {
      pendingWriteRef.current = null;
      isDirtyRef.current = false;
      setLastSavedAt(new Date());
      setSaveStatus('saved');
    } else {
      setSaveStatus('unavailable');
    }
    return ok;
  }, [isAvailable, writeItem]);

  useEffect(() => {
    if (!loaded) {
      resetHistory(null);
      isDirtyRef.current = false;
      pendingWriteRef.current = null;
      setRestoredFromDraft(false);
      setLastSavedAt(null);
      return;
    }

    const key = storageKeyForSvgDesign(loaded.id);
    const saved = readItem<Partial<SvgEditorDocumentStateV1>>(key);
    const restored = isValidSavedSvgState(saved, loaded.designVersion);
    const initial = restored ? saved : createInitialSvgDocumentState(loaded);

    isDirtyRef.current = false;
    pendingWriteRef.current = null;
    resetHistory(initial);
    setRestoredFromDraft(restored);
    setLastSavedAt(null);
    setSaveStatus(isAvailable ? (restored ? 'saved' : 'ready') : 'unavailable');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded?.id, loaded?.designVersion]);

  useEffect(() => {
    if (!loaded || !docState) return;
    if (!isAvailable) {
      setSaveStatus('unavailable');
      return;
    }
    if (!isDirtyRef.current) return;

    const key = storageKeyForSvgDesign(loaded.id);
    pendingWriteRef.current = { key, state: docState };
    setSaveStatus('saving');

    const timer = window.setTimeout(() => {
      flushPendingSave();
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [docState, loaded, isAvailable, flushPendingSave]);

  useEffect(() => {
    const handleFlush = () => {
      flushPendingSave();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave();
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('pagehide', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      flushPendingSave();
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushPendingSave]);

  const commitDirty = useCallback(
    (updater: (prev: SvgEditorDocumentStateV1) => SvgEditorDocumentStateV1, coalesceKey = '') => {
      isDirtyRef.current = true;
      commit(updater, coalesceKey);
    },
    [commit]
  );

  const undo = useCallback(() => {
    isDirtyRef.current = true;
    rawUndo();
  }, [rawUndo]);

  const redo = useCallback(() => {
    isDirtyRef.current = true;
    rawRedo();
  }, [rawRedo]);

  const updateNode = useCallback(
    (
      nodeId: string,
      updater: (
        node: SvgSceneNode,
        ancestors: SvgSceneNode[],
        cssRules: Record<string, Record<string, string>>
      ) => SvgSceneNode,
      coalesceKey = ''
    ) => {
      commitDirty((prev) => {
        const nextNodes = updateNodeInTree(prev.scene.nodes, nodeId, (node, ancestors) =>
          updater(node, ancestors, prev.scene.cssRules)
        );
        if (nextNodes === prev.scene.nodes) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            nodes: nextNodes,
          },
        };
      }, coalesceKey);
    },
    [commitDirty]
  );

  const updateTextNode = useCallback(
    (nodeId: string, patch: TextEditPatch, coalesce = false) => {
      commitDirty(
        (prev) => {
          const nextNodes = updateNodeInTree(prev.scene.nodes, nodeId, (node, ancestors) =>
            applyTextEditToNode(node, patch, prev.scene.cssRules, ancestors)
          );
          if (nextNodes === prev.scene.nodes) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              nodes: nextNodes,
            },
          };
        },
        coalesce ? `text:${nodeId}` : ''
      );
    },
    [commitDirty]
  );

  const applyBatchTextUpdates = useCallback(
    (updates: Record<string, TextEditPatch>) => {
      commitDirty((prev) => {
        let nextNodes = prev.scene.nodes;
        for (const [id, patch] of Object.entries(updates)) {
          nextNodes = updateNodeInTree(nextNodes, id, (node, ancestors) =>
            applyTextEditToNode(node, patch, prev.scene.cssRules, ancestors)
          );
        }
        if (nextNodes === prev.scene.nodes) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const addTextNode = useCallback(
    (initialText = 'Your Custom Text'): string | null => {
      if (!docState) return null;
      const newNode = createNewTextNode(docState.scene, initialText);
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes: [...prev.scene.nodes, newNode],
        },
      }));
      return newNode.id;
    },
    [commitDirty, docState]
  );

  const updateNodeTransform = useCallback(
    (nodeId: string, patch: Partial<SvgTransformState>, coalesce = false) => {
      commitDirty(
        (prev) => {
          const nextNodes = updateNodeInTree(prev.scene.nodes, nodeId, (node) => ({
            ...node,
            transform: {
              ...node.transform,
              ...patch,
            },
          }));
          if (nextNodes === prev.scene.nodes) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              nodes: nextNodes,
            },
          };
        },
        coalesce ? `xform:${nodeId}` : ''
      );
    },
    [commitDirty]
  );

  const setNodeFill = useCallback(
    (nodeId: string, fill: string, coalesce = false) => {
      updateNode(
        nodeId,
        (node, _anc, cssRules) => {
          const hasCss = Object.keys(cssRules).length > 0;
          let nextAttrs = setNodeStyleProp(node, 'fill', fill, hasCss);
          if (fill !== 'none') {
            nextAttrs = setNodeStyleProp({ attrs: nextAttrs }, 'fill-opacity', null, hasCss);
          }
          const nextTspans = node.tspans?.map((ts) => {
            if (ts.attrs.fill !== undefined || ts.attrs.class || ts.attrs.style?.includes('fill')) {
              return { ...ts, attrs: setNodeStyleProp({ attrs: ts.attrs }, 'fill', fill, hasCss) };
            }
            return ts;
          });
          return { ...node, attrs: nextAttrs, tspans: nextTspans };
        },
        coalesce ? `fill:${nodeId}` : ''
      );
    },
    [updateNode]
  );

  const setNodeStroke = useCallback(
    (nodeId: string, stroke: string, coalesce = false) => {
      updateNode(
        nodeId,
        (node, _anc, cssRules) => ({
          ...node,
          attrs: setNodeStyleProp(node, 'stroke', stroke, Object.keys(cssRules).length > 0),
        }),
        coalesce ? `stroke:${nodeId}` : ''
      );
    },
    [updateNode]
  );

  const setNodeStrokeWidth = useCallback(
    (nodeId: string, width: number, coalesce = false) => {
      updateNode(
        nodeId,
        (node, _anc, cssRules) => ({
          ...node,
          attrs: setNodeStyleProp(
            node,
            'stroke-width',
            String(Math.max(0, width)),
            Object.keys(cssRules).length > 0
          ),
        }),
        coalesce ? `sw:${nodeId}` : ''
      );
    },
    [updateNode]
  );

  const setNodeOpacity = useCallback(
    (nodeId: string, opacity: number, coalesce = false) => {
      const clamped = Math.min(1, Math.max(0, Math.round(opacity * 100) / 100));
      updateNode(
        nodeId,
        (node, _anc, cssRules) => ({
          ...node,
          attrs: setNodeStyleProp(
            node,
            'opacity',
            clamped === 1 ? null : String(clamped),
            Object.keys(cssRules).length > 0
          ),
        }),
        coalesce ? `op:${nodeId}` : ''
      );
    },
    [updateNode]
  );

  const renameNode = useCallback(
    (nodeId: string, label: string) => {
      const clean = label.trim();
      if (!clean) return;
      updateNode(nodeId, (node) => ({
        ...node,
        label: clean,
        attrs: { ...node.attrs, 'data-label': clean },
      }));
    },
    [updateNode]
  );

  const toggleNodeVisibility = useCallback(
    (nodeId: string) => {
      updateNode(nodeId, (node) => ({ ...node, visible: !node.visible }));
    },
    [updateNode]
  );

  const toggleNodeLock = useCallback(
    (nodeId: string) => {
      updateNode(nodeId, (node) => ({ ...node, locked: !node.locked }));
    },
    [updateNode]
  );

  const duplicateNodes = useCallback(
    (nodeIds: string[]): string[] => {
      if (nodeIds.length === 0 || !docState) return [];
      const res = duplicateNodesInTree(docState.scene.nodes, new Set(nodeIds), 24);
      if (res.createdIds.length === 0) return [];
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes: res.nodes,
        },
      }));
      return res.createdIds;
    },
    [commitDirty, docState]
  );

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      commitDirty((prev) => {
        const nextNodes = deleteNodesInTree(prev.scene.nodes, new Set(nodeIds));
        return {
          ...prev,
          scene: {
            ...prev.scene,
            hasExplicitBackground: hasBackgroundShapeNode(nextNodes),
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const reorderNode = useCallback(
    (nodeId: string, direction: 'forward' | 'backward' | 'front' | 'back') => {
      commitDirty((prev) => {
        const nextNodes = reorderNodeInTree(prev.scene.nodes, nodeId, direction);
        if (nextNodes === prev.scene.nodes) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const groupNodes = useCallback(
    (nodeIds: string[]): string | null => {
      if (nodeIds.length < 2 || !docState) return null;
      const res = groupNodesInTree(docState.scene.nodes, new Set(nodeIds));
      if (!res.groupId) return null;
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes: res.nodes,
        },
      }));
      return res.groupId;
    },
    [commitDirty, docState]
  );

  const ungroupNode = useCallback(
    (groupId: string): string[] => {
      if (!docState) return [];
      const res = ungroupNodeInTree(docState.scene.nodes, groupId);
      if (res.childIds.length === 0) return [];
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes: res.nodes,
        },
      }));
      return res.childIds;
    },
    [commitDirty, docState]
  );

  const recolorSwatchHex = useCallback(
    (fromHex: string, toHex: string) => {
      commitDirty((prev) => {
        const nextNodes = recolorNodesMatchingHex(
          prev.scene.nodes,
          fromHex,
          toHex,
          prev.scene.cssRules
        );
        return {
          ...prev,
          scene: {
            ...prev.scene,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const applyCoordinatedPalette = useCallback(
    (combo: {
      background: string;
      accent: string;
      secondaryAccent: string;
      headingText: string;
      bodyText: string;
    }) => {
      commitDirty((prev) => {
        const prevCfg = extractBackgroundConfig(prev.scene);
        let nextScene = applyBackgroundConfig(prev.scene, {
          ...prevCfg,
          mode: 'solid',
          solidColor: combo.background,
        });

        const shapeSwatches = extractSceneColorSwatches(nextScene).filter((sw) =>
          sw.nodeIds.some((nid) => {
            const found = findNodeWithAncestors(nextScene.nodes, nid)?.node;
            return found && found.tag !== 'text';
          })
        );

        let nextNodes = nextScene.nodes;
        if (shapeSwatches[0]) {
          nextNodes = recolorNodesMatchingHex(
            nextNodes,
            shapeSwatches[0].color,
            combo.accent,
            nextScene.cssRules,
            { skipText: true }
          );
        }
        if (shapeSwatches[1] && shapeSwatches[1].color !== shapeSwatches[0]?.color) {
          nextNodes = recolorNodesMatchingHex(
            nextNodes,
            shapeSwatches[1].color,
            combo.secondaryAccent,
            nextScene.cssRules,
            { skipText: true }
          );
        }

        const textEntries = collectTextNodesWithAncestors(nextNodes);
        for (const entry of textEntries) {
          if (entry.node.locked) continue;
          const p = getTextNodeProperties(entry.node, nextScene.cssRules, entry.ancestors);
          const isHeadline = p.fontSize >= 36;
          const textColor = isHeadline ? combo.headingText : combo.bodyText;
          nextNodes = updateNodeInTree(nextNodes, entry.node.id, (n, ancs) =>
            applyTextEditToNode(n, { color: textColor }, nextScene.cssRules, ancs)
          );
        }

        return {
          ...prev,
          transparentBackground: false,
          scene: {
            ...nextScene,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const setBackgroundColor = useCallback(
    (hexColor: string) => {
      commitDirty((prev) => ({
        ...prev,
        transparentBackground: false,
        scene: updateSceneBackgroundColor(prev.scene, hexColor),
      }));
    },
    [commitDirty]
  );

  const applyBackground = useCallback(
    (cfg: BackgroundConfig, coalesce = false) => {
      commitDirty(
        (prev) => ({
          ...prev,
          transparentBackground: false,
          scene: applyBackgroundConfig(prev.scene, cfg),
        }),
        coalesce ? 'bg-cfg' : ''
      );
    },
    [commitDirty]
  );

  const setTransparentBackground = useCallback(
    (transparentBackground: boolean) => {
      commitDirty((prev) => ({
        ...prev,
        transparentBackground,
      }));
    },
    [commitDirty]
  );

  const insertSceneNode = useCallback(
    (newNode: SvgSceneNode, position: 'top' | 'background' = 'top'): string => {
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes:
            position === 'background'
              ? [newNode, ...prev.scene.nodes]
              : [...prev.scene.nodes, newNode],
        },
      }));
      return newNode.id;
    },
    [commitDirty]
  );

  const replaceNodeWithPreset = useCallback(
    (nodeId: string, presetNode: SvgSceneNode) => {
      updateNode(nodeId, (oldNode) => {
        const preservedFill = oldNode.attrs.fill;
        const preservedStroke = oldNode.attrs.stroke;
        const nextAttrs: Record<string, string> = {
          ...presetNode.attrs,
          id: oldNode.attrs.id ?? oldNode.id,
        };
        if (preservedFill && preservedFill !== 'none' && nextAttrs.fill !== 'none') {
          nextAttrs.fill = preservedFill;
        }
        if (preservedStroke && preservedStroke !== 'none' && nextAttrs.stroke !== 'none') {
          nextAttrs.stroke = preservedStroke;
        }
        return {
          ...presetNode,
          id: oldNode.id,
          label: presetNode.label,
          locked: oldNode.locked,
          visible: oldNode.visible,
          attrs: nextAttrs,
          transform: {
            ...presetNode.transform,
            tx: oldNode.transform.tx,
            ty: oldNode.transform.ty,
          },
        };
      });
    },
    [updateNode]
  );

  const replaceImageSource = useCallback(
    (nodeId: string, dataUrl: string) => {
      updateNode(nodeId, (node) => replaceImageNodeSource(node, dataUrl));
    },
    [updateNode]
  );

  const setImageFitMode = useCallback(
    (nodeId: string, preserveAspectRatio: string) => {
      updateNode(nodeId, (node) =>
        node.tag === 'image'
          ? { ...node, attrs: { ...node.attrs, preserveAspectRatio } }
          : node
      );
    },
    [updateNode]
  );

  const setNodeCornerRadius = useCallback(
    (nodeId: string, rx: number, coalesce = false) => {
      const clean = Math.max(0, Math.round(rx));
      updateNode(
        nodeId,
        (node) => {
          if (node.tag !== 'rect') return node;
          const nextAttrs = { ...node.attrs };
          if (clean <= 0) {
            delete nextAttrs.rx;
            delete nextAttrs.ry;
          } else {
            nextAttrs.rx = String(clean);
            nextAttrs.ry = String(clean);
          }
          return { ...node, attrs: nextAttrs };
        },
        coalesce ? `rx:${nodeId}` : ''
      );
    },
    [updateNode]
  );

  const moveLayerRelative = useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after') => {
      commitDirty((prev) => {
        const nextNodes = moveNodeRelativeInTree(prev.scene.nodes, sourceId, targetId, position);
        if (nextNodes === prev.scene.nodes) return prev;
        return {
          ...prev,
          scene: {
            ...prev.scene,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const pasteClipboardNodes = useCallback(
    (clipboard: SvgSceneNode[]): string[] => {
      if (clipboard.length === 0 || !docState) return [];
      const res = instantiateClipboardNodes(clipboard, 28);
      if (res.createdIds.length === 0) return [];
      commitDirty((prev) => ({
        ...prev,
        scene: {
          ...prev.scene,
          nodes: [...prev.scene.nodes, ...res.nodes],
        },
      }));
      return res.createdIds;
    },
    [commitDirty, docState]
  );

  const batchUpdateTransforms = useCallback(
    (updates: Array<{ nodeId: string; patch: Partial<SvgTransformState> }>, coalesce = false) => {
      if (updates.length === 0) return;
      commitDirty(
        (prev) => {
          let nextNodes = prev.scene.nodes;
          for (const u of updates) {
            nextNodes = updateNodeInTree(nextNodes, u.nodeId, (node) =>
              node.locked
                ? node
                : {
                    ...node,
                    transform: {
                      ...node.transform,
                      ...u.patch,
                    },
                  }
            );
          }
          if (nextNodes === prev.scene.nodes) return prev;
          return {
            ...prev,
            scene: {
              ...prev.scene,
              nodes: nextNodes,
            },
          };
        },
        coalesce ? 'batch-xform' : ''
      );
    },
    [commitDirty]
  );

  const setBackgroundImage = useCallback(
    (dataUrl: string) => {
      commitDirty((prev) => {
        const existingBgImage = collectAllNodes(prev.scene.nodes).find(
          (n) => n.isBackground && n.tag === 'image'
        );
        if (existingBgImage) {
          const nextNodes = updateNodeInTree(prev.scene.nodes, existingBgImage.id, (n) => ({
            ...replaceImageNodeSource(n, dataUrl),
            visible: true,
          }));
          return {
            ...prev,
            transparentBackground: false,
            scene: { ...prev.scene, nodes: nextNodes },
          };
        }
        const bgImg = createImageNode(prev.scene, dataUrl, {
          label: 'Background Image',
          fullBleed: true,
        });
        const bgRectIdx = prev.scene.nodes.findIndex((n) => n.isBackground && n.tag !== 'image');
        const nextNodes = [...prev.scene.nodes];
        if (bgRectIdx >= 0) {
          nextNodes.splice(bgRectIdx + 1, 0, bgImg);
        } else {
          nextNodes.unshift(bgImg);
        }
        return {
          ...prev,
          transparentBackground: false,
          scene: { ...prev.scene, nodes: nextNodes },
        };
      });
    },
    [commitDirty]
  );

  const removeBackgroundNode = useCallback(
    (nodeId?: string) => {
      commitDirty((prev) => {
        const allBg = collectAllNodes(prev.scene.nodes).filter((n) => n.isBackground);
        const target = nodeId
          ? allBg.find((n) => n.id === nodeId)
          : allBg.find((n) => n.tag === 'image') ?? allBg[0];
        if (!target) return prev;
        const removeIds = new Set([target.id]);
        const stripNode = (list: SvgSceneNode[]): SvgSceneNode[] =>
          list.flatMap((n) => {
            if (removeIds.has(n.id)) return [];
            if (n.children) return [{ ...n, children: stripNode(n.children) }];
            return [n];
          });
        const nextNodes = stripNode(prev.scene.nodes);
        const stillHasExplicit = hasBackgroundShapeNode(nextNodes);
        return {
          ...prev,
          scene: {
            ...prev.scene,
            hasExplicitBackground: stillHasExplicit,
            nodes: nextNodes,
          },
        };
      });
    },
    [commitDirty]
  );

  const resetToOriginal = useCallback(() => {
    if (!loaded) return;
    isDirtyRef.current = false;
    pendingWriteRef.current = null;
    const fresh = createInitialSvgDocumentState(loaded);
    removeItem(storageKeyForSvgDesign(loaded.id));
    resetHistory(fresh);
    setRestoredFromDraft(false);
    setLastSavedAt(null);
    setSaveStatus(isAvailable ? 'ready' : 'unavailable');
  }, [loaded, removeItem, resetHistory, isAvailable]);

  return {
    docState,
    saveStatus,
    lastSavedAt,
    storageAvailable: isAvailable,
    restoredFromDraft,
    dismissRestoredNotice: useCallback(() => setRestoredFromDraft(false), []),
    canUndo,
    canRedo,
    updateTextNode,
    applyBatchTextUpdates,
    addTextNode,
    updateNodeTransform,
    setNodeFill,
    setNodeStroke,
    setNodeStrokeWidth,
    setNodeOpacity,
    renameNode,
    toggleNodeVisibility,
    toggleNodeLock,
    duplicateNodes,
    deleteNodes,
    reorderNode,
    groupNodes,
    ungroupNode,
    recolorSwatchHex,
    applyCoordinatedPalette,
    setBackgroundColor,
    applyBackground,
    setTransparentBackground,
    insertSceneNode,
    replaceNodeWithPreset,
    replaceImageSource,
    setImageFitMode,
    setNodeCornerRadius,
    moveLayerRelative,
    pasteClipboardNodes,
    batchUpdateTransforms,
    setBackgroundImage,
    removeBackgroundNode,
    undo,
    redo,
    resetToOriginal,
  };
}
