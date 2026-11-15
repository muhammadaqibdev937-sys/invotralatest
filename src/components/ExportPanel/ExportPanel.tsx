import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Loader2,
} from 'lucide-react';
import { LoadedTemplateV1, SvgEditorDocumentStateV1 } from '../../engine/schema';
import { getSceneStats } from '../../engine/svgScene';
import {
  buildEditableSvgString,
  collectEmbeddedFontCssForExport,
  exportEditableSvg,
  sanitizeSvgFilename,
} from '../../services/exportSVG';
import { getUploadedFonts } from '../../services/uploadedFonts';
import { ExportPreviewModal } from './ExportPreviewModal';

interface ExportPanelProps {
  template: LoadedTemplateV1;
  docState: SvgEditorDocumentStateV1;
  onToggleTransparent: (transparent: boolean) => void;
  onOpenHelp: () => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExportPanel: React.FC<ExportPanelProps> = (props) => {
  if (props.isModal) {
    return (
      <ExportPreviewModal
        template={props.template}
        docState={props.docState}
        onToggleTransparent={props.onToggleTransparent}
        onOpenHelp={props.onOpenHelp}
        onCloseModal={() => props.onCloseModal?.()}
      />
    );
  }
  return <ExportSidebarPanel {...props} />;
};

const ExportSidebarPanel: React.FC<ExportPanelProps> = ({
  template,
  docState,
  onToggleTransparent,
  onOpenHelp,
}) => {
  const [filenameDraft, setFilenameDraft] = useState(template.exportFilename || 'Design-Edited');
  const [embedFonts, setEmbedFonts] = useState(true);
  const [embedUploadedFonts, setEmbedUploadedFonts] = useState(false);
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

  const stats = useMemo(() => getSceneStats(docState.scene), [docState.scene]);
  const uploadedFontCount = getUploadedFonts().length;
  const resolvedFilename = useMemo(
    () => sanitizeSvgFilename(filenameDraft, template.exportFilename || 'Design-Edited'),
    [filenameDraft, template.exportFilename]
  );

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
      const embeddedFontCss = await collectEmbeddedFontCssForExport(docState, {
        embedFonts,
        embedUploadedFonts,
      });
      const svgString = buildEditableSvgString(docState, embeddedFontCss);
      await navigator.clipboard.writeText(svgString);
      setCopiedOk(true);
      setStatusMsg('Copied editable SVG markup to clipboard.');
      window.setTimeout(() => setCopiedOk(false), 1800);
    } catch {
      setErrorMsg('Could not copy SVG to clipboard. Use Download Editable SVG instead.');
    } finally {
      setIsCopying(false);
    }
  };

  const content = (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Download Editable SVG</h2>
        <p className="text-xs text-[#52525B] dark:text-[#999999] mt-0.5">
          Exports a clean vector SVG preserving real text, groups, paths, colors &amp; viewBox.
        </p>
      </div>

      {/* Custom Filename */}
      <div className="space-y-1.5">
        <label htmlFor="export-svg-filename" className="block text-xs font-medium text-[#3F3F46] dark:text-[#C0C0C0]">
          File Name
        </label>
        <div className="flex items-center rounded-md border border-[#E4E4E7] bg-white dark:border-[#292929] dark:bg-[#0D0D0D] overflow-hidden focus-within:border-[#3F3F46] dark:focus-within:border-[#C0C0C0]">
          <input
            id="export-svg-filename"
            type="text"
            value={filenameDraft}
            onChange={(e) => setFilenameDraft(e.target.value)}
            placeholder={template.exportFilename || 'Design-Edited'}
            className="flex-1 min-w-0 h-9 px-3 bg-transparent text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
          />
          <span className="px-2.5 h-9 flex items-center text-xs font-mono text-[#71717A] dark:text-[#737373] border-l border-[#E4E4E7] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515]">
            .svg
          </span>
        </div>
      </div>

      {/* SVG Export Options */}
      <div className="p-3.5 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#151515] space-y-3">
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
              checked={docState.transparentBackground}
              onChange={(e) => onToggleTransparent(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer shrink-0"
            />
          </label>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md border text-xs space-y-2 bg-[#FAFAFA] border-[#D4D4D8] text-[#111111] dark:bg-[#151515] dark:border-[#C0C0C0]/40 dark:text-[#E5E5E5]">
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
        <div className="p-3 rounded-md border text-xs flex items-start gap-2 bg-[#FAFAFA] border-[#D4D4D8] text-[#111111] dark:bg-[#151515] dark:border-[#C0C0C0]/50 dark:text-[#E5E5E5]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#111111] dark:text-[#E5E5E5]" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Primary Editable SVG Download & Copy Actions */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={isExporting}
          aria-busy={isExporting}
          onClick={() => void handleExportSvg()}
          className="relative overflow-hidden w-full min-h-[58px] px-3.5 py-2.5 rounded-md border flex items-center gap-3 text-left cursor-pointer disabled:cursor-wait bg-[#18181B] hover:bg-[#3F3F46] disabled:bg-[#52525B] text-white border-[#18181B] hover:border-[#3F3F46] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:disabled:bg-[#D4D4D4] dark:text-[#090909] dark:border-[#E5E5E5] dark:hover:border-[#C0C0C0] transition-colors shadow-sm"
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
                <div className="text-sm font-semibold leading-tight">
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
          className="w-full h-9 px-3 rounded-md border border-[#E4E4E7] bg-white hover:bg-[#E4E4E7] hover:border-[#A1A1AA] text-[#111111] dark:border-[#292929] dark:bg-[#101010] dark:hover:bg-[#252525] dark:hover:border-[#C0C0C0] dark:text-[#E5E5E5] disabled:opacity-40 text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
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

      {/* SVG Document Specs Summary */}
      <dl className="pt-3 border-t border-[#E4E4E7] dark:border-[#292929] space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[#52525B] dark:text-[#999999]">Format</dt>
          <dd className="text-[#111111] dark:text-[#F5F5F5] font-medium">Editable Vector SVG</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[#52525B] dark:text-[#999999]">ViewBox</dt>
          <dd className="tabular-nums font-mono text-[11px] text-[#111111] dark:text-[#F5F5F5]">
            {docState.scene.viewBox}
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

      <div className="p-3 rounded-md border border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] dark:border-[#292929] dark:bg-[#151515] dark:text-[#999999] text-[11px] leading-relaxed">
        Downloaded SVGs keep all editable text, shapes, and layers intact so you can re-open and edit them again anytime in Invotora.
      </div>

      <button
        type="button"
        onClick={onOpenHelp}
        className="text-xs underline cursor-pointer text-[#3F3F46] hover:text-[#111111] dark:text-[#C0C0C0] dark:hover:text-[#F5F5F5] transition-colors"
      >
        Editing &amp; SVG export guide
      </button>
    </div>
  );

  return (
    <aside className="w-72 border-l p-5 overflow-y-auto ea-scrollbar shrink-0 bg-white border-[#E4E4E7] dark:bg-[#101010] dark:border-[#292929]">
      {content}
    </aside>
  );
};
