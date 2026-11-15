import React from 'react';
import { RotateCcw, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  templateName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  templateName,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090909]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div
        className="w-full max-w-sm rounded-xl border p-6 space-y-4 bg-[#151515] border-[#292929] text-[#F5F5F5]"
        style={{
          boxShadow: 'var(--ea-shadow-paper)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-[#C0C0C0]" />
            <h2 id="reset-modal-title" className="text-base font-medium">
              Reset SVG Design?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel reset"
            className="p-1.5 rounded-md cursor-pointer text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-[#999999]">
          This will restore <strong className="text-[#F5F5F5]">{templateName}</strong> back to the
          exact original uploaded SVG (text, shapes, colors, layers, and transforms), clearing your
          saved browser draft.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-md border text-xs font-medium cursor-pointer bg-[#0D0D0D] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0] transition-colors"
          >
            Keep My Edits
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="h-9 px-4 rounded-md border text-xs font-semibold cursor-pointer bg-[#E5E5E5] hover:bg-[#C0C0C0] border-[#E5E5E5] hover:border-[#C0C0C0] text-[#090909] transition-colors"
          >
            Reset to Original SVG
          </button>
        </div>
      </div>
    </div>
  );
};
