import React from 'react';
import {
  Check,
  Download,
  Eye,
  EyeOff,
  HelpCircle,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { SaveStatus } from '../../hooks/useEditorState';
import { BrandLogo } from './BrandLogo';

interface EditorTopBarProps {
  templateName: string;
  saveStatus: SaveStatus;
  lastSavedAt?: Date | null;
  canUndo: boolean;
  canRedo: boolean;
  isPreviewMode: boolean;
  onTogglePreviewMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onClearDesign?: () => void;
  onOpenHelp: () => void;
  onOpenDownload: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  templateName,
  saveStatus,
  lastSavedAt,
  canUndo,
  canRedo,
  isPreviewMode,
  onTogglePreviewMode,
  onUndo,
  onRedo,
  onReset,
  onClearDesign,
  onOpenHelp,
  onOpenDownload,
}) => {
  const formattedSaveTime = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 border-b flex items-center justify-between gap-3 shrink-0 bg-[#101010] border-[#292929]">
      {/* Left: Studio Mark + Design Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 hidden sm:inline-flex">
          <BrandLogo size="sm" />
        </div>
        <div className="shrink-0 sm:hidden inline-flex">
          <BrandLogo compact size="sm" />
        </div>

        <span className="hidden sm:inline-block w-px h-4 shrink-0 bg-[#292929]" />

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-medium truncate text-[#F5F5F5]">
            {templateName}
          </h1>
        </div>
      </div>

      {/* Center: Quiet device autosave indicator */}
      <div
        className="hidden md:flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 text-[#999999]"
        aria-live="polite"
      >
        {saveStatus === 'saved' && (
          <span className="inline-flex items-center gap-1 text-[#C0C0C0]">
            <Check className="w-3.5 h-3.5" />
            {formattedSaveTime ? `Autosaved · ${formattedSaveTime}` : 'Autosaved on this device'}
          </span>
        )}
        {saveStatus === 'ready' && (
          <span className="text-[#999999]">Autosave enabled on this device</span>
        )}
        {saveStatus === 'saving' && <span className="text-[#E5E5E5]">Autosaving...</span>}
        {saveStatus === 'unavailable' && <span>Browser storage unavailable</span>}
      </div>

      {/* Right: Preview + History + Reset + Clear + Help + Download */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onTogglePreviewMode}
          title={isPreviewMode ? 'Exit preview mode' : 'Preview clean design without handles'}
          aria-label={isPreviewMode ? 'Exit preview mode' : 'Preview design'}
          aria-pressed={isPreviewMode}
          className={`min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            isPreviewMode
              ? 'bg-[#E5E5E5] border-[#E5E5E5] text-[#090909]'
              : 'bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]'
          }`}
        >
          {isPreviewMode ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4 text-[#C0C0C0]" />
          )}
          <span className="hidden xl:inline">{isPreviewMode ? 'Editing' : 'Preview'}</span>
        </button>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]"
        >
          <Undo2 className="w-4 h-4 text-[#C0C0C0]" />
          <span className="hidden xl:inline">Undo</span>
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          className="hidden sm:inline-flex min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border items-center justify-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]"
        >
          <Redo2 className="w-4 h-4 text-[#C0C0C0]" />
          <span className="hidden xl:inline">Redo</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          title="Reset edits to original upload"
          aria-label="Reset edits"
          className="min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]"
        >
          <RotateCcw className="w-4 h-4 text-[#C0C0C0]" />
          <span className="hidden xl:inline">Reset</span>
        </button>

        {onClearDesign && (
          <button
            type="button"
            onClick={onClearDesign}
            title="Clear current design and upload a new SVG"
            aria-label="Clear design"
            className="min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]"
          >
            <Trash2 className="w-4 h-4 text-[#C0C0C0]" />
            <span className="hidden lg:inline">Clear</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenHelp}
          title="Help & Print Guide"
          aria-label="Help"
          className="hidden sm:inline-flex min-w-[40px] h-10 sm:h-9 px-2.5 rounded-md border items-center justify-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap bg-[#151515] border-[#292929] text-[#F5F5F5] hover:bg-[#252525] hover:border-[#C0C0C0]"
        >
          <HelpCircle className="w-4 h-4 text-[#C0C0C0]" />
          <span className="hidden lg:inline">Help</span>
        </button>

        <button
          type="button"
          onClick={onOpenDownload}
          className="h-10 sm:h-9 px-3.5 sm:px-4 rounded-md border border-[#E5E5E5] inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 bg-[#E5E5E5] hover:bg-[#C0C0C0] hover:border-[#C0C0C0] text-[#090909] transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Download SVG</span>
        </button>
      </div>
    </header>
  );
};
