import { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { UploadLanding } from './components/Upload/UploadLanding';
import { LoadedTemplateV1 } from './engine/schema';
import { storageKeyForSvgDesign } from './hooks/useEditorState';
import { useTheme } from './hooks/useTheme';
import { EditorPage } from './pages/EditorPage';

const SESSION_DESIGN_KEY = 'invitora:active-svg-design:v1';
const MAX_SESSION_CACHE_CHARS = 3_800_000;

function readSessionDesign(): LoadedTemplateV1 | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_DESIGN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoadedTemplateV1;
    if (
      parsed &&
      parsed.id &&
      parsed.designVersion &&
      parsed.originalScene &&
      Array.isArray(parsed.originalScene.nodes)
    ) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors cleanly
  }
  return null;
}

function writeSessionDesign(template: LoadedTemplateV1): void {
  try {
    const serialized = JSON.stringify(template);
    if (serialized.length <= MAX_SESSION_CACHE_CHARS) {
      window.sessionStorage.setItem(SESSION_DESIGN_KEY, serialized);
    } else {
      window.sessionStorage.removeItem(SESSION_DESIGN_KEY);
    }
  } catch {
    // Quota exceeded or disabled — in-memory editor state continues seamlessly
  }
}

function clearSessionDesign(designId?: string): void {
  try {
    window.sessionStorage.removeItem(SESSION_DESIGN_KEY);
  } catch {
    // Ignore
  }
  if (designId) {
    try {
      window.localStorage.removeItem(storageKeyForSvgDesign(designId));
    } catch {
      // Ignore
    }
  }
}

export default function App() {
  useTheme();
  const [activeTemplate, setActiveTemplate] = useState<LoadedTemplateV1 | null>(() =>
    readSessionDesign()
  );

  const handleOpenInEditor = useCallback((template: LoadedTemplateV1) => {
    writeSessionDesign(template);
    setActiveTemplate(template);
  }, []);

  const handleClearDesign = useCallback((designId: string) => {
    clearSessionDesign(designId);
    setActiveTemplate(null);
  }, []);

  const workspace = activeTemplate ? (
    <EditorPage template={activeTemplate} onClearDesign={handleClearDesign} />
  ) : (
    <UploadLanding onOpenInEditor={handleOpenInEditor} />
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={workspace} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
