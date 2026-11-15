import React from 'react';
import { Trash2, X } from 'lucide-react';

interface ClearConfirmModalProps {
  isOpen: boolean;
  designName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  designName,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090909]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-modal-title"
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6 space-y-4 bg-[#151515] border-[#292929] text-[#F5F5F5]"
        style={{
          boxShadow: 'var(--ea-shadow-paper)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-[#C0C0C0]" />
            <h2 id="clear-modal-title" className="text-base font-medium">
              Clear Current SVG?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel delete design"
            className="p-1.5 rounded-md cursor-pointer text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-[#999999]">
          This will clear <strong className="text-[#F5F5F5]">{designName}</strong> and remove all
          autosaved browser edits so you can upload another SVG file. Download your customized SVG
          first if needed.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-md border text-xs font-medium cursor-pointer bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0] transition-colors"
          >
            Keep Design
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="h-9 px-4 rounded-md border text-xs font-semibold cursor-pointer bg-[#E5E5E5] hover:bg-[#C0C0C0] border-[#E5E5E5] hover:border-[#C0C0C0] text-[#090909] transition-colors"
          >
            Clear SVG
          </button>
        </div>
      </div>
    </div>
  );
};
