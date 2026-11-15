import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileType, Trash2, Upload, X } from 'lucide-react';
import { SceneFontScanSummary } from '../../engine/fonts';
import { usePersistedUploadedFonts } from '../../hooks/usePersistedUploadedFonts';
import {
  deriveFontFamilyName,
  MAX_UPLOAD_FONT_BYTES,
  uploadFontFile,
} from '../../services/uploadedFonts';

interface FontUploadModalProps {
  isOpen: boolean;
  fontSummary: SceneFontScanSummary;
  selectedTextNodeId: string | null;
  selectedTextNodeLabel?: string;
  initialMissingFont?: string;
  onClose: () => void;
  onApplyUploadedFont: (nodeIds: string[], family: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const FontUploadModal: React.FC<FontUploadModalProps> = ({
  isOpen,
  fontSummary,
  selectedTextNodeId,
  selectedTextNodeLabel,
  initialMissingFont,
  onClose,
  onApplyUploadedFont,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const missingEntries = useMemo(
    () => fontSummary.entries.filter((e) => e.isMissing),
    [fontSummary]
  );

  const [targetMode, setTargetMode] = useState<'missing' | 'selected' | 'none'>('missing');
  const [targetMissingFont, setTargetMissingFont] = useState<string>('');
  const [familyDraft, setFamilyDraft] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const {
    uploadedFonts: savedFonts,
    storageSupported,
    removeFont,
    clearAllFonts,
  } = usePersistedUploadedFonts({ hydrateOnMount: false });

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setFamilyDraft('');

    if (missingEntries.length > 0) {
      setTargetMode('missing');
      const preferred =
        initialMissingFont &&
        missingEntries.find(
          (e) => e.originalFamily.toLowerCase() === initialMissingFont.toLowerCase()
        );
      setTargetMissingFont(preferred ? preferred.originalFamily : missingEntries[0].originalFamily);
    } else if (selectedTextNodeId) {
      setTargetMode('selected');
      setTargetMissingFont('');
    } else {
      setTargetMode('none');
      setTargetMissingFont('');
    }
  }, [isOpen, initialMissingFont, missingEntries, selectedTextNodeId]);

  if (!isOpen) return null;

  const resolveTargetNodeIds = (): string[] => {
    if (targetMode === 'missing') {
      const entry = missingEntries.find(
        (e) => e.originalFamily.toLowerCase() === targetMissingFont.toLowerCase()
      );
      if (entry) return entry.affectedNodeIds;
      return missingEntries.flatMap((e) => e.affectedNodeIds);
    }
    if (targetMode === 'selected' && selectedTextNodeId) {
      return [selectedTextNodeId];
    }
    return [];
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(true);

    try {
      const chosenFamily = familyDraft.trim() || deriveFontFamilyName(file.name);
      const record = await uploadFontFile(file, {
        familyName: chosenFamily,
      });

      const targetIds = resolveTargetNodeIds();
      onApplyUploadedFont(targetIds, record.family);

      const appliedCount = targetIds.length;
      const savedSuffix = storageSupported ? ' and saved in this browser' : ' for this session';
      setSuccessMsg(
        appliedCount > 0
          ? `Loaded "${record.family}"${savedSuffix} and applied it to ${appliedCount} ${
              appliedCount === 1 ? 'layer' : 'layers'
            }.`
          : `Loaded "${record.family}"${savedSuffix}.`
      );
      window.setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not upload font file. Only valid .ttf, .otf, and .woff2 files up to 10 MB are accepted.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyExisting = (family: string) => {
    const targetIds = resolveTargetNodeIds();
    onApplyUploadedFont(targetIds, family);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-[#090909]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Upload Font"
    >
      <div
        className="w-full sm:max-w-md rounded-t-xl sm:rounded-lg border p-5 sm:p-6 max-h-[90vh] overflow-y-auto ea-scrollbar bg-white border-[#E4E4E7] text-[#111111] dark:bg-[#151515] dark:border-[#292929] dark:text-[#F5F5F5] space-y-4"
        style={{ boxShadow: 'var(--ea-shadow-paper)' }}
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E4E4E7] dark:border-[#292929]">
          <div className="flex items-center gap-2">
            <FileType className="w-4 h-4 text-[#52525B] dark:text-[#C0C0C0] shrink-0" />
            <div>
              <h2 className="text-base font-medium text-[#111111] dark:text-[#F5F5F5]">Upload Custom Font</h2>
              <p className="text-xs text-[#52525B] dark:text-[#999999] mt-0.5">
                Only upload fonts you are licensed to use.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close font upload dialog"
            className="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer text-[#52525B] hover:text-[#111111] hover:bg-[#E4E4E7] dark:text-[#999999] dark:hover:text-[#F5F5F5] dark:hover:bg-[#252525] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Layers */}
        <div className="space-y-2 p-3 rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010] text-xs">
          <span className="block text-[11px] font-medium text-[#3F3F46] dark:text-[#C0C0C0]">Apply Uploaded Font To</span>
          {missingEntries.length > 0 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="upload-font-target"
                checked={targetMode === 'missing'}
                onChange={() => setTargetMode('missing')}
                className="mt-0.5 accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <span className="text-[#111111] dark:text-[#F5F5F5]">Layers using missing font</span>
                {targetMode === 'missing' && (
                  <select
                    aria-label="Missing font to replace"
                    value={targetMissingFont}
                    onChange={(e) => setTargetMissingFont(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-[#E4E4E7] bg-white text-xs text-[#111111] dark:border-[#292929] dark:bg-[#0D0D0D] dark:text-[#F5F5F5]"
                  >
                    {missingEntries.map((entry) => (
                      <option key={entry.originalFamily} value={entry.originalFamily}>
                        {entry.originalFamily} ({entry.affectedNodeIds.length}{' '}
                        {entry.affectedNodeIds.length === 1 ? 'layer' : 'layers'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>
          )}

          {selectedTextNodeId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="upload-font-target"
                checked={targetMode === 'selected'}
                onChange={() => setTargetMode('selected')}
                className="accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
              />
              <span className="text-[#111111] dark:text-[#E5E5E5] truncate">
                Selected layer{selectedTextNodeLabel ? `: ${selectedTextNodeLabel}` : ''}
              </span>
            </label>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="upload-font-target"
              checked={targetMode === 'none'}
              onChange={() => setTargetMode('none')}
              className="accent-[#18181B] dark:accent-[#E5E5E5] cursor-pointer"
            />
            <span className="text-[#3F3F46] dark:text-[#C0C0C0]">Save to custom font list only (apply manually later)</span>
          </label>
        </div>

        {/* Optional Custom Family Name */}
        <div className="space-y-1">
          <label htmlFor="upload-font-family-name" className="block text-[11px] font-medium text-[#3F3F46] dark:text-[#C0C0C0]">
            Font Family Name (optional — defaults to file name)
          </label>
          <input
            id="upload-font-family-name"
            type="text"
            value={familyDraft}
            onChange={(e) => setFamilyDraft(e.target.value)}
            placeholder={
              targetMode === 'missing' && targetMissingFont
                ? `e.g. ${targetMissingFont} or auto from filename`
                : 'Auto-detected from file name'
            }
            className="w-full h-9 px-3 rounded-md border border-[#E4E4E7] bg-white text-xs text-[#111111] placeholder:text-[#71717A] focus:outline-none focus:border-[#3F3F46] dark:border-[#292929] dark:bg-[#0D0D0D] dark:text-[#F5F5F5] dark:placeholder:text-[#737373] dark:focus:border-[#C0C0C0]"
          />
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            void handleFile(f);
          }}
          className={`p-5 rounded-lg border border-dashed text-center space-y-2.5 transition-colors ${
            isDragging
              ? 'border-[#18181B] bg-[#E4E4E7] dark:border-[#E5E5E5] dark:bg-[#252525]'
              : 'border-[#D4D4D8] bg-[#FAFAFA] hover:border-[#71717A] dark:border-[#292929] dark:bg-[#101010] dark:hover:border-[#C0C0C0]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void handleFile(f);
            }}
          />
          <Upload className="w-5 h-5 mx-auto text-[#52525B] dark:text-[#C0C0C0]" />
          <div className="space-y-1">
            <p className="text-xs text-[#111111] dark:text-[#E5E5E5] font-medium">
              Drop a font file here or browse from your device
            </p>
            <p className="text-[11px] text-[#71717A] dark:text-[#737373]">
              Accepted: .ttf, .otf, .woff2 · Max {Math.round(MAX_UPLOAD_FONT_BYTES / (1024 * 1024))} MB ·{' '}
              {storageSupported ? 'Saved across sessions' : 'Session-only'}
            </p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-4 rounded-md border border-[#18181B] bg-[#18181B] hover:bg-[#3F3F46] text-white dark:border-[#E5E5E5] dark:bg-[#E5E5E5] dark:hover:bg-[#C0C0C0] dark:text-[#090909] disabled:opacity-50 text-xs font-semibold cursor-pointer transition-colors"
          >
            {isUploading ? 'Loading Font...' : 'Choose Font File'}
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-md border border-[#D4D4D8] bg-[#FAFAFA] text-[#111111] dark:border-[#C0C0C0]/45 dark:bg-[#101010] dark:text-[#E5E5E5] text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#111111] dark:text-[#E5E5E5]" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="p-3 rounded-md border border-[#D4D4D8] bg-[#FAFAFA] text-[#111111] dark:border-[#C0C0C0]/60 dark:bg-[#101010] dark:text-[#F5F5F5] text-xs flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#111111] dark:text-[#E5E5E5]" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {savedFonts.length > 0 && (
          <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#292929] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="block text-[11px] font-medium text-[#52525B] dark:text-[#999999]">
                Saved Custom Fonts ({savedFonts.length})
              </span>
              {savedFonts.length > 1 && (
                <button
                  type="button"
                  onClick={() => void clearAllFonts()}
                  className="text-[11px] text-[#52525B] hover:text-[#111111] dark:text-[#999999] dark:hover:text-[#F5F5F5] underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto ea-scrollbar">
              {savedFonts.map((rec) => (
                <div
                  key={rec.id}
                  className="px-2.5 py-2 rounded border border-[#E4E4E7] bg-[#FAFAFA] dark:border-[#292929] dark:bg-[#101010] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[#111111] dark:text-[#F5F5F5] truncate">{rec.family}</div>
                    <div className="text-[10px] text-[#71717A] dark:text-[#737373] truncate">
                      {rec.extension} · {formatSize(rec.byteSize)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {resolveTargetNodeIds().length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleApplyExisting(rec.family)}
                        className="h-7 px-2.5 rounded border border-[#E4E4E7] bg-white hover:bg-[#E4E4E7] text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#E5E5E5] text-[11px] font-medium cursor-pointer"
                      >
                        Apply
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeFont(rec.family)}
                      title={`Remove saved font ${rec.family}`}
                      aria-label={`Remove ${rec.family}`}
                      className="w-7 h-7 rounded border border-[#E4E4E7] bg-white hover:bg-[#E4E4E7] text-[#52525B] hover:text-[#111111] dark:border-[#292929] dark:bg-[#151515] dark:hover:bg-[#252525] dark:text-[#999999] dark:hover:text-[#F5F5F5] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[#71717A] dark:text-[#737373] leading-relaxed">
          {storageSupported
            ? 'Uploaded fonts are saved in this browser across sessions and are not embedded in exported SVGs unless you enable that option in Download SVG.'
            : 'Uploaded fonts remain active for this browser session and are not embedded in exported SVGs unless you enable that option in Download SVG.'}
        </p>
      </div>
    </div>
  );
};
