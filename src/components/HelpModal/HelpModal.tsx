import React from 'react';
import { X } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    number: '1',
    title: 'Upload your Etsy .SVG design',
    body: 'Drag and drop or browse for the editable .SVG file from your Etsy purchase. Invotora validates and parses real SVG layers directly inside your browser.',
  },
  {
    number: '2',
    title: 'Customize text, backgrounds, shapes & images',
    body: 'Double-click any text right on the canvas to edit it in place, or click any element to adjust fonts, size, text case, flip, rotate, layer order, and styling in the right-hand Properties Inspector. Right-click elements for quick actions.',
  },
  {
    number: '3',
    title: 'Align, group, preview & undo anytime',
    body: 'Hold Shift to multi-select (or press Ctrl+A) for canvas alignment, distribution, or grouping. Toggle Preview mode to inspect your clean layout without handles, or use Undo, Redo, and Reset anytime.',
  },
  {
    number: '4',
    title: 'Download your editable SVG',
    body: 'Export your finished design as an editable .SVG file preserving real text, gradients, embedded images, groups, and dimensions—ready for printing, cutting machines, or re-editing anytime.',
  },
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#090909]/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-lg border overflow-hidden max-h-[90vh] flex flex-col bg-[#151515] border-[#292929] text-[#F5F5F5]"
        style={{ boxShadow: 'var(--ea-shadow-paper)' }}
      >
        <div className="px-6 py-4 border-b border-[#292929] flex items-center justify-between">
          <span
            className="text-lg font-medium text-[#F5F5F5]"
            style={{ fontFamily: '"Cormorant Garamond", serif' }}
          >
            How to Upload, Edit &amp; Export SVG
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help modal"
            className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto ea-scrollbar">
          <h2
            id="help-modal-title"
            className="text-2xl font-medium tracking-tight text-[#F5F5F5]"
            style={{ fontFamily: '"Cormorant Garamond", serif' }}
          >
            Four Simple Steps
          </h2>

          <ol className="space-y-4">
            {STEPS.map((step) => (
              <li key={step.number} className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 tabular-nums bg-[#252525] border-[#C0C0C0]/50 text-[#E5E5E5]">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-sm font-medium text-[#F5F5F5]">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed mt-1 text-[#999999]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="p-4 rounded-md border text-xs space-y-1 bg-[#0D0D0D] border-[#292929] text-[#999999]">
            <p className="font-medium text-[#F5F5F5]">
              Private Browser-Only SVG Editing
            </p>
            <p className="leading-relaxed">
              Your SVG files and edits stay strictly inside your browser on this device with automatic
              local autosave. Use <strong className="text-[#E5E5E5]">Delete</strong> anytime to clear
              the current design and upload a new SVG.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
