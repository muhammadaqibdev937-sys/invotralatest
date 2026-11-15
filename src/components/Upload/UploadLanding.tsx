import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  HelpCircle,
  Layers,
  Loader2,
  Palette,
  RefreshCw,
  ShieldCheck,
  Type,
  Upload,
} from 'lucide-react';
import { LoadedTemplateV1 } from '../../engine/schema';
import {
  DesignImportError,
  importSvgDesignFile,
  MAX_DESIGN_FILE_BYTES,
} from '../../services/designImporter';
import { SvgSceneContent } from '../Canvas/SvgSceneRenderer';
import { HelpModal } from '../HelpModal/HelpModal';
import { BrandLogo } from '../Toolbar/BrandLogo';

interface UploadLandingProps {
  onOpenInEditor: (template: LoadedTemplateV1) => void;
}

const ACCEPTED_EXTENSIONS = '.svg,image/svg+xml';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const UploadLanding: React.FC<UploadLandingProps> = ({ onOpenInEditor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; stage: string }>({
    percent: 0,
    stage: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<LoadedTemplateV1 | null>(null);

  const handleImportFile = useCallback(async (file: File) => {
    setErrorMsg(null);
    setIsImporting(true);
    setProgress({ percent: 8, stage: 'Validating SVG file...' });

    try {
      const loaded = await importSvgDesignFile(file, {
        onProgress: (percent, stage) => setProgress({ percent, stage }),
      });
      setPreviewTemplate(loaded);
    } catch (err) {
      if (err instanceof DesignImportError) {
        setErrorMsg(err.message);
      } else {
        console.error('SVG import failed:', err);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not open this SVG file. Please confirm it is a valid SVG XML document.'
        );
      }
    } finally {
      setIsImporting(false);
      setProgress({ percent: 0, stage: '' });
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void handleImportFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isImporting) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleImportFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isImporting) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleResetSelection = () => {
    setPreviewTemplate(null);
    setErrorMsg(null);
  };

  useEffect(() => {
    const preventWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventWindowDrop);
    window.addEventListener('drop', preventWindowDrop);
    return () => {
      window.removeEventListener('dragover', preventWindowDrop);
      window.removeEventListener('drop', preventWindowDrop);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#090909] text-[#F5F5F5]">
      <header className="h-16 px-4 sm:px-8 border-b border-[#292929] bg-[#101010] flex items-center justify-between gap-4 shrink-0">
        <BrandLogo size="md" />

        <div className="flex items-center gap-3">
          {previewTemplate && (
            <button
              type="button"
              onClick={handleResetSelection}
              disabled={isImporting}
              className="h-9 px-3 rounded-md border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] inline-flex items-center gap-1.5 text-xs font-medium text-[#E5E5E5] cursor-pointer disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#C0C0C0]" />
              <span>Upload Different SVG</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="h-9 px-3 rounded-md border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] inline-flex items-center gap-1.5 text-xs font-medium text-[#F5F5F5] cursor-pointer transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-[#C0C0C0]" />
            <span>How It Works</span>
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload SVG file"
      />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12">
        {!previewTemplate ? (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#999999]">
                Etsy Editable SVG Vector Studio
              </p>
              <h1
                className="text-3xl sm:text-5xl font-medium tracking-tight text-[#F5F5F5]"
                style={{ fontFamily: '"Cormorant Garamond", serif' }}
              >
                Upload Your SVG Design
              </h1>
              <p className="text-sm text-[#999999] max-w-lg mx-auto leading-relaxed">
                Open the editable <strong className="text-[#E5E5E5] font-medium">.SVG</strong> file
                from your Etsy purchase to customize real text layers, Google Fonts, shapes, colors,
                and layout right inside your browser.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-4 rounded-lg border border-[#C0C0C0]/45 bg-[#151515] flex items-start justify-between gap-3 text-xs text-[#E5E5E5]"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E5E5E5]" />
                  <div className="space-y-1">
                    <p className="font-medium text-[#F5F5F5]">Invalid or unsupported file</p>
                    <p className="text-[#C0C0C0] leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-[#999999] hover:text-[#F5F5F5] underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div
              role="button"
              tabIndex={0}
              aria-label="Drag and drop your SVG file or press Enter to browse"
              onClick={() => !isImporting && fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isImporting) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`rounded-xl border border-dashed p-8 sm:p-12 text-center transition-colors cursor-pointer focus:outline-none focus:border-[#E5E5E5] ${
                isDragging
                  ? 'bg-[#1D1D1D] border-[#E5E5E5]'
                  : 'bg-[#101010] border-[#292929] hover:bg-[#151515] hover:border-[#C0C0C0]'
              }`}
              style={{ boxShadow: 'var(--ea-shadow-paper)' }}
            >
              {isImporting ? (
                <div className="max-w-sm mx-auto space-y-4 py-4">
                  <div className="w-12 h-12 mx-auto rounded-lg border border-[#292929] bg-[#151515] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#E5E5E5]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#F5F5F5]">
                      {progress.stage || 'Parsing SVG elements...'}
                    </p>
                    <p className="text-xs tabular-nums text-[#999999]">{progress.percent}%</p>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="SVG upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress.percent}
                    className="w-full h-1.5 rounded-full bg-[#252525] overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-[#E5E5E5] transition-all duration-200 ease-out"
                      style={{ width: `${Math.max(8, progress.percent)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="w-14 h-14 mx-auto rounded-xl border border-[#292929] bg-[#151515] flex items-center justify-center">
                    <Upload className="w-6 h-6 text-[#E5E5E5]" />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-base font-medium text-[#F5F5F5]">
                      {isDragging ? 'Drop your .svg file here' : 'Drag & drop your SVG file'}
                    </p>
                    <p className="text-xs text-[#999999]">
                      Editable <strong className="text-[#C0C0C0] font-medium">.SVG</strong> files only &nbsp;&middot;&nbsp; Up to{' '}
                      {Math.round(MAX_DESIGN_FILE_BYTES / (1024 * 1024))} MB
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="h-11 px-6 rounded-md border border-[#E5E5E5] bg-[#E5E5E5] hover:bg-[#C0C0C0] hover:border-[#C0C0C0] text-[#090909] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>Browse SVG File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-4 rounded-lg border border-[#292929] bg-[#101010] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#F5F5F5]">
                  <Type className="w-4 h-4 text-[#C0C0C0] shrink-0" />
                  <span>Real Editable Text</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#999999]">
                  Detects SVG text and multi-line tspans directly without flattening or outlining.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-[#292929] bg-[#101010] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#F5F5F5]">
                  <Layers className="w-4 h-4 text-[#C0C0C0] shrink-0" />
                  <span>Full Vector Layers</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#999999]">
                  Select, move, resize, rotate, group, reorder, lock, or duplicate every shape and path.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-[#292929] bg-[#101010] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-[#F5F5F5]">
                  <Palette className="w-4 h-4 text-[#C0C0C0] shrink-0" />
                  <span>Clean SVG Export</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#999999]">
                  Downloads an editable vector SVG preserving all fonts, colors, groups, and viewBox.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#737373]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#999999] shrink-0" />
              <span>
                Processed locally in your browser · Files are validated and never uploaded externally
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-7 rounded-xl border border-[#292929] bg-[#101010] p-5 sm:p-8 flex flex-col items-center justify-center min-h-[360px] sm:min-h-[500px]">
              <div className="w-full flex items-center justify-center" style={{ maxHeight: '560px' }}>
                <svg
                  viewBox={previewTemplate.originalScene.viewBox}
                  preserveAspectRatio={previewTemplate.originalScene.preserveAspectRatio || 'xMidYMid meet'}
                  className="max-h-[520px] w-auto h-auto max-w-full rounded-[2px]"
                  style={{
                    aspectRatio: `${previewTemplate.originalScene.vbW} / ${previewTemplate.originalScene.vbH}`,
                    backgroundColor: previewTemplate.originalScene.backgroundColor,
                    boxShadow: 'var(--ea-shadow-paper)',
                  }}
                  role="img"
                  aria-label={`SVG preview of ${previewTemplate.name}`}
                >
                  <SvgSceneContent scene={previewTemplate.originalScene} />
                </svg>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-[#292929] bg-[#101010] p-6 space-y-5">
              <div className="space-y-1.5 border-b border-[#292929] pb-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#999999]">
                  Ready to Customize
                </p>
                <h2
                  className="text-2xl font-medium text-[#F5F5F5] break-words"
                  style={{ fontFamily: '"Cormorant Garamond", serif' }}
                >
                  {previewTemplate.name}
                </h2>
                <p className="text-xs text-[#999999] tabular-nums">
                  SVG &middot; {formatBytes(previewTemplate.sourceInfo.fileSizeBytes)} &middot;{' '}
                  {previewTemplate.originalScene.vbW} &times; {previewTemplate.originalScene.vbH}
                </p>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#999999]">Source File</dt>
                  <dd className="text-[#F5F5F5] truncate max-w-[220px]">
                    {previewTemplate.sourceInfo.fileName}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#999999]">Editable Text Elements</dt>
                  <dd className="text-[#F5F5F5] tabular-nums">
                    {previewTemplate.sourceInfo.textCount}{' '}
                    {previewTemplate.sourceInfo.textCount === 1 ? 'element' : 'elements'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#999999]">Vector Shapes &amp; Paths</dt>
                  <dd className="text-[#F5F5F5] tabular-nums">
                    {previewTemplate.sourceInfo.shapeCount}{' '}
                    {previewTemplate.sourceInfo.shapeCount === 1 ? 'element' : 'elements'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#999999]">Groups (&lt;g&gt;)</dt>
                  <dd className="text-[#F5F5F5] tabular-nums">
                    {previewTemplate.sourceInfo.groupCount}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#999999]">ViewBox</dt>
                  <dd className="text-[#F5F5F5] font-mono text-[11px] tabular-nums">
                    {previewTemplate.originalScene.viewBox}
                  </dd>
                </div>
              </dl>

              {previewTemplate.sourceInfo.warnings.length > 0 && (
                <div className="p-3.5 rounded-lg border border-[#292929] bg-[#151515] space-y-1 text-[11px] text-[#999999]">
                  {previewTemplate.sourceInfo.warnings.slice(0, 3).map((warn, idx) => (
                    <p key={idx}>• {warn}</p>
                  ))}
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenInEditor(previewTemplate)}
                  className="w-full h-11 px-5 rounded-md border border-[#E5E5E5] bg-[#E5E5E5] hover:bg-[#C0C0C0] hover:border-[#C0C0C0] text-[#090909] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Open in SVG Editor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResetSelection}
                  className="w-full h-10 px-4 rounded-md border border-[#292929] bg-[#151515] hover:bg-[#252525] hover:border-[#C0C0C0] text-[#E5E5E5] text-xs font-medium cursor-pointer transition-colors"
                >
                  Choose Another SVG
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};
