import {
  collectAllNodes,
  scanSceneFontUsage,
  serializeSceneToSvg,
  SvgSceneDocument,
} from './svgScene';

export interface SceneDiagnosticsSnapshot {
  activeLayerCount: number;
  totalLayerCount: number;
  hiddenLayerCount: number;
  textLayerCount: number;
  shapeLayerCount: number;
  groupLayerCount: number;
  imageLayerCount: number;
  fontCount: number;
  missingFontCount: number;
  bundledFontCount: number;
  sceneBytes: number;
  svgBytes: number;
}

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function measureUtf8Bytes(input: string): number {
  if (textEncoder) {
    return textEncoder.encode(input).length;
  }
  return input.length;
}

export function formatMemoryBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface SceneLayerCounts {
  activeLayerCount: number;
  totalLayerCount: number;
  hiddenLayerCount: number;
  textLayerCount: number;
  shapeLayerCount: number;
  groupLayerCount: number;
  imageLayerCount: number;
}

export function computeSceneLayerCounts(scene: SvgSceneDocument): SceneLayerCounts {
  const allNodes = collectAllNodes(scene.nodes);
  let activeLayerCount = 0;
  let textLayerCount = 0;
  let shapeLayerCount = 0;
  let groupLayerCount = 0;
  let imageLayerCount = 0;

  for (const node of allNodes) {
    if (node.visible) {
      activeLayerCount++;
      if (node.tag === 'text') textLayerCount++;
      else if (node.tag === 'g') groupLayerCount++;
      else if (node.tag === 'image') imageLayerCount++;
      else shapeLayerCount++;
    }
  }

  return {
    activeLayerCount,
    totalLayerCount: allNodes.length,
    hiddenLayerCount: allNodes.length - activeLayerCount,
    textLayerCount,
    shapeLayerCount,
    groupLayerCount,
    imageLayerCount,
  };
}

export function computeSceneStructureMetrics(scene: SvgSceneDocument): Omit<
  SceneDiagnosticsSnapshot,
  'sceneBytes' | 'svgBytes'
> {
  const layerCounts = computeSceneLayerCounts(scene);
  const fontSummary = scanSceneFontUsage(scene);

  return {
    ...layerCounts,
    fontCount: fontSummary.entries.length,
    missingFontCount: fontSummary.missingCount,
    bundledFontCount: fontSummary.bundledCount,
  };
}

export function computeSceneMemoryFootprint(
  scene: SvgSceneDocument,
  transparentBackground = false
): { sceneBytes: number; svgBytes: number } {
  const sceneJson = JSON.stringify(scene);
  const svgMarkup = serializeSceneToSvg(scene, {
    backgroundColor: scene.backgroundColor,
    transparentBackground,
  });
  return {
    sceneBytes: measureUtf8Bytes(sceneJson),
    svgBytes: measureUtf8Bytes(svgMarkup),
  };
}

export function computeSceneDiagnostics(
  scene: SvgSceneDocument,
  transparentBackground = false
): SceneDiagnosticsSnapshot {
  return {
    ...computeSceneStructureMetrics(scene),
    ...computeSceneMemoryFootprint(scene, transparentBackground),
  };
}
