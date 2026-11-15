import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HardDrive, Layers, Type } from 'lucide-react';
import {
  computeSceneLayerCounts,
  computeSceneMemoryFootprint,
  formatMemoryBytes,
} from '../../engine/sceneDiagnostics';
import { scanSceneFontUsage, SvgSceneDocument } from '../../engine/svgScene';

interface EditorDiagnosticFooterProps {
  scene: SvgSceneDocument;
  transparentBackground: boolean;
  selectedCount: number;
  fontRegistryVersion?: number;
}

function readFontStats(scene: SvgSceneDocument): { fontCount: number; missingFontCount: number } {
  const summary = scanSceneFontUsage(scene);
  return {
    fontCount: summary.entries.length,
    missingFontCount: summary.missingCount,
  };
}

export const EditorDiagnosticFooter: React.FC<EditorDiagnosticFooterProps> = ({
  scene,
  transparentBackground,
  selectedCount,
  fontRegistryVersion = 0,
}) => {
  const layerCounts = useMemo(() => computeSceneLayerCounts(scene), [scene]);

  const [fontStats, setFontStats] = useState<{ fontCount: number; missingFontCount: number }>(() =>
    readFontStats(scene)
  );
  const [memoryFootprint, setMemoryFootprint] = useState<{
    sceneBytes: number;
    svgBytes: number;
  }>(() => computeSceneMemoryFootprint(scene, transparentBackground));

  const lastSceneKeyRef = useRef<string>(`${scene.title}:${fontRegistryVersion}`);

  useEffect(() => {
    const nextKey = `${scene.title}:${fontRegistryVersion}`;
    // Recompute immediately when switching templates or font registry, else debounce 350ms during rapid typing/drags
    if (lastSceneKeyRef.current !== nextKey) {
      lastSceneKeyRef.current = nextKey;
      setFontStats(readFontStats(scene));
      setMemoryFootprint(computeSceneMemoryFootprint(scene, transparentBackground));
      return;
    }

    const timer = window.setTimeout(() => {
      setFontStats(readFontStats(scene));
      setMemoryFootprint(computeSceneMemoryFootprint(scene, transparentBackground));
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [scene, transparentBackground, fontRegistryVersion]);

  return (
    <footer
      aria-label="SVG scene diagnostic dashboard"
      className="px-3 sm:px-6 py-1.5 lg:h-9 border-t border-[#E4E4E7] dark:border-[#292929] bg-white dark:bg-[#101010] text-[#52525B] dark:text-[#999999] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] shrink-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
        {/* Active Layers */}
        <div
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          title={`${layerCounts.textLayerCount} text · ${layerCounts.shapeLayerCount} shapes · ${layerCounts.groupLayerCount} groups · ${layerCounts.imageLayerCount} images`}
        >
          <Layers className="w-3.5 h-3.5 text-[#3F3F46] dark:text-[#C0C0C0] shrink-0" aria-hidden="true" />
          <span>Active Layers</span>
          <span
            data-testid="diag-active-layers"
            className="font-mono tabular-nums font-semibold text-[#111111] dark:text-[#F5F5F5]"
          >
            {layerCounts.activeLayerCount}
          </span>
          {layerCounts.hiddenLayerCount > 0 && (
            <span className="font-mono tabular-nums text-[#71717A] dark:text-[#737373]">
              / {layerCounts.totalLayerCount}
            </span>
          )}
        </div>

        <span className="hidden sm:inline-block w-px h-3.5 bg-[#E4E4E7] dark:bg-[#292929]" aria-hidden="true" />

        {/* Font Count */}
        <div
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          title={
            fontStats.missingFontCount > 0
              ? `${fontStats.fontCount} fonts detected (${fontStats.missingFontCount} using preview fallback)`
              : `${fontStats.fontCount} distinct font families in scene`
          }
        >
          <Type className="w-3.5 h-3.5 text-[#3F3F46] dark:text-[#C0C0C0] shrink-0" aria-hidden="true" />
          <span>Fonts</span>
          <span
            data-testid="diag-font-count"
            className="font-mono tabular-nums font-semibold text-[#111111] dark:text-[#F5F5F5]"
          >
            {fontStats.fontCount}
          </span>
          {fontStats.missingFontCount > 0 && (
            <span className="text-[#71717A] dark:text-[#737373]">
              · {fontStats.missingFontCount} fallback
            </span>
          )}
        </div>

        <span className="hidden sm:inline-block w-px h-3.5 bg-[#E4E4E7] dark:bg-[#292929]" aria-hidden="true" />

        {/* Real-time SVG Scene Memory Footprint */}
        <div
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          title={`Scene graph state: ${formatMemoryBytes(memoryFootprint.sceneBytes)} · Serialized SVG XML: ${formatMemoryBytes(memoryFootprint.svgBytes)}`}
        >
          <HardDrive className="w-3.5 h-3.5 text-[#3F3F46] dark:text-[#C0C0C0] shrink-0" aria-hidden="true" />
          <span>SVG Memory</span>
          <span
            data-testid="diag-memory-footprint"
            className="font-mono tabular-nums font-semibold text-[#111111] dark:text-[#F5F5F5]"
          >
            {formatMemoryBytes(memoryFootprint.sceneBytes)}
          </span>
          <span className="hidden md:inline font-mono tabular-nums text-[#71717A] dark:text-[#737373]">
            (SVG {formatMemoryBytes(memoryFootprint.svgBytes)})
          </span>
        </div>
      </div>

      {/* Right side: Viewport / Selection info */}
      <div className="hidden sm:flex items-center gap-3 whitespace-nowrap shrink-0 text-[#71717A] dark:text-[#737373]">
        {selectedCount > 0 && (
          <>
            <span className="font-mono tabular-nums text-[#52525B] dark:text-[#999999]">
              {selectedCount} selected
            </span>
            <span className="w-px h-3.5 bg-[#E4E4E7] dark:bg-[#292929]" aria-hidden="true" />
          </>
        )}
        <span className="font-mono tabular-nums">
          {Math.round(scene.vbW)} × {Math.round(scene.vbH)}
        </span>
      </div>
    </footer>
  );
};
