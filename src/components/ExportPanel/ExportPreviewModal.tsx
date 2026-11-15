import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../../engine/schema';
import { getSceneStats } from '../../engine/svgScene';
import {
  analyzeExportParity,
  buildEditableSvgString,
  collectEmbeddedFontCssForExport,
  exportEditableSvg,
  sanitizeSvgFilename,
} from '../../services/exportSVG';
import { getUploadedFonts } from '../../services/uploadedFonts';
import { SvgSceneContent, svgAttrsToReactProps } from '../Canvas/SvgSceneRenderer';

interface ExportPreviewModalProps {
  template: LoadedTemplateV1;
  docState: SvgEditorDocumentStateV1;
  onToggleTransparent: (transparent: boolean) => void;
  onOpenHelp: () => void;
  onCloseModal: () => void;
}

type PreviewSourceMode = 'export' | 'canvas';
type ZoomMode = 'fit' | number;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  template,
  docState,
  onToggleTransparent,
  onOpenHelp,
  onCloseModal,
}) => {
  const { scene, transparentBackground } = docState;
  const stageRef = useRef<HTMLDivElement>(null);

  const [filenameDraft, setFilenameDraft] = useState(template.exportFilename || 'Design-Edited');
  const [embedFonts, setEmbedFonts] = useState(true);
  const [embedUploadedFonts, setEmbedUploadedFonts] = useState(false);
  const [previewSource, setPreviewSource] = useState<PreviewSourceMode>('export');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit');
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 680,
    height: 540,
  });

  const [exportSvgString, setExportSvgString] = useState<string>('');
  const [exportByteSize, setExportByteSize] = useState<number | null>(null);
  const [exportBlobUrl, setExportBlobUrl] = useState<string | null>(null);
  const [blobStatus, setBlobStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isBuildingPreview, setIsBuildingPreview] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copiedOk, setCopiedOk] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    percent: number;
    stage: string;
  }>({ percent: 0, stage: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setFilenameDraft(template.exportFilename || 'Design-Edited');
  }, [template.id, template.exportFilename]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseModal();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCloseModal]);

  // Track stage container size for responsive Fit zoom calculation
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the exact final export SVG string & isolated blob URL preview
  useEffect(() => {
    let cancelled = false;
    let activeBlobUrl: string | null = null;
    setIsBuildingPreview(true);
    setBlobStatus('loading');

    const buildPreview = async () => {
      try {
        const embeddedFontCss = await collectEmbeddedFontCssForExport(docState, {
          embedFonts,
          embedUploadedFonts,
        });
        if (cancelled) return;
        const svgString = buildEditableSvgString(docState, embeddedFontCss);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        setExportSvgString(svgString);
        setExportByteSize(blob.size);

        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          activeBlobUrl = URL.createObjectURL(blob);
          setExportBlobUrl(activeBlobUrl);
        } else {
          setExportBlobUrl(null);
          setBlobStatus('error');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[ExportPreviewModal] Could not generate SVG preview blob:', err);
          setExportBlobUrl(null);
          setBlobStatus('error');
        }
      } finally {
        if (!cancelled) {
          setIsBuildingPreview(false);
        }
      }
    };

    void buildPreview();

    return () => {
      cancelled = true;
      if (activeBlobUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(activeBlobUrl);
      }
    };
  }, [docState, embedFonts, embedUploadedFonts]);

  const stats = useMemo(() => getSceneStats(scene), [scene]);
  const uploadedFontCount = getUploadedFonts().length;
  const resolvedFilename = useMemo(
    () => sanitizeSvgFilename(filenameDraft, template.exportFilename || 'Design-Edited'),
    [filenameDraft, template.exportFilename]
  );
  const parityReport = useMemo(
    () => analyzeExportParity(docState, { embedFonts, embedUploadedFonts }),
    [docState, embedFonts, embedUploadedFonts]
  );

  const vbW = Math.max(1, scene.vbW);
  const vbH = Math.max(1, scene.vbH);

  const fitScale = useMemo(() => {
    const padX = stageSize.width < 500 ? 28 : 56;
    const padY = stageSize.height < 400 ? 28 : 56;
    const availW = Math.max(160, stageSize.width - padX);
    const availH = Math.max(160, stageSize.height - padY);
    return Math.min(availW / vbW, availH / vbH, 2.5);
  }, [stageSize.width, stageSize.height, vbW, vbH]);

  const effectiveScale = zoomMode === 'fit' ? fitScale : zoomMode;
  const displayWidth = Math.max(80, Math.round(vbW * effectiveScale));
  const displayHeight = Math.max(80, Math.round(vbH * effectiveScale));
  const zoomPercent = Math.round(effectiveScale * 100);

  const rootSvgProps = useMemo(() => {
    const parsed = svgAttrsToReactProps(scene.rootAttrs);
    const mergedClass = [parsed.className, 'block w-full h-full overflow-visible']
      .filter(Boolean)
      .join(' ');
    const { className: _ignoredCls, ...rest } = parsed;
    return { ...rest, className: mergedClass };
  }, [scene.rootAttrs]);

  const stepZoom = (delta: number) => {
    const base = zoomMode === 'fit' ? fitScale : zoomMode;
    const next = Math.min(4, Math.max(0.25, Math.round((base + delta) * 4) / 4));
    setZoomMode(next);
  };

  const handleExportSvg = async () => {
    setIsExporting(true);
    setExportProgress({ percent: 10, stage: 'Preparing editable SVG...' });
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const res = await exportEditableSvg(template, docState, {
        embedFonts,
        embedUploadedFonts,
        filename: filenameDraft,
        onProgress: (percent, stage) => setExportProgress({ percent, stage }),
      });
      setStatusMsg(
        `Downloaded ${res.filename} (${formatBytes(res.byteSize)} · Editable SVG vector preserving text, shapes & layers).`
      );
    } catch (err) {
      console.error('SVG export failed:', err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not generate the SVG file. Please try again.'
      );
    } finally {
      setIsExporting(false);
      setExportProgress({ percent: 0, stage: '' });
    }
  };

  const handleCopySvg = async () => {
    if (!navigator.clipboard?.writeText) {
      setErrorMsg('Clipboard access is unavailable in this browser.');
      return;
    }
    setIsCopying(true);
    setErrorMsg(null);
    try {
      let svgToCopy = exportSvgString;
      if (!svgToCopy) {
        const embeddedFontCss = await collectEmbeddedFontCssForExport(docState, {
          embedFonts,
          embedUploadedFonts,
        });
        svgToCopy = buildEditableSvgString(docState, embeddedFontCss);
      }
      await navigator.clipboard.writeText(svgToCopy);
      setCopiedOk(true);
      setStatusMsg('Copied editable SVG markup to clipboard.');
      window.setTimeout(() => setCopiedOk(false), 1800);
    } catch {
      setErrorMsg('Could not copy SVG to clipboard. Use Download Editable SVG instead.');
    } finally {
      setIsCopying(false);
    }
  };

  const showExportImg =
    previewSource === 'export' && Boolean(exportBlobUrl) && blobStatus === 'loaded';

  return (
    <div
      onClick={onCloseModal}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6 bg-black/55 dark:bg-[#090909]/85 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="High-resolution SVG preview"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-6xl h-[94vh] sm:h-[88vh] rounded-t-xl sm:rounded-lg border border-[#E4E4E7] bg-white text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:text-[#F5F5F5] flex flex-col overflow-hidden"
        style={{ boxShadow: 'var(--ea-shadow-paper)' }}
      >
        {/* Top Modal Header */}
        <header className="px-4 sm:px-6 py-3.5 border-b border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-medium text-[#111111] dark:text-[#F5F5F5] truncate">
              Pre-Download High-Resolution Preview
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#52525B] dark:text-[#999999] mt-0.5 tabular-nums">
              <span className="truncate max-w-[220px] text-[#3F3F46] dark:text-[#C0C0C0]">{scene.title}</span>
              <span aria-hidden="true">·</span>
              <span>
                {Math.round(vbW)} × {Math.round(vbH)}
              </span>
              {exportByteSize !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatBytes(exportByteSize)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{zoomPercent}% zoom</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseModal}
            aria-label="Close high-resolution preview"
            className="w-9 h-9 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-[#52525B] hover:text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Main 2-Column Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: High-Resolution Proof Viewport */}
          <div className="flex-1 min-w-0 min-h-[300px] flex flex-col bg-[#ECECEE] dark:bg-[#090909] border-b lg:border-b-0 lg:border-r border-[#E4E4E7] dark:border-[#292929]">
            {/* Proofing Toolbar */}
            <div className="px-3 sm:px-4 py-2 border-b border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] flex flex-wrap items-center justify-between gap-2 shrink-0">
              {/* Output vs Canvas Toggle */}
              <div
                role="tablist"
                aria-label="Preview render source"
                className="inline-flex rounded-md border border-[#E4E4E7] bg-[#F4F4F5] dark:border-[#292929] dark:bg-[#151515] p-0.5 shrink-0"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewSource === 'export'}
                  onClick={() => setPreviewSource('export')}
                  className={`h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    previewSource === 'export'
                      ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                      : 'text-[#52525B] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  Export Output
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewSource === 'canvas'}
                  onClick={() => setPreviewSource('canvas')}
                  className={`h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    previewSource === 'canvas'
                      ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                      : 'text-[#52525B] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5]'
                  }`}
                >
                  Editor Canvas
                </button>
              </div>

              {/* High-Resolution Zoom Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="inline-flex items-center rounded-md border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => stepZoom(-0.5)}
                    title="Zoom out"
                    aria-label="Zoom out preview"
                    className="w-8 h-8 flex items-center justify-center text-[#52525B] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5] cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomMode('fit')}
                    className={`h-8 px-2.5 border-l border-[#E4E4E7] dark:border-[#292929] text-xs font-medium whitespace-nowrap inline-flex items-center gap-1 cursor-pointer ${
                      zoomMode === 'fit'
                        ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                        : 'text-[#52525B] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                    }`}
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fit</span>
                  </button>

                  {([1, 2, 3] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoomMode(z)}
                      className={`h-8 px-2.5 border-l border-[#E4E4E7] dark:border-[#292929] text-xs font-medium tabular-nums whitespace-nowrap cursor-pointer ${
                        zoomMode === z
                          ? 'bg-[#18181B] text-white dark:bg-[#E5E5E5] dark:text-[#090909]'
                          : 'text-[#52525B] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5]'
                      }`}
                    >
                      {z * 100}%
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => stepZoom(0.5)}
                    title="Zoom in"
                    aria-label="Zoom in preview"
                    className="w-8 h-8 border-l border-[#E4E4E7] dark:border-[#292929] flex items-center justify-center text-[#52525B] hover:bg-[#E4E4E7] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:bg-[#252525] dark:hover:text-[#F5F5F5] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable High-Resolution Canvas Area */}
            <div
              ref={stageRef}
              className="relative flex-1 min-h-0 overflow-auto ea-scrollbar flex p-4 sm:p-6 bg-[#ECECEE] dark:bg-[#090909]"
            >
              <div
                className={`relative shrink-0 m-auto ${
                  transparentBackground || scene.hasExplicitBackground ? 'ea-checkerboard' : ''
                }`}
                style={{
                  width: `${displayWidth}px`,
                  height: `${displayHeight}px`,
                  boxShadow: 'var(--ea-shadow-paper)',
                  backgroundColor:
                    transparentBackground || scene.hasExplicitBackground
                      ? undefined
                      : scene.backgroundColor,
                }}
              >
                {/* Keep hidden blob image loader mounted in Export Output mode to verify real serialized SVG */}
                {exportBlobUrl && (
                  <img
                    src={exportBlobUrl}
                    alt={`${scene.title} exported SVG preview`}
                    onLoad={() => setBlobStatus('loaded')}
                    onError={() => setBlobStatus('error')}
                    className={
                      showExportImg
                        ? 'block w-full h-full object-contain select-none'
                        : 'sr-only'
                    }
                  />
                )}

                {/* Live Canvas SVG (shown in Editor Canvas mode, or as seamless parity render before blob image settles / in headless DOM) */}
                {!showExportImg && (
                  <svg
                    {...rootSvgProps}
                    viewBox={scene.viewBox}
                    width="100%"
                    height="100%"
                    preserveAspectRatio={scene.preserveAspectRatio || 'xMidYMid meet'}
                    role="img"
                    aria-label={`${scene.title} high-resolution SVG preview`}
                  >
                    <SvgSceneContent
                      scene={scene}
                      transparentBackground={transparentBackground}
                    />
                  </svg>
                )}

                {isBuildingPreview && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded border border-[#E4E4E7] bg-white/95 text-[#3F3F46] dark:border-[#292929] dark:bg-[#151515]/90 dark:text-[#C0C0C0] text-[11px] inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Preparing proof...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Parity Verification Bar */}
            <div className="px-4 py-2 border-t border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] flex items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-start gap-2 min-w-0">
                {parityReport.isFullParity ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5] shrink-0 mt-0.5" />
                    <span className="text-[#3F3F46] dark:text-[#C0C0C0] leading-snug">
                      Final SVG output matches the editor canvas.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5] shrink-0 mt-0.5" />
                    <span className="text-[#3F3F46] dark:text-[#C0C0C0] leading-snug">
                      {parityReport.notes[0]}
                    </span>
                  </>
                )}
              </div>
              <span className="hidden sm:inline text-[11px] font-mono tabular-nums text-[#71717A] dark:text-[#737373] shrink-0">
                {displayWidth} × {displayHeight}px
              </span>
            </div>
          </div>

          {/* Right Column: Export Configuration & Download CTA */}
          <aside className="w-full lg:w-[340px] shrink-0 overflow-y-auto ea-scrollbar p-4 sm:p-5 space-y-4 bg-[#FAFAFA] dark:bg-[#151515]">
            {/* Custom Filename */}
            <div className="space-y-1.5">
              <label
                htmlFor="export-preview-filename"
                className="block text-xs font-medium text-[#3F3F46] dark:text-[#C0C0C0]"
              >
                File Name
              </label>
              <div className="flex items-center rounded-md border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] overflow-hidden focus-within:border-[#3F3F46] dark:focus-within:border-[#C0C0C0]">
                <input
                  id="export-preview-filename"
                  type="text"
                  value={filenameDraft}
                  onChange={(e) => setFilenameDraft(e.target.value)}
                  placeholder={template.exportFilename || 'Design-Edited'}
                  className="flex-1 min-w-0 h-9 px-3 bg-transparent text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                />
                <span className="px-2.5 h-9 flex items-center text-xs font-mono text-[#71717A] dark:text-[#737373] border-l border-[#E4E4E7] dark:border-[#292929] bg-[#F4F4F5] dark:bg-[#101010]">
                  .svg
                </span>
              </div>
            </div>

            {/* SVG Export Options */}
            <div className="p-3.5 rounded-lg border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#101010] space-y-3">
              <label className="flex items-start justify-between gap-3 cursor-pointer">
                <div>
                  <span className="block text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                    Embed Google Fonts
                  </span>
                  <span className="block text-[11px] text-[#52525B] dark:text-[#999999] mt-0.5">
                    Includes @font-face styles so bundled typography renders consistently everywhere.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={embedFonts}
                  onChange={(e) => setEmbedFonts(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer shrink-0"
                />
              </label>

              <div className="border-t border-[#E4E4E7] dark:border-[#292929] pt-3">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="block text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                      Embed uploaded fonts in export
                      {uploadedFontCount > 0 ? ` (${uploadedFontCount} loaded)` : ''}
                    </span>
                    <span className="block text-[11px] text-[#52525B] dark:text-[#999999] mt-0.5">
                      Off by default. Only enable if your font license permits embedding font data in distributed files.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={embedUploadedFonts}
                    onChange={(e) => setEmbedUploadedFonts(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer shrink-0"
                  />
                </label>
              </div>

              <div className="border-t border-[#E4E4E7] dark:border-[#292929] pt-3">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="block text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                      Transparent Background
                    </span>
                    <span className="block text-[11px] text-[#52525B] dark:text-[#999999] mt-0.5">
                      Omits canvas backdrop rect on export.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(e) => onToggleTransparent(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-md border text-xs space-y-2 bg-white border-[#D4D4D8] text-[#111111] dark:bg-[#101010] dark:border-[#C0C0C0]/40 dark:text-[#E5E5E5]">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#3F3F46] dark:text-[#C0C0C0]" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="underline font-medium cursor-pointer text-[#3F3F46] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {statusMsg && (
              <div className="p-3 rounded-md border text-xs flex items-start gap-2 bg-white border-[#D4D4D8] text-[#111111] dark:bg-[#101010] dark:border-[#C0C0C0]/50 dark:text-[#E5E5E5]">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#111111] dark:text-[#E5E5E5]" />
                <span>{statusMsg}</span>
              </div>
            )}

            {/* Primary Download & Copy Actions */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={isExporting}
                aria-busy={isExporting}
                onClick={() => void handleExportSvg()}
                className="relative overflow-hidden w-full min-h-[54px] px-3.5 py-2.5 rounded-md border flex items-center gap-3 text-left cursor-pointer disabled:cursor-wait bg-[#18181B] hover:bg-[#3F3F46] disabled:bg-[#52525B] text-white border-[#18181B] hover:border-[#3F3F46] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:disabled:bg-[#D4D4D4] dark:text-[#090909] dark:border-[#E5E5E5] dark:hover:border-[#C0C0C0] transition-colors shadow-sm"
              >
                {isExporting ? (
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white dark:text-[#090909]" />
                        <span className="text-xs font-semibold truncate text-white dark:text-[#090909]">
                          {exportProgress.stage || 'Preparing SVG...'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0 text-white/80 dark:text-[#252525]">
                        {exportProgress.percent}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="SVG export progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={exportProgress.percent}
                      className="w-full h-1.5 rounded-full bg-white/25 dark:bg-[#090909]/20 overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full bg-white dark:bg-[#090909] transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(8, exportProgress.percent)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <FileCode2 className="w-4 h-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight whitespace-nowrap">
                        Download Editable SVG
                      </div>
                      <div className="text-[11px] opacity-75 leading-tight mt-0.5 truncate">
                        {resolvedFilename}
                      </div>
                    </div>
                    <Download className="w-4 h-4 shrink-0 opacity-80" />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isCopying || isExporting}
                onClick={() => void handleCopySvg()}
                className="w-full h-9 px-3 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#E5E5E5] disabled:opacity-40 text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                {copiedOk ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#111111] dark:text-[#E5E5E5]" />
                    <span>Copied SVG Code</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#52525B] dark:text-[#C0C0C0]" />
                    <span>{isCopying ? 'Copying SVG...' : 'Copy SVG Code'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Document Specs */}
            <dl className="pt-3 border-t border-[#E4E4E7] dark:border-[#292929] space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">Format</dt>
                <dd className="text-[#111111] dark:text-[#F5F5F5] font-medium">Editable Vector SVG</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">ViewBox</dt>
                <dd className="tabular-nums font-mono text-[11px] text-[#111111] dark:text-[#F5F5F5]">
                  {scene.viewBox}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">Estimated Size</dt>
                <dd className="tabular-nums text-[#111111] dark:text-[#F5F5F5]">
                  {exportByteSize !== null ? formatBytes(exportByteSize) : 'Calculating...'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">Text Layers</dt>
                <dd className="tabular-nums text-[#111111] dark:text-[#F5F5F5]">{stats.textCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">Vector Shapes &amp; Paths</dt>
                <dd className="tabular-nums text-[#111111] dark:text-[#F5F5F5]">{stats.shapeCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#52525B] dark:text-[#999999]">Groups (&lt;g&gt;)</dt>
                <dd className="tabular-nums text-[#111111] dark:text-[#F5F5F5]">{stats.groupCount}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={onOpenHelp}
              className="text-xs underline cursor-pointer text-[#3F3F46] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] transition-colors"
            >
              Editing &amp; SVG export guide
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};
