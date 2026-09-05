import type { PageSelectableTextLine } from './pdfBrowser';

export interface TextReplacementSource {
  id: string;
  sourceRunId?: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  backgroundMode: 'automatic' | 'solid';
  backgroundImage?: string;
  backgroundColor: string;
  saveMode: 'native' | 'visual';
  nativeEligible: boolean;
  nativeUnavailableReason?: string;
  visualEligible: boolean;
  visualUnavailableReason?: string;
  pdfRect?: [number, number, number, number];
  nativeSourceRun?: {
    text: string;
    start: number;
    end: number;
    pdfRect: [number, number, number, number];
  };
  nativePreview?: {
    backgroundImage?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    suffix: string;
  };
}

export interface TextReplacementDraft {
  type: 'text';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize: number;
  color: string;
  fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier';
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  replacementSource: TextReplacementSource;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const selectableTextLineId = (pageIndex: number, line: PageSelectableTextLine) => {
  const signature = [
    pageIndex,
    Math.round(line.left * 100),
    Math.round(line.top * 100),
    Math.round(line.width * 100),
    Math.round(line.height * 100),
    line.text,
  ].join(':');
  return `pdf-text-${pageIndex}-${stableHash(signature)}`;
};

export const selectableTextSourceRunId = (pageIndex: number, line: PageSelectableTextLine) => {
  const sourceRun = line.sourceRun;
  if (!sourceRun) return selectableTextLineId(pageIndex, line);
  const geometry = sourceRun.pdfRect ?? [
    sourceRun.left,
    sourceRun.top,
    sourceRun.left + sourceRun.width,
    sourceRun.top + sourceRun.height,
  ];
  const signature = [
    pageIndex,
    ...geometry.map((value) => Math.round(value * 100)),
    sourceRun.text,
  ].join(':');
  return `pdf-text-run-${pageIndex}-${stableHash(signature)}`;
};

export const getTextReplacementPreviewLine = ({
  line,
  pageWidth,
  pageHeight,
  fontSize,
}: {
  line: PageSelectableTextLine;
  pageWidth: number;
  pageHeight: number;
  fontSize: number;
}): PageSelectableTextLine => {
  const safePageWidth = Math.max(1, pageWidth);
  const safePageHeight = Math.max(1, pageHeight);
  const sourceRun = line.sourceRun;
  const left = clamp(line.left, 0, safePageWidth);
  const sourceTop = sourceRun?.top ?? line.top;
  const sourceHeight = sourceRun?.height ?? line.height;
  const right = clamp(
    sourceRun ? sourceRun.left + sourceRun.width : line.left + line.width,
    left,
    safePageWidth,
  );
  // PDF.js and native PDF engines expose different notions of a glyph box. A small
  // vertical guard band clears ascenders/descenders without creating a visible fill.
  const topPadding = Math.max(1, fontSize * 0.05);
  const bottomPadding = Math.max(1, fontSize * 0.32);
  const top = clamp(sourceTop - topPadding, 0, safePageHeight);
  const bottom = clamp(sourceTop + sourceHeight + bottomPadding, top, safePageHeight);
  return {
    ...line,
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
};

export const replacementTextBoxWidth = ({
  measuredTextWidth,
  pageWidth,
  sourceWidth,
  x,
  horizontalPadding = 12,
}: {
  measuredTextWidth: number;
  pageWidth: number;
  sourceWidth: number;
  x: number;
  horizontalPadding?: number;
}) => {
  const safePageWidth = Math.max(1, pageWidth);
  const measuredWidth = (Math.max(0, measuredTextWidth) + horizontalPadding) / safePageWidth;
  return clamp(Math.max(sourceWidth, measuredWidth), 0.04, Math.max(0.04, 1 - x));
};

export const createTextReplacementDraft = ({
  pageIndex,
  pageWidth,
  pageHeight,
  line,
  backgroundImage,
  nativeCapability,
}: {
  pageIndex: number;
  pageWidth: number;
  pageHeight: number;
  line: PageSelectableTextLine;
  backgroundImage?: string;
  nativeCapability?: {
    supported: boolean;
    reason?: string;
    match?: {
      pdfRect: [number, number, number, number];
      sourceRun: {
        text: string;
        start: number;
        end: number;
        pdfRect: [number, number, number, number];
      };
      appearance?: {
        fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier';
        fontSize: number;
        color: string;
        fontWeight: number;
        fontStyle: 'normal' | 'italic';
      };
    };
  };
}): TextReplacementDraft => {
  const safePageWidth = Math.max(1, pageWidth);
  const safePageHeight = Math.max(1, pageHeight);
  const left = clamp(line.left, 0, safePageWidth);
  const top = clamp(line.top, 0, safePageHeight);
  const right = clamp(line.left + line.width, left, safePageWidth);
  const bottom = clamp(line.top + line.height, top, safePageHeight);
  const x = left / safePageWidth;
  const y = top / safePageHeight;
  const width = (right - left) / safePageWidth;
  const height = (bottom - top) / safePageHeight;
  const appearance = nativeCapability?.supported ? nativeCapability.match?.appearance : undefined;
  const sourceFontSize = appearance?.fontSize ?? line.height;
  const fontSize = Number.isFinite(sourceFontSize) && sourceFontSize > 0 ? sourceFontSize : 1;
  const previewLine = getTextReplacementPreviewLine({
    line,
    pageWidth: safePageWidth,
    pageHeight: safePageHeight,
    fontSize,
  });
  const replacementSource: TextReplacementSource = {
    id: selectableTextLineId(pageIndex, line),
    sourceRunId: selectableTextSourceRunId(pageIndex, line),
    text: line.text,
    x,
    y,
    width,
    height,
    pageWidth: safePageWidth,
    backgroundMode: 'automatic',
    backgroundImage,
    backgroundColor: '#ffffff',
    saveMode: nativeCapability?.supported ? 'native' : 'visual',
    nativeEligible: Boolean(nativeCapability?.supported),
    nativeUnavailableReason: nativeCapability?.supported ? undefined : nativeCapability?.reason,
    visualEligible: Boolean(nativeCapability?.match && line.sourceRun?.isHorizontal && backgroundImage),
    visualUnavailableReason: !nativeCapability?.match
      ? 'Visual fallback is unavailable because exact word boundaries could not be verified.'
      : !line.sourceRun?.isHorizontal
        ? 'Visual fallback is unavailable for rotated, skewed, or mirrored source text.'
        : !backgroundImage
          ? 'Visual fallback is unavailable because this page cannot be reconstructed safely.'
          : undefined,
    pdfRect: nativeCapability?.match?.pdfRect ?? line.pdfRect,
    nativeSourceRun: nativeCapability?.match?.sourceRun,
    // This run-level preview is also used by Visual fallback. Clearing and redrawing the
    // unedited suffix prevents a longer replacement from sitting on top of the original line.
    nativePreview: (() => {
      const sourceRun = line.sourceRun;
      if (!sourceRun) {
        return {
          backgroundImage,
          x: previewLine.left / safePageWidth,
          y: previewLine.top / safePageHeight,
          width: previewLine.width / safePageWidth,
          height: previewLine.height / safePageHeight,
          suffix: '',
        };
      }
      return {
        backgroundImage,
        x: previewLine.left / safePageWidth,
        y: previewLine.top / safePageHeight,
        width: previewLine.width / safePageWidth,
        height: previewLine.height / safePageHeight,
        suffix: sourceRun.text.slice(sourceRun.end),
      };
    })(),
  };

  return {
    type: 'text',
    pageIndex,
    x,
    y,
    width,
    height,
    content: line.text,
    fontSize,
    color: appearance?.color ?? '#000000',
    fontFamily: appearance?.fontFamily ?? 'Helvetica',
    fontWeight: appearance?.fontWeight,
    fontStyle: appearance?.fontStyle,
    replacementSource,
  };
};
