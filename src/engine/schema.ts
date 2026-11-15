import { SceneFontScanSummary } from './fonts';
import { SvgSceneDocument } from './svgScene';

export type TextAnchor = 'start' | 'middle' | 'end';

export interface UploadedSvgSourceInfo {
  fileName: string;
  fileType: 'svg';
  fileSizeBytes: number;
  textCount: number;
  shapeCount: number;
  groupCount: number;
  imageCount: number;
  warnings: string[];
  fontSummary?: SceneFontScanSummary;
}

export interface LoadedTemplateV1 {
  id: string;
  name: string;
  designVersion: string;
  exportFilename: string;
  originalScene: SvgSceneDocument;
  sourceInfo: UploadedSvgSourceInfo;
}

export interface SvgEditorDocumentStateV1 {
  designVersion: string;
  scene: SvgSceneDocument;
  transparentBackground: boolean;
}
