
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import {
  getPageSelectableTextLines,
  getPageTextBackgroundPatch,
  getPdfFormFields,
  loadPDFDocument,
  pdfSpaceRectToViewportRect,
  type PageSelectableTextLine,
  type PdfFormFieldDefinition,
  type PdfFormFieldValue,
} from '../../services/pdfBrowser';
import { savePDFWithAnnotations, type EditorElement } from '../../services/pdfDocument';
import { deliverBlob } from '../../services/pdfShared';
import { normalizeImageFile } from '../../services/imageBrowser';
import { ChevronLeft, ChevronRight, ImagePlus, Redo2, Save, Shapes, Trash2, Type, Undo2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, StatusLine } from '../UI/Primitives';
import { v4 as uuidv4 } from 'uuid';
import { useBlocker } from 'react-router-dom';
import { ZoomControls } from '../UI/ZoomControls';
import { useZoom } from '../../hooks/useZoom';
import { usePdfPinchZoom } from '../../hooks/usePdfPinchZoom';
import { useImmersiveWorkspace } from '../Layout/AppShell';
import {
  createTextReplacementDraft,
  getTextReplacementPreviewLine,
  replacementTextBoxWidth,
  selectableTextLineId,
  selectableTextSourceRunId,
} from '../../services/pdfEditorTextReplacement';
import { PDF_TEXT_OVERFLOW_MESSAGE } from '../../services/pdfTextEditSafety';
import { pdfPageFromScrollBoundary } from '../../services/pdfZoomGesture';
import { inspectNativePdfTextTarget, releaseNativePdfTextDocument } from '../../services/pdfNativeTextEditor';

const DISCARD_EDITS_MESSAGE = 'Discard your unsaved edits?';
let replacementMeasureContext: CanvasRenderingContext2D | null | undefined;

const getReplacementMeasureContext = () => {
  if (replacementMeasureContext !== undefined) return replacementMeasureContext;
  replacementMeasureContext = document.createElement('canvas').getContext('2d');
  return replacementMeasureContext;
};

const replacementCssFontFamily = (fontFamily: string | undefined) => (
  fontFamily === 'TimesRoman'
    ? 'Times New Roman'
    : fontFamily === 'Courier'
      ? 'Courier New'
      : 'Arial'
);

const getReplacementPreviewMetrics = (element: EditorElement) => {
  const fontSize = element.fontSize || 16;
  const lineHeight = fontSize * 1.2;
  const context = getReplacementMeasureContext();
  if (!context) return { baselineOffset: 0, contentWidth: 1 };
  const cssFontFamily = replacementCssFontFamily(element.fontFamily);
  context.font = `${element.fontStyle || 'normal'} ${element.fontWeight || 400} ${fontSize}px "${cssFontFamily}"`;
  const fontMetrics = context.measureText('Hg');
  const ascent = fontMetrics.fontBoundingBoxAscent;
  const descent = fontMetrics.fontBoundingBoxDescent;
  const cssBaseline = Number.isFinite(ascent) && Number.isFinite(descent)
    ? ascent + (lineHeight - ascent - descent) / 2
    : fontSize;
  return {
    baselineOffset: fontSize - cssBaseline,
    contentWidth: Math.max(1, context.measureText(element.content).width),
  };
};

const resizeReplacementForText = (element: EditorElement, updates: Partial<EditorElement>) => {
  if (!element.replacementSource || !(
    'content' in updates
    || 'fontSize' in updates
    || 'fontFamily' in updates
    || 'fontWeight' in updates
    || 'fontStyle' in updates
  )) return updates;
  const content = updates.content ?? element.content;
  const fontSize = updates.fontSize ?? element.fontSize ?? 16;
  const fontFamily = updates.fontFamily ?? element.fontFamily ?? 'Helvetica';
  const fontWeight = updates.fontWeight ?? element.fontWeight ?? 400;
  const fontStyle = updates.fontStyle ?? element.fontStyle ?? 'normal';
  const context = getReplacementMeasureContext();
  const cssFontFamily = replacementCssFontFamily(fontFamily);
  if (context) context.font = `${fontStyle} ${fontWeight} ${fontSize}px "${cssFontFamily}"`;
  const measuredTextWidth = Math.max(
    0,
    ...content.split('\n').map((line) => context?.measureText(line).width ?? line.length * fontSize * 0.6),
  );
  return {
    ...updates,
    width: replacementTextBoxWidth({
      measuredTextWidth,
      pageWidth: element.replacementSource.pageWidth,
      sourceWidth: element.replacementSource.width,
      x: element.x,
    }),
  };
};

const replacementSaveModeMessage = (source: NonNullable<EditorElement['replacementSource']>) => {
  if (source.saveMode === 'native') {
    const previewMessage = source.nativePreview?.backgroundImage
      ? 'Direct text edit ready. The saved PDF will keep this text as text, with no patch or white box.'
      : 'Direct text edit ready. A preview-only solid mask is shown because this page cannot be reconstructed safely; the saved PDF still keeps this text as text, with no patch or white box.';
    return `${previewMessage}${source.visualUnavailableReason ? ` ${source.visualUnavailableReason}` : ''}`;
  }
  return `Visual fallback is active${source.nativeEligible ? ' by choice' : ''}. The editor reconstructs the source line automatically; Solid background stays optional. The original text remains searchable and copyable underneath; this is not redaction. ${source.nativeEligible ? 'Direct text is also available for this word.' : source.nativeUnavailableReason || 'Direct rewriting is not safe for this PDF structure.'}`;
};

const normalizeInspectorFontSize = (element: EditorElement, rawValue: string) => {
  const minimum = element.replacementSource ? 1 : 8;
  const maximum = element.replacementSource ? 512 : 72;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return element.fontSize || 16;
  return Math.max(minimum, Math.min(maximum, parsed));
};

const serializeEditorState = (
  elements: EditorElement[],
  formValues: Record<string, PdfFormFieldValue>,
) => JSON.stringify({ elements, formValues });

const useCompactEditorViewport = () => {
  const [compact, setCompact] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
};

// --- REUSABLE PAGE COMPONENT ---
const PDFPage: React.FC<{
  pageIndex: number;
  pageCount: number;
  pdfDoc: any;
  elements: EditorElement[];
  formFields: PdfFormFieldDefinition[];
  formValues: Record<string, PdfFormFieldValue>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<EditorElement>) => void;
  onBeginElementChange: () => void;
  onDelete: (id: string) => void;
  onFormValueChange: (fieldName: string, value: PdfFormFieldValue) => void;
  onPagePress: (position: { x: number; y: number }) => void;
  onReplaceTextLine: (line: PageSelectableTextLine, pageDimensions: { width: number; height: number }) => void | Promise<void>;
  insertMode: 'text' | 'shape' | null;
  zoom: number;
}> = ({
  pageIndex,
  pageCount,
  pdfDoc,
  elements,
  formFields,
  formValues,
  selectedId,
  onSelect,
  onUpdate,
  onBeginElementChange,
  onDelete,
  onFormValueChange,
  onPagePress,
  onReplaceTextLine,
  insertMode,
  zoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [availableWidth, setAvailableWidth] = useState(600);
  const [selectableTextLines, setSelectableTextLines] = useState<PageSelectableTextLine[]>([]);
  // Base dimensions at scale 1.0 (PDF Points)
  const [dims, setDims] = useState({ w: 600, h: 850 });

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
       if (entry.isIntersecting) setIsVisible(true);
    }, { rootMargin: '500px' }); // Larger preload margin for smooth zooming
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const parent = pageRef.current?.parentElement;
    if (!parent) return;
    const updateWidth = () => {
      const styles = window.getComputedStyle(parent);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      setAvailableWidth(Math.max(1, parent.clientWidth - horizontalPadding));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const render = async () => {
      if (!isVisible || isRendered || !pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        // Render at a high fixed scale (e.g. 2.0) for sharpness when zooming in
        // We do NOT re-render on zoom change, we just scale the CSS
        const renderScale = 2.0; 
        const viewport = page.getViewport({ scale: renderScale });
        
        // Store logical dimensions (1.0 scale) for layout
        setDims({ w: viewport.width / renderScale, h: viewport.height / renderScale });
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        try {
          setSelectableTextLines(await getPageSelectableTextLines(pdfDoc, pageIndex, 1));
        } catch {
          setSelectableTextLines([]);
        }
        setIsRendered(true);
      } catch (e) { console.error(e); }
    };
    render();
  }, [isVisible, isRendered, pdfDoc]);

  // Scaled dimensions for the wrapper
  // Treat 100% as fit-to-width on a phone. Intentional zooming stays inside the editor viewport,
  // so it never creates a horizontal scrollbar on the app page itself.
  const fitScale = Math.min(1, availableWidth / dims.w);
  const displayScale = fitScale * zoom;
  const scaledW = dims.w * displayScale;
  const scaledH = dims.h * displayScale;
  const existingSourceIds = new Set(
    elements.flatMap((element) => element.replacementSource ? [element.replacementSource.id] : []),
  );
  const existingSourceRunIds = new Set(
    elements.flatMap((element) => element.replacementSource?.sourceRunId
      ? [element.replacementSource.sourceRunId]
      : []),
  );
  const replacementSourceBackdrops = elements.flatMap((element) => {
    const source = element.replacementSource;
    if (!source) return [];
    return [{ key: element.id, source }];
  });

  return (
    <div 
      ref={pageRef}
      role="group"
      className="relative mx-auto shrink-0 bg-white shadow-lg"
      style={{ width: scaledW, height: scaledH }} // Helper wrapper for layout flow
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onPagePress({
          x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
          y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
        });
      }}
      aria-label={`Page ${pageIndex + 1} of ${pageCount}`}
    >
      <div 
        ref={containerRef}
        className="relative origin-top-left bg-white"
        style={{ 
          width: dims.w, 
          height: dims.h, 
          transform: `scale(${displayScale})`,
          // Ensure visual quality when scaling
          willChange: 'transform'
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />
        {replacementSourceBackdrops.map(({ key, source }) => {
          const sourcePreview = source.nativePreview ?? source;
          const sharedProps = {
            'data-testid': 'replacement-source-backdrop',
            'aria-hidden': true,
            className: 'pointer-events-none absolute z-[1] h-full w-full object-fill',
            style: {
              left: `${sourcePreview.x * 100}%`,
              top: `${sourcePreview.y * 100}%`,
              width: `${sourcePreview.width * 100}%`,
              height: `${sourcePreview.height * 100}%`,
            },
          } as const;
          return source.saveMode === 'visual' && source.backgroundMode === 'solid'
            || !sourcePreview.backgroundImage
            ? <div key={`replacement-source-${key}`} {...sharedProps} style={{ ...sharedProps.style, backgroundColor: source.backgroundColor }} />
            : <img key={`replacement-source-${key}`} {...sharedProps} src={sourcePreview.backgroundImage} alt="" />;
        })}
        {selectableTextLines.map((line) => {
          const lineId = selectableTextLineId(pageIndex, line);
          const sourceRunId = selectableTextSourceRunId(pageIndex, line);
          if (existingSourceIds.has(lineId) || existingSourceRunIds.has(sourceRunId)) return null;
          const activate = () => void onReplaceTextLine(line, { width: dims.w, height: dims.h });
          return (
            <button
              key={lineId}
              type="button"
              data-testid="existing-pdf-text-target"
              data-source-run-id={sourceRunId}
              aria-label={`Edit existing PDF word: ${line.text}`}
              aria-hidden={Boolean(insertMode)}
              tabIndex={insertMode ? -1 : 0}
              title="Click a word to edit it"
              className={`absolute z-[5] rounded-sm bg-transparent outline-none ${insertMode ? 'pointer-events-none' : 'cursor-text hover:bg-ink-500/10 hover:ring-1 hover:ring-ink-500 focus-visible:bg-ink-500/10 focus-visible:ring-2 focus-visible:ring-ink-500'}`}
              style={{ left: line.left, top: line.top, width: line.width, height: line.height }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                activate();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  activate();
                }
              }}
            />
          );
        })}
        {formFields.map((field) => (
          <PDFFormFieldControl
            key={field.id}
            field={field}
            value={formValues[field.fieldName]}
            onChange={(value) => onFormValueChange(field.fieldName, value)}
            onActivate={() => onSelect(null)}
          />
        ))}
        {elements.map(el => (
          <ResizableElement 
            key={el.id} element={el} containerRef={containerRef}
            displayScale={displayScale}
            isSelected={selectedId === el.id}
            onSelect={() => onSelect(el.id)}
            onUpdate={onUpdate} onDelete={onDelete} onBeginChange={onBeginElementChange}
          />
        ))}
      </div>
    </div>
  );
};

const buildInitialFormValues = (fields: PdfFormFieldDefinition[]) => {
  const nextValues: Record<string, PdfFormFieldValue> = {};

  fields.forEach((field) => {
    const hasExistingValue = Object.prototype.hasOwnProperty.call(nextValues, field.fieldName);

    if (field.kind === 'radio') {
      if (!hasExistingValue || (typeof field.value === 'string' && field.value)) {
        nextValues[field.fieldName] = typeof field.value === 'string' ? field.value : '';
      }
      return;
    }

    if (!hasExistingValue) {
      nextValues[field.fieldName] = field.value;
    }
  });

  return nextValues;
};

const PDFFormFieldControl: React.FC<{
  field: PdfFormFieldDefinition;
  value: PdfFormFieldValue | undefined;
  onChange: (value: PdfFormFieldValue) => void;
  onActivate: () => void;
}> = ({ field, value, onChange, onActivate }) => {
  const fontSize = Math.max(11, Math.min(16, field.height * 0.55));
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
  };

  const sharedProps = {
    'data-testid': 'pdf-form-field',
    'data-field-name': field.fieldName,
    'aria-label': field.label,
    disabled: field.readOnly,
    onPointerDown: (event: React.PointerEvent) => {
      event.stopPropagation();
      onActivate();
    },
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
  };

  if (field.kind === 'checkbox') {
    return (
      <div
        style={baseStyle}
        className="absolute flex items-center justify-center rounded border border-paper-500 bg-white/85 shadow-sm"
        onPointerDown={(event) => {
          event.stopPropagation();
          onActivate();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          {...sharedProps}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
      </div>
    );
  }

  if (field.kind === 'radio') {
    return (
      <label
        style={baseStyle}
        className="absolute flex items-center justify-center rounded border border-paper-500 bg-white/85 shadow-sm"
        onPointerDown={(event) => {
          event.stopPropagation();
          onActivate();
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <input
          {...sharedProps}
          type="radio"
          name={field.fieldName}
          checked={typeof value === 'string' && value === field.radioValue}
          onChange={() => onChange(field.radioValue || '')}
          className="h-4 w-4 accent-blue-600"
        />
      </label>
    );
  }

  if (field.kind === 'select' || field.kind === 'multiselect') {
    const currentValue = Array.isArray(value)
      ? value
      : typeof value === 'string' && value
        ? [value]
        : [];

    return (
      <select
        {...sharedProps}
        multiple={field.kind === 'multiselect'}
        value={field.kind === 'multiselect' ? currentValue : currentValue[0] || ''}
        onChange={(event) => {
          if (field.kind === 'multiselect') {
            const selectedValues = Array.from<HTMLOptionElement>(event.currentTarget.selectedOptions).map((option) => option.value);
            onChange(selectedValues);
            return;
          }

          onChange(event.currentTarget.value);
        }}
        style={{
          ...baseStyle,
          fontSize,
          padding: '2px 6px',
        }}
        className="absolute rounded border border-paper-500 bg-white/92 text-paper-900 shadow-sm outline-none focus:border-[var(--accent-rest)] focus:ring-2 focus:ring-[var(--focus-ring)]"
      >
        {field.kind === 'select' && <option value="">Select...</option>}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <textarea
        {...sharedProps}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={{
          ...baseStyle,
          fontSize,
          padding: '4px 6px',
          resize: 'none',
        }}
        className="absolute rounded border border-paper-500 bg-white/92 text-paper-900 shadow-sm outline-none focus:border-[var(--accent-rest)] focus:ring-2 focus:ring-[var(--focus-ring)]"
      />
    );
  }

  return (
    <input
      {...sharedProps}
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.currentTarget.value)}
      style={{
        ...baseStyle,
        fontSize,
        padding: '2px 6px',
      }}
      className="absolute rounded border border-paper-500 bg-white/92 text-paper-900 shadow-sm outline-none focus:border-[var(--accent-rest)] focus:ring-2 focus:ring-[var(--focus-ring)]"
    />
  );
};

// Re-implementing simplified ResizableElement
const ResizableElement: React.FC<any> = ({ element, isSelected, onSelect, onUpdate, onDelete, onBeginChange, containerRef, displayScale }) => {
  const [editMode, setEditMode] = useState<'drag' | 'resize' | null>(null);
  const origin = useRef({ clientX: 0, clientY: 0, x: 0, y: 0, width: 0.2, height: 0.1 });
  const gestureChanged = useRef(false);
  const inlineTextEditorRef = useRef<HTMLTextAreaElement>(null);
  const inlineTextChanged = useRef(false);
  const wasSelected = useRef(false);
  const width = element.width || (element.type === 'text' ? 0.24 : 0.22);
  const height = element.height || (element.type === 'text' ? 0.07 : 0.14);
  const isSourceTextReplacement = Boolean(element.replacementSource);
  const replacementPreviewSuffix = element.replacementSource?.nativePreview?.suffix ?? '';
  const replacementLineHeight = element.replacementSource
    ? Math.max(1, (element.fontSize || 16) * 1.2)
    : undefined;
  const replacementPreviewMetrics = element.replacementSource
    ? getReplacementPreviewMetrics(element)
    : undefined;
  const cssFontFamily = replacementCssFontFamily(element.fontFamily);
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  useEffect(() => {
    if (element.type !== 'text') return;
    if (isSelected && !wasSelected.current) {
      const inlineTextEditor = inlineTextEditorRef.current;
      if (inlineTextEditor) {
        inlineTextEditor.focus({ preventScroll: true });
        inlineTextEditor.setSelectionRange(0, inlineTextEditor.value.length);
      }
    }
    if (!isSelected) inlineTextChanged.current = false;
    wasSelected.current = isSelected;
  }, [element.type, isSelected]);

  const handleStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect();
    if (isSourceTextReplacement) return;
    gestureChanged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { clientX: event.clientX, clientY: event.clientY, x: element.x, y: element.y, width, height };
    setEditMode('drag');
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect();
    gestureChanged.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = { clientX: event.clientX, clientY: event.clientY, x: element.x, y: element.y, width, height };
    setEditMode('resize');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && isSelected) {
      event.preventDefault();
      onDelete(element.id);
    }
    if (!isSourceTextReplacement && isSelected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 0.05 : 0.01;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      const nextX = clamp(element.x + dx, 0, 1 - width);
      const nextY = clamp(element.y + dy, 0, 1 - height);
      if (nextX === element.x && nextY === element.y) return;
      if (!event.repeat) onBeginChange();
      onUpdate(element.id, {
        x: nextX,
        y: nextY,
      });
    }
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 0.05 : 0.01;
    const nextWidth = event.key === 'ArrowLeft'
      ? width - step
      : event.key === 'ArrowRight'
        ? width + step
        : width;
    const nextHeight = event.key === 'ArrowUp'
      ? height - step
      : event.key === 'ArrowDown'
        ? height + step
        : height;
    const clampedWidth = clamp(nextWidth, 0.04, 1 - element.x);
    const clampedHeight = clamp(nextHeight, 0.025, 1 - element.y);
    if (clampedWidth === width && clampedHeight === height) return;
    if (!event.repeat) onBeginChange();
    onUpdate(element.id, {
      width: clampedWidth,
      height: clampedHeight,
    });
  };

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!editMode || !containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const dx = (e.clientX - origin.current.clientX) / cRect.width;
      const dy = (e.clientY - origin.current.clientY) / cRect.height;
      if (editMode === 'drag') {
        const nextX = clamp(origin.current.x + dx, 0, 1 - width);
        const nextY = clamp(origin.current.y + dy, 0, 1 - height);
        if (nextX === element.x && nextY === element.y) return;
        if (!gestureChanged.current) {
          onBeginChange();
          gestureChanged.current = true;
        }
        onUpdate(element.id, {
          x: nextX,
          y: nextY,
        });
      } else {
        const nextWidth = clamp(origin.current.width + dx, 0.04, 1 - origin.current.x);
        const nextHeight = clamp(origin.current.height + dy, 0.025, 1 - origin.current.y);
        if (nextWidth === width && nextHeight === height) return;
        if (!gestureChanged.current) {
          onBeginChange();
          gestureChanged.current = true;
        }
        onUpdate(element.id, {
          width: nextWidth,
          height: nextHeight,
        });
      }
    };

    const handleEnd = () => {
      gestureChanged.current = false;
      setEditMode(null);
    };
    if (editMode) {
       window.addEventListener('pointermove', handleMove);
       window.addEventListener('pointerup', handleEnd);
       window.addEventListener('pointercancel', handleEnd);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [editMode, containerRef, element.id, element.x, element.y, height, onBeginChange, onUpdate, width]);

  const shapePreview = element.type === 'rectangle' || element.type === 'ellipse'
    ? <div className="h-full w-full" style={{ border: `${element.strokeWidth || 2}px solid ${element.color || '#2563eb'}`, borderRadius: element.type === 'ellipse' ? '999px' : '4px', background: element.fillColor && element.fillColor !== 'transparent' ? `${element.fillColor}38` : 'transparent' }} />
    : element.type === 'line' || element.type === 'arrow'
      ? <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible"><line x1="2" y1="2" x2="96" y2="96" stroke={element.color || '#2563eb'} strokeWidth={Math.max(1, element.strokeWidth || 2)} vectorEffect="non-scaling-stroke" />{element.type === 'arrow' && <polygon points="96,96 78,91 91,78" fill={element.color || '#2563eb'} />}</svg>
      : null;

  const selectionClass = isSourceTextReplacement
    ? isSelected
      ? 'z-20'
      : ''
    : isSelected
      ? 'z-20 ring-2 ring-ink-500'
      : 'ring-ink-400 hover:ring-1';

  return (
    <div 
      role="group"
      tabIndex={0}
      data-testid={isSourceTextReplacement ? 'existing-pdf-word-replacement' : 'editor-element'}
      aria-label={`${isSelected ? 'Selected ' : ''}${isSourceTextReplacement ? 'editable PDF word' : element.type} on page ${element.pageIndex + 1}. Press Enter to select${isSelected ? isSourceTextReplacement ? ', type in the text field, or Delete to restore the original word' : element.type === 'text' ? ', edit in the text field, use arrow keys to move, or Delete to remove' : ', use arrow keys to move, or Delete to remove' : ''}.`}
      className={`absolute z-10 outline-none focus-visible:ring-2 focus-visible:ring-ink-500 ${isSourceTextReplacement || (isSelected && element.type === 'text') ? 'touch-auto cursor-text' : 'touch-none cursor-move'} ${selectionClass}`}
      style={{ left: `${element.x*100}%`, top: `${element.y*100}%`, width: `${width * 100}%`, height: `${height * 100}%`, position: 'absolute', transform: element.type === 'line' || element.type === 'arrow' ? undefined : `rotate(${element.rotation || 0}deg)`, transformOrigin: 'center' }}
      onPointerDown={handleStart}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {element.type === 'text' && isSelected ? (
        <>
         <textarea
           ref={inlineTextEditorRef}
           data-testid="inline-text-editor"
           aria-label={`Edit text on page ${element.pageIndex + 1}`}
           value={element.content}
           placeholder="Text"
           rows={1}
           spellCheck={false}
           autoCorrect="off"
           onPointerDown={(event) => event.stopPropagation()}
           onClick={(event) => event.stopPropagation()}
           onChange={(event) => {
             if (!inlineTextChanged.current) {
               onBeginChange();
               inlineTextChanged.current = true;
             }
             onUpdate(element.id, {
               content: element.replacementSource
                 ? event.currentTarget.value.replace(/\s*\r?\n\s*/g, ' ')
                 : event.currentTarget.value,
             });
           }}
           onBlur={(event) => {
             inlineTextChanged.current = false;
             event.currentTarget.scrollLeft = 0;
             event.currentTarget.scrollTop = 0;
           }}
           onKeyDown={(event) => {
             event.stopPropagation();
             if (event.key === 'Enter' && element.replacementSource) {
               event.preventDefault();
               event.currentTarget.blur();
             }
             if (event.key === 'Escape') {
               event.preventDefault();
               event.currentTarget.blur();
             }
           }}
           className={`h-full w-full touch-auto resize-none overflow-hidden border-0 bg-transparent outline-none ${element.replacementSource ? 'p-0' : 'px-1.5 py-1'}`}
           style={{
             fontSize: `${element.fontSize}px`,
             color: element.color,
             fontFamily: cssFontFamily,
             fontWeight: element.fontWeight,
             fontStyle: element.fontStyle,
             lineHeight: 1.2,
             minHeight: replacementLineHeight ? `${replacementLineHeight}px` : undefined,
             whiteSpace: element.replacementSource ? 'pre' : 'pre-wrap',
             transform: replacementPreviewMetrics
               ? `translateY(${replacementPreviewMetrics.baselineOffset}px)`
               : undefined,
           }}
         />
         {replacementPreviewSuffix && (
           <span
             aria-hidden="true"
             className="pointer-events-none absolute left-0 top-0 whitespace-pre overflow-visible"
             style={{
               fontSize: `${element.fontSize}px`,
               color: element.color,
               fontFamily: cssFontFamily,
               fontWeight: element.fontWeight,
               fontStyle: element.fontStyle,
               lineHeight: 1.2,
               transform: replacementPreviewMetrics
                 ? `translateY(${replacementPreviewMetrics.baselineOffset}px)`
                 : undefined,
             }}
           >
             <span data-testid="replacement-preview-content-measure" className="invisible">{element.content}</span>
             <span data-testid="replacement-preview-suffix">{replacementPreviewSuffix}</span>
           </span>
         )}
        </>
      ) : element.type === 'text' ? (
         <div
           data-testid={element.replacementSource ? 'replacement-text-preview' : undefined}
           className={`h-full w-full ${replacementPreviewSuffix ? 'overflow-visible whitespace-pre' : 'overflow-hidden'} ${element.replacementSource ? 'p-0' : 'px-1.5 py-1'}`}
           style={{
             fontSize: `${element.fontSize}px`,
             color: element.color,
             fontFamily: cssFontFamily,
             fontWeight: element.fontWeight,
             fontStyle: element.fontStyle,
             lineHeight: 1.2,
             minHeight: replacementLineHeight ? `${replacementLineHeight}px` : undefined,
             whiteSpace: element.replacementSource ? 'pre' : 'pre-wrap',
             transform: replacementPreviewMetrics
               ? `translateY(${replacementPreviewMetrics.baselineOffset}px)`
               : undefined,
           }}
         >
           {element.content || 'Text'}
           {replacementPreviewSuffix && <span aria-hidden="true" data-testid="replacement-preview-suffix">{replacementPreviewSuffix}</span>}
         </div>
      ) : (
         element.type === 'image'
           ? <img src={element.content} alt="Added PDF graphic" className="h-full w-full object-contain pointer-events-none" />
           : shapePreview
      )}
      {isSourceTextReplacement && (
        <span
          aria-hidden="true"
          data-testid="existing-pdf-selection-underline"
          className={`pointer-events-none absolute left-0 mt-0.5 h-0.5 ${isSelected ? 'bg-[var(--accent-rest)]' : 'bg-transparent'}`}
          style={{
            top: replacementLineHeight ? `${replacementLineHeight}px` : '100%',
            width: replacementPreviewMetrics ? `${replacementPreviewMetrics.contentWidth}px` : '100%',
          }}
        />
      )}
      {isSelected && !isSourceTextReplacement && (
        <button
          type="button"
          aria-label="Resize selected element with arrow keys"
          onPointerDown={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
          className="absolute -bottom-[22px] -right-[22px] flex h-11 w-11 cursor-nwse-resize items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink-500"
          style={{ transform: `scale(${1 / displayScale})` }}
        >
          <span className="h-5 w-5 rounded-full border-2 border-paper-25 bg-ink-600 shadow" />
        </button>
      )}
    </div>
  );
};

export const EditPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const elementsRef = useRef<EditorElement[]>([]);
  const documentGeneration = useRef(0);
  const replaceElements = useCallback((next: EditorElement[]) => {
    elementsRef.current = next;
    setElements(next);
  }, []);
  const [formFields, setFormFields] = useState<PdfFormFieldDefinition[]>([]);
  const [formValues, setFormValues] = useState<Record<string, PdfFormFieldValue>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetPageIndex, setTargetPageIndex] = useState(0);
  const [shapeKind, setShapeKind] = useState<EditorElement['type']>('rectangle');
  const [insertMode, setInsertMode] = useState<'text' | 'shape' | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => serializeEditorState([], {}));
  const [immersiveBottomBarHeight, setImmersiveBottomBarHeight] = useState(96);
  const [, setHistoryVersion] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfZoomViewportRef = useRef<HTMLDivElement | null>(null);
  const immersiveBottomBarRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<EditorElement[][]>([]);
  const redoStack = useRef<EditorElement[][]>([]);
  const inspectorTextChanged = useRef(false);
  const replacingSourceIds = useRef(new Set<string>());
  const activeNativeFileRef = useRef<File | null>(null);
  
  const { zoom, zoomIn, zoomOut, resetZoom, setExactZoom } = useZoom(1.0);

  useEffect(() => {
    activeNativeFileRef.current = file?.file ?? null;
  }, [file]);

  useEffect(() => () => {
    documentGeneration.current += 1;
    const activeFile = activeNativeFileRef.current;
    if (activeFile) void releaseNativePdfTextDocument(activeFile);
  }, []);
  const setPdfZoomViewport = usePdfPinchZoom({ zoom, setZoom: setExactZoom });
  const bindPdfZoomViewport = useCallback((viewport: HTMLDivElement | null) => {
    pdfZoomViewportRef.current = viewport;
    setPdfZoomViewport(viewport);
  }, [setPdfZoomViewport]);
  const selectedElement = elements.find((element) => element.id === selectedId) ?? null;
  const isDirectTextReplacement = selectedElement?.replacementSource?.saveMode === 'native';
  useEffect(() => {
    const replacementSource = elements.find((element) => element.id === selectedId)?.replacementSource;
    setStatus((current) => {
      if (current.isProcessing || current.error) return current;
      const hasReplacementStatus = current.message.startsWith('Direct text edit ready.')
        || current.message.startsWith('Visual fallback is active');
      if (!replacementSource && !hasReplacementStatus) return current;
      const message = replacementSource ? replacementSaveModeMessage(replacementSource) : '';
      return current.message === message ? current : { ...current, message };
    });
  }, [elements, selectedId]);
  const fillableFieldCount = useMemo(
    () => new Set(formFields.map((field) => field.fieldName)).size,
    [formFields],
  );
  const pageCount = pdfDoc?.numPages || 0;
  const compactViewport = useCompactEditorViewport();
  const isNativeAndroidEditor = Boolean(file) && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const isCompactViewportEditor = Boolean(file) && compactViewport;
  const isImmersiveEditor = isNativeAndroidEditor || isCompactViewportEditor;
  const currentSnapshot = useMemo(
    () => serializeEditorState(elements, formValues),
    [elements, formValues],
  );
  const hasUnsavedEdits = Boolean(file) && currentSnapshot !== savedSnapshot;
  const navigationBlocker = useBlocker(hasUnsavedEdits);

  useImmersiveWorkspace(isImmersiveEditor);

  useEffect(() => {
    if (!isImmersiveEditor || !immersiveBottomBarRef.current) return undefined;
    const bottomBar = immersiveBottomBarRef.current;
    const updateHeight = () => {
      const nextHeight = Math.ceil(bottomBar.getBoundingClientRect().height);
      if (nextHeight > 0) setImmersiveBottomBarHeight(nextHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bottomBar);
    return () => observer.disconnect();
  }, [isImmersiveEditor]);

  const goToPage = useCallback((nextPageIndex: number) => {
    if (pageCount <= 0) return;
    setTargetPageIndex(Math.max(0, Math.min(pageCount - 1, nextPageIndex)));
    setSelectedId(null);
    setInsertMode(null);
  }, [pageCount]);

  useEffect(() => {
    const viewport = pdfZoomViewportRef.current;
    if (!viewport || pageCount < 2) return undefined;
    let changingPage = false;
    let releaseTimer: number | undefined;

    const handlePageBoundaryWheel = (event: WheelEvent) => {
      if (event.ctrlKey || changingPage) return;
      const nextPage = pdfPageFromScrollBoundary({
        currentPage: targetPageIndex,
        pageCount,
        zoom,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        atStart: viewport.scrollTop <= 2,
        atEnd: viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2,
      });
      if (nextPage === targetPageIndex) return;

      event.preventDefault();
      changingPage = true;
      const movingForward = nextPage > targetPageIndex;
      goToPage(nextPage);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const nextViewport = pdfZoomViewportRef.current;
          if (!nextViewport) return;
          nextViewport.scrollTop = movingForward
            ? 0
            : Math.max(0, nextViewport.scrollHeight - nextViewport.clientHeight);
          releaseTimer = window.setTimeout(() => { changingPage = false; }, 250);
        });
      });
    };

    viewport.addEventListener('wheel', handlePageBoundaryWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handlePageBoundaryWheel);
      if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
    };
  }, [goToPage, isImmersiveEditor, pageCount, targetPageIndex, zoom]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const nextFile = files[0];
    const generation = ++documentGeneration.current;
    replacingSourceIds.current.clear();
    if (file?.file) void releaseNativePdfTextDocument(file.file);
    setPdfDoc(null);
    replaceElements([]);
    setSelectedId(null);
    setFormFields([]);
    setFormValues({});
    setTargetPageIndex(0);
    setInsertMode(null);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
    setFile(null);
    setStatus({ isProcessing: true, progress: 10, message: 'Opening this PDF locally…' });
    let doc: any = null;
    try {
      doc = await loadPDFDocument(nextFile);
      const nextFields = await getPdfFormFields(doc);
      if (generation !== documentGeneration.current) {
        void doc.destroy();
        return;
      }
      const nextFormValues = buildInitialFormValues(nextFields);
      setPdfDoc(doc);
      setFormFields(nextFields);
      setFormValues(nextFormValues);
      setSavedSnapshot(serializeEditorState([], nextFormValues));
      setFile({ id: uuidv4(), file: nextFile, name: nextFile.name, size: nextFile.size });
      setStatus({
        isProcessing: false,
        progress: 100,
        message: '',
      });
    } catch (error) {
      if (doc?.destroy) void doc.destroy();
      if (generation !== documentGeneration.current) return;
      setPdfDoc(null);
      setStatus({
        isProcessing: false,
        progress: 0,
        message: '',
        error: error instanceof Error ? error.message : 'Unable to open this PDF.',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (pdfDoc?.destroy) {
        void pdfDoc.destroy();
      }
    };
  }, [pdfDoc]);

  const rememberSnapshot = () => {
    undoStack.current = [...undoStack.current.slice(-79), elementsRef.current.map((element) => ({ ...element }))];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
  };

  const commitElements = (updater: (current: EditorElement[]) => EditorElement[]) => {
    const next = updater(elementsRef.current);
    if (next === elementsRef.current) return;
    undoStack.current = [...undoStack.current.slice(-79), elementsRef.current.map((element) => ({ ...element }))];
    redoStack.current = [];
    replaceElements(next);
    setHistoryVersion((value) => value + 1);
  };

  const undo = () => {
    const previous = undoStack.current.at(-1);
    if (!previous) return;
    redoStack.current = [...redoStack.current, elementsRef.current.map((element) => ({ ...element }))];
    undoStack.current = undoStack.current.slice(0, -1);
    replaceElements(previous);
    setSelectedId(null);
    setHistoryVersion((value) => value + 1);
  };

  const redo = () => {
    const next = redoStack.current.at(-1);
    if (!next) return;
    undoStack.current = [...undoStack.current, elementsRef.current.map((element) => ({ ...element }))];
    redoStack.current = redoStack.current.slice(0, -1);
    replaceElements(next);
    setSelectedId(null);
    setHistoryVersion((value) => value + 1);
  };

  const addText = (x = 0.1, y = 0.1) => {
    const newEl: EditorElement = {
      id: uuidv4(), type: 'text', pageIndex: targetPageIndex,
      x: Math.min(0.72, Math.max(0, x)),
      y: Math.min(0.93, Math.max(0, y)),
      width: 0.28, height: 0.07, content: 'Text', fontSize: 16, color: '#000000', fontFamily: 'Helvetica'
    };
    commitElements((current) => [...current, newEl]);
    setSelectedId(newEl.id);
    setInsertMode(null);
  };

  const addShape = (x = 0.12, y = 0.14) => {
    const newEl: EditorElement = {
      id: uuidv4(),
      type: shapeKind,
      pageIndex: targetPageIndex,
      x: Math.min(0.76, Math.max(0, x)),
      y: Math.min(0.84, Math.max(0, y)),
      width: 0.24,
      height: shapeKind === 'line' || shapeKind === 'arrow' ? 0.12 : 0.16,
      content: '',
      color: '#2563eb',
      fillColor: 'transparent',
      strokeWidth: 2,
    };
    commitElements((current) => [...current, newEl]);
    setSelectedId(newEl.id);
    setInsertMode(null);
  };

  const handlePagePress = ({ x, y }: { x: number; y: number }) => {
    if (insertMode === 'text') {
      addText(x - 0.03, y - 0.025);
      return;
    }
    if (insertMode === 'shape') {
      addShape(x - 0.04, y - 0.04);
      return;
    }
    setSelectedId(null);
  };

  const handleReplaceTextLine = async (
    pageIndex: number,
    line: PageSelectableTextLine,
    pageDimensions: { width: number; height: number },
  ) => {
    const generation = documentGeneration.current;
    const sourceId = selectableTextLineId(pageIndex, line);
    const sourceRunId = selectableTextSourceRunId(pageIndex, line);
    if (replacingSourceIds.current.has(sourceRunId)) return;
    replacingSourceIds.current.add(sourceRunId);
    setStatus({ isProcessing: true, progress: 20, message: 'Checking whether this word can be edited directly…' });
    try {
      const nativeCapability = file && line.pdfRect && line.sourceRun?.pdfRect
        ? await inspectNativePdfTextTarget(file.file, pageIndex, {
            sourceText: line.text,
            pdfRect: line.pdfRect,
            sourceRun: {
              text: line.sourceRun.text,
              start: line.sourceRun.start,
              end: line.sourceRun.end,
              pdfRect: line.sourceRun.pdfRect,
            },
          })
        : {
            supported: false as const,
            reason: 'This word has no stable PDF text coordinates.',
          };
      let resolvedLine = line;
      const nativeMatch = 'match' in nativeCapability ? nativeCapability.match : undefined;
      if (generation !== documentGeneration.current) return;
      if (!nativeCapability.supported || !nativeMatch) {
        throw new Error('This word cannot be edited safely because its exact boundaries could not be verified. Your PDF has not been changed.');
      }
      if (nativeCapability.supported && nativeMatch) {
        const [wordRect, sourceRunRect] = await Promise.all([
          pdfSpaceRectToViewportRect(pdfDoc, pageIndex, nativeMatch.pdfRect),
          pdfSpaceRectToViewportRect(pdfDoc, pageIndex, nativeMatch.sourceRun.pdfRect),
        ]);
        resolvedLine = {
          ...line,
          left: wordRect.left,
          width: wordRect.width,
          pdfRect: nativeMatch.pdfRect,
          sourceRun: {
            ...nativeMatch.sourceRun,
            isHorizontal: line.sourceRun?.isHorizontal,
            left: sourceRunRect.left,
            top: line.sourceRun?.top ?? line.top,
            width: sourceRunRect.width,
            height: line.sourceRun?.height ?? line.height,
          },
        };
      }
      const previewFontSize = nativeCapability.supported
        ? nativeMatch?.appearance?.fontSize ?? resolvedLine.height
        : resolvedLine.height;
      const nativePreviewLine = getTextReplacementPreviewLine({
        line: resolvedLine,
        pageWidth: pageDimensions.width,
        pageHeight: pageDimensions.height,
        fontSize: previewFontSize,
      });
      let backgroundImage: string | undefined;
      try {
        backgroundImage = await getPageTextBackgroundPatch(pdfDoc, pageIndex, nativePreviewLine);
      } catch (error) {
        if (!nativeCapability.supported) throw error;
      }
      if (generation !== documentGeneration.current) return;
      const createdDraft = createTextReplacementDraft({
        pageIndex,
        pageWidth: pageDimensions.width,
        pageHeight: pageDimensions.height,
        line: resolvedLine,
        backgroundImage,
        nativeCapability,
      });
      const replacementDraft: EditorElement = {
        id: uuidv4(),
        ...createdDraft,
        replacementSource: {
          ...createdDraft.replacementSource,
          id: sourceId,
          sourceRunId,
        },
      };
      const replacement: EditorElement = {
        ...replacementDraft,
        ...resizeReplacementForText(replacementDraft, { content: replacementDraft.content }),
      };
      commitElements((current) => current.some((element) => (
        element.replacementSource?.id === sourceId
        || element.replacementSource?.sourceRunId === sourceRunId
      ))
        ? current
        : [...current, replacement]);
      setTargetPageIndex(pageIndex);
      setSelectedId(replacement.id);
      setInsertMode(null);
      setStatus({
        isProcessing: false,
        progress: 0,
        message: replacementSaveModeMessage(replacement.replacementSource!),
      });
    } catch (error) {
      if (generation !== documentGeneration.current) return;
      setStatus({
        isProcessing: false,
        progress: 0,
        message: '',
        error: error instanceof Error
          ? error.message
          : 'Unable to prepare this text without a solid background.',
      });
    } finally {
      if (generation === documentGeneration.current) replacingSourceIds.current.delete(sourceRunId);
    }
  };

  const addImage = async (selectedFile: File | undefined) => {
    if (!selectedFile) return;
    const generation = documentGeneration.current;
    if (!['image/png', 'image/jpeg'].includes(selectedFile.type)) {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Choose a PNG or JPEG image.' });
      return;
    }
    try {
      // Decode and re-encode first. Besides normalising EXIF orientation, this prevents unusual
      // but valid compressed PNG streams from tying up pdf-lib's pure-JavaScript decoder.
      const normalizedFile = await normalizeImageFile(selectedFile);
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Unable to read this image.'));
        reader.readAsDataURL(normalizedFile);
      });
      if (generation !== documentGeneration.current) return;
      if (!content) throw new Error('Unable to read this image.');
      const newEl: EditorElement = {
        id: uuidv4(), type: 'image', pageIndex: targetPageIndex,
        x: 0.1, y: 0.1, width: 0.28, height: 0.2, content,
      };
      commitElements((current) => [...current, newEl]);
      setSelectedId(newEl.id);
    } catch (error) {
      if (generation !== documentGeneration.current) return;
      setStatus({ isProcessing: false, progress: 0, message: '', error: error instanceof Error ? error.message : 'Unable to read this image.' });
    }
  };

  const updateElement = (id: string, updates: Partial<EditorElement>) => replaceElements(elementsRef.current.map((element) => element.id === id ? { ...element, ...resizeReplacementForText(element, updates) } : element));
  const commitElementUpdate = (id: string, updates: Partial<EditorElement>) => commitElements((current) => current.map((element) => element.id === id ? { ...element, ...resizeReplacementForText(element, updates) } : element));
  const updateReplacementSaveMode = (element: EditorElement, saveMode: 'native' | 'visual') => {
    if (!element.replacementSource) return;
    if (saveMode === 'visual' && !element.replacementSource.visualEligible) {
      setStatus({
        isProcessing: false,
        progress: 0,
        message: '',
        error: element.replacementSource.visualUnavailableReason || 'Visual fallback is unavailable for this word.',
      });
      return;
    }
    const replacementSource = { ...element.replacementSource, saveMode };
    commitElementUpdate(element.id, { replacementSource });
    setStatus({ isProcessing: false, progress: 0, message: replacementSaveModeMessage(replacementSource) });
  };
  const updateInspectorText = (id: string, content: string) => {
    if (!inspectorTextChanged.current) {
      rememberSnapshot();
      inspectorTextChanged.current = true;
    }
    updateElement(id, { content });
  };
  const finishInspectorTextChange = () => { inspectorTextChanged.current = false; };
  const deleteElement = (id: string) => {
    commitElements((current) => current.filter((element) => element.id !== id));
    setSelectedId(null);
  };
  const updateFormValue = (fieldName: string, value: PdfFormFieldValue) =>
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));

  const confirmDiscardEdits = useCallback(
    () => !hasUnsavedEdits || window.confirm(DISCARD_EDITS_MESSAGE),
    [hasUnsavedEdits],
  );

  const closeEditor = useCallback(() => {
    if (!confirmDiscardEdits()) return;

    if (file?.file) void releaseNativePdfTextDocument(file.file);
    documentGeneration.current += 1;
    replacingSourceIds.current.clear();
    setPdfDoc(null);
    setFile(null);
    replaceElements([]);
    setFormFields([]);
    setFormValues({});
    setSavedSnapshot(serializeEditorState([], {}));
    setSelectedId(null);
    setTargetPageIndex(0);
    setInsertMode(null);
    undoStack.current = [];
    redoStack.current = [];
    setHistoryVersion((value) => value + 1);
    setStatus({ isProcessing: false, progress: 0, message: '' });
  }, [confirmDiscardEdits, file, replaceElements]);

  useEffect(() => {
    if (!hasUnsavedEdits) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits]);

  useEffect(() => {
    if (navigationBlocker.state !== 'blocked') return;
    if (confirmDiscardEdits()) navigationBlocker.proceed();
    else navigationBlocker.reset();
  }, [confirmDiscardEdits, navigationBlocker]);

  useEffect(() => {
    if (!isImmersiveEditor) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeEditor();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeEditor, isImmersiveEditor]);

  const handleSave = async () => {
    if (!file) return;
    const generation = documentGeneration.current;
    setStatus({ isProcessing: true, progress: 20, message: 'Saving PDF edits locally…' });
    try {
      const bytes = await savePDFWithAnnotations(file.file, elements, formValues);
      if (generation !== documentGeneration.current) return;
      await deliverBlob(new Blob([bytes], { type: 'application/pdf' }), `edited-${file.name}`);
      if (generation !== documentGeneration.current) return;
      setSavedSnapshot(currentSnapshot);
      setStatus({ isProcessing: false, progress: 100, message: 'Edited PDF ready. Review it before sharing.' });
    } catch (error) {
      if (generation !== documentGeneration.current) return;
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus({ isProcessing: false, progress: 0, message: 'Save cancelled. Your edits are still here.' });
        return;
      }
      console.error(error);
      const message = error instanceof Error ? error.message : '';
      setStatus({
        isProcessing: false,
        progress: 0,
        message: '',
        error: message === PDF_TEXT_OVERFLOW_MESSAGE || message.startsWith('Visual fallback is unavailable')
          ? message
          : message.startsWith('Direct text edit failed:')
          ? `${message} Your edits are still here. Shorten the replacement, or use Visual fallback if available.`
          : 'Unable to save the edited PDF. Your edits are still here so you can try again.',
      });
    }
  };

  if (isImmersiveEditor) {
    const selectedTypeLabel = selectedElement
      ? selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1)
      : '';
    const selectedInspector = selectedElement ? (
      <section aria-label={`Selected ${selectedElement.type} properties`} className="mx-auto mb-2 max-w-md rounded-[var(--radius-field)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-2 shadow-lg">
        <div className="custom-scrollbar flex items-end gap-2 overflow-x-auto pb-1">
          <div className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">
            <span className="block uppercase tracking-[0.12em]">{selectedTypeLabel}</span>
            <button type="button" onClick={() => deleteElement(selectedElement.id)} className="chef-pressable chef-target mt-1 inline-flex h-10 items-center gap-1 rounded-[var(--radius-control)] px-2 text-xs font-bold text-[var(--status-danger-text)]"><Trash2 aria-hidden size={15} /> Delete</button>
          </div>
          {selectedElement.type === 'text' && <label className="w-44 shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Text<input value={selectedElement.content} onChange={(event) => updateInspectorText(selectedElement.id, event.currentTarget.value)} onBlur={finishInspectorTextChange} className="mt-1 h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-rest)]" /></label>}
          {selectedElement.replacementSource && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Save mode<select aria-label="Existing text save mode" value={selectedElement.replacementSource.saveMode} onChange={(event) => updateReplacementSaveMode(selectedElement, event.target.value as 'native' | 'visual')} className="mt-1 block h-10 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]"><option value="native" disabled={!selectedElement.replacementSource.nativeEligible}>Direct text</option><option value="visual" disabled={!selectedElement.replacementSource.visualEligible}>Visual fallback</option></select></label>}
          {selectedElement.replacementSource?.saveMode === 'visual' && <label className="flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-2 text-xs font-semibold text-[var(--text-secondary)]"><input type="checkbox" checked={selectedElement.replacementSource.backgroundMode === 'solid'} onChange={(event) => commitElementUpdate(selectedElement.id, { replacementSource: { ...selectedElement.replacementSource!, backgroundMode: event.target.checked ? 'solid' : 'automatic' } })} className="h-5 w-5" />Solid background</label>}
          {selectedElement.replacementSource?.saveMode === 'visual' && selectedElement.replacementSource.backgroundMode === 'solid' && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Background<input type="color" value={selectedElement.replacementSource.backgroundColor} onChange={(event) => commitElementUpdate(selectedElement.id, { replacementSource: { ...selectedElement.replacementSource!, backgroundColor: event.target.value } })} className="mt-1 block h-10 w-12 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-transparent p-1" /></label>}
          {selectedElement.type !== 'image' && !isDirectTextReplacement && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Colour<input type="color" value={selectedElement.color || '#2563eb'} onChange={(event) => commitElementUpdate(selectedElement.id, { color: event.target.value })} className="mt-1 block h-10 w-12 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-transparent p-1" /></label>}
          {selectedElement.type === 'text' && !isDirectTextReplacement && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Font<select value={selectedElement.fontFamily || 'Helvetica'} onChange={(event) => commitElementUpdate(selectedElement.id, { fontFamily: event.target.value })} className="mt-1 block h-10 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select></label>}
          {selectedElement.type === 'text' && !isDirectTextReplacement && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Size<input type="number" min={selectedElement.replacementSource ? 1 : 8} max={selectedElement.replacementSource ? 512 : 72} value={selectedElement.fontSize || 16} onChange={(event) => commitElementUpdate(selectedElement.id, { fontSize: normalizeInspectorFontSize(selectedElement, event.target.value) })} className="mt-1 block h-10 w-16 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
          {(selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse') && <label className="flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-2 text-xs font-semibold text-[var(--text-secondary)]"><input type="checkbox" checked={Boolean(selectedElement.fillColor && selectedElement.fillColor !== 'transparent')} onChange={(event) => commitElementUpdate(selectedElement.id, { fillColor: event.target.checked ? '#93c5fd' : 'transparent' })} className="h-5 w-5" /> Fill</label>}
          {(selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse') && selectedElement.fillColor !== 'transparent' && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Fill<input type="color" value={selectedElement.fillColor || '#93c5fd'} onChange={(event) => commitElementUpdate(selectedElement.id, { fillColor: event.target.value })} className="mt-1 block h-10 w-12 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-transparent p-1" /></label>}
          {selectedElement.type !== 'text' && selectedElement.type !== 'image' && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Stroke<input type="number" min={1} max={16} value={selectedElement.strokeWidth || 2} onChange={(event) => commitElementUpdate(selectedElement.id, { strokeWidth: Math.max(1, Math.min(16, Number(event.target.value) || 2)) })} className="mt-1 block h-10 w-16 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
          {!selectedElement.replacementSource && selectedElement.type !== 'line' && selectedElement.type !== 'arrow' && <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Rotate<input type="number" min={-180} max={180} value={selectedElement.rotation || 0} onChange={(event) => commitElementUpdate(selectedElement.id, { rotation: Math.max(-180, Math.min(180, Number(event.target.value) || 0)) })} className="mt-1 block h-10 w-16 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
          {selectedElement.replacementSource
            ? <span className="shrink-0 self-end pb-2 text-xs font-semibold text-[var(--text-secondary)]">{isDirectTextReplacement ? 'Original PDF font on save · No patch' : 'Position fixed'} · Page {selectedElement.pageIndex + 1}</span>
            : <label className="shrink-0 text-xs font-semibold text-[var(--text-secondary)]">Page<select value={selectedElement.pageIndex} onChange={(event) => { const nextPage = Number(event.target.value); commitElementUpdate(selectedElement.id, { pageIndex: nextPage }); goToPage(nextPage); }} className="mt-1 block h-10 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]">{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>}
        </div>
      </section>
    ) : null;

    return (
      <div
        className="min-h-[100dvh] bg-[var(--surface-canvas)]"
        style={{ paddingBottom: `calc(${immersiveBottomBarHeight}px + var(--chef-keyboard-inset, 0px))` }}
      >
        <header className="chef-chrome chef-safe-top chef-safe-x sticky top-0 z-40 border-b border-[var(--border-hairline)]">
          <div className="mx-auto flex min-h-14 max-w-4xl items-center gap-1 px-2 py-1.5">
            <button
              type="button"
              onClick={closeEditor}
              aria-label="Close editor"
              className="chef-pressable chef-target grid shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)]"
            >
              <X aria-hidden size={21} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-[var(--text-primary)]">Edit PDF</h1>
                <Badge tone="caution" className="shrink-0">Beta</Badge>
              </div>
            </div>
            <button type="button" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo added element change" className="chef-pressable chef-target grid shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] disabled:opacity-55"><Undo2 aria-hidden size={19} /></button>
            <button type="button" onClick={redo} disabled={redoStack.current.length === 0} aria-label="Redo added element change" className="chef-pressable chef-target grid shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] disabled:opacity-55"><Redo2 aria-hidden size={19} /></button>
            <button type="button" onClick={handleSave} disabled={status.isProcessing} className="chef-pressable chef-target inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-rest)] px-3 text-sm font-bold text-[var(--text-on-accent)] disabled:opacity-55"><Save aria-hidden size={17} /> Save</button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-4xl px-2 py-2 sm:px-4">
          {(status.message || status.error) && (
            <div aria-live="polite" role={status.error ? 'alert' : 'status'} className="mb-2">
              <StatusLine tone={status.error ? 'danger' : status.progress === 100 ? 'success' : 'info'}>
                {status.error || status.message}
              </StatusLine>
            </div>
          )}

          {fillableFieldCount > 0 && (
            <p className="mb-2 px-1 text-xs font-medium text-[var(--text-secondary)]">
              {fillableFieldCount} fillable field{fillableFieldCount === 1 ? '' : 's'} · Form values aren’t included in Undo.
            </p>
          )}

          <p className="mb-2 px-1 text-xs font-medium text-[var(--text-secondary)]">
            Direct edits preserve searchable PDF text and export no patch. Visual fallback stays available for unsupported structures. No OCR or paragraph reflow; content edits can invalidate digital signatures.
          </p>

          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-[var(--radius-field)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-0.5">
              <button type="button" onClick={() => goToPage(targetPageIndex - 1)} disabled={targetPageIndex === 0} aria-label="Previous page" className="chef-pressable chef-hit-y grid h-9 w-touch place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] disabled:opacity-55"><ChevronLeft aria-hidden size={19} /></button>
              <label className="flex h-9 items-center gap-1 px-1 text-xs font-semibold text-[var(--text-primary)]">
                <span className="sr-only">Page</span>
                <select value={targetPageIndex} onChange={(event) => goToPage(Number(event.target.value))} aria-label="Current editor page" className="h-9 bg-transparent tabular outline-none">
                  {Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} of {pageCount}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => goToPage(targetPageIndex + 1)} disabled={targetPageIndex >= pageCount - 1} aria-label="Next page" className="chef-pressable chef-hit-y grid h-9 w-touch place-items-center rounded-[var(--radius-control)] text-[var(--text-secondary)] disabled:opacity-55"><ChevronRight aria-hidden size={19} /></button>
            </div>
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
          </div>

          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-sunken)]">
            <div
              ref={bindPdfZoomViewport}
              data-testid="pdf-zoom-viewport"
              data-pdf-zoom={zoom.toFixed(3)}
              className={`chef-pdf-zoom-viewport h-[calc(100dvh-20.5rem)] min-h-64 max-h-[48rem] overflow-x-auto overflow-y-auto p-2 sm:p-8 ${insertMode ? 'cursor-crosshair' : ''}`}
            >
              <PDFPage
                key={targetPageIndex}
                pageIndex={targetPageIndex}
                pageCount={pageCount}
                pdfDoc={pdfDoc}
                elements={elements.filter((element) => element.pageIndex === targetPageIndex)}
                formFields={formFields.filter((field) => field.pageIndex === targetPageIndex)}
                formValues={formValues}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={updateElement}
                onBeginElementChange={rememberSnapshot}
                onDelete={deleteElement}
                onFormValueChange={updateFormValue}
                onPagePress={handlePagePress}
                onReplaceTextLine={(line, pageDimensions) => handleReplaceTextLine(targetPageIndex, line, pageDimensions)}
                insertMode={insertMode}
                zoom={zoom}
              />
            </div>
          </div>
        </div>

        <div ref={immersiveBottomBarRef} className="chef-chrome chef-safe-bottom chef-safe-x fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-hairline)] px-2 pb-2 pt-2">
          {selectedInspector}
          {insertMode && (
            <div aria-live="polite" className="mx-auto mb-1 max-w-md text-center text-xs font-semibold text-[var(--accent-text)]">
              Tap the page to place {insertMode === 'text' ? 'text' : `a ${shapeKind}`}.
            </div>
          )}
          <div role="toolbar" aria-label="Add content" className="mx-auto grid max-w-md grid-cols-[1fr_1fr_1fr_minmax(6.5rem,1.25fr)] gap-1">
            <button
              type="button"
              aria-pressed={insertMode === 'text'}
              onClick={(event) => {
                if (event.detail === 0) addText();
                else setInsertMode((current) => current === 'text' ? null : 'text');
              }}
              className={`chef-pressable chef-target flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-xs font-bold ${insertMode === 'text' ? 'bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]' : 'text-[var(--text-secondary)]'}`}
            ><Type aria-hidden size={19} /><span>Text</span></button>
            <button type="button" onClick={() => imageInputRef.current?.click()} className="chef-pressable chef-target flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-xs font-bold text-[var(--text-secondary)]"><ImagePlus aria-hidden size={19} /><span>Image</span></button>
            <button
              type="button"
              aria-pressed={insertMode === 'shape'}
              onClick={(event) => {
                if (event.detail === 0) addShape();
                else setInsertMode((current) => current === 'shape' ? null : 'shape');
              }}
              className={`chef-pressable chef-target flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-xs font-bold ${insertMode === 'shape' ? 'bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]' : 'text-[var(--text-secondary)]'}`}
            ><Shapes aria-hidden size={19} /><span>Shape</span></button>
            <label className="flex min-h-11 min-w-0 items-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2">
              <span className="sr-only">Shape type</span>
              <select value={shapeKind} onChange={(event) => { setShapeKind(event.target.value as EditorElement['type']); setInsertMode('shape'); }} aria-label="Shape type" className="h-10 min-w-0 w-full bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none">
                <option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option><option value="arrow">Arrow</option>
              </select>
            </label>
          </div>
          <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={(event) => { void addImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full max-w-6xl px-4 py-4 sm:py-6 ${file ? '' : 'chef-tool-landing-centered'}`}>
       <div className="mb-3 flex flex-col gap-2">
          <div>
            <h1 className="text-2xl font-bold">Edit PDF <Badge tone="caution" className="align-middle">Beta</Badge></h1>
            {/* Kept: this is a beta editor and the export is what gets shared. */}
            <p className="mt-1 text-sm font-medium text-[var(--status-caution-text)]">Review the result before sharing.</p>
          </div>
          {file && (
             <div role="toolbar" aria-label="PDF editor tools" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-2">
                <button type="button" onClick={() => goToPage(targetPageIndex - 1)} disabled={targetPageIndex === 0} aria-label="Previous page" className="chef-hit-y chef-pressable flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] text-[var(--text-secondary)] disabled:opacity-55"><ChevronLeft size={20} /></button>
                <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm font-semibold text-[var(--text-primary)]">
                  Page
                  <select value={targetPageIndex} onChange={(event) => goToPage(Number(event.target.value))} aria-label="Current editor page" className="min-h-11 bg-transparent outline-none">
                    {Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} of {pageCount}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => goToPage(targetPageIndex + 1)} disabled={targetPageIndex >= pageCount - 1} aria-label="Next page" className="chef-hit-y chef-pressable flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] text-[var(--text-secondary)] disabled:opacity-55"><ChevronRight size={20} /></button>
                <span className="mx-1 hidden h-7 w-px bg-[var(--border-hairline)] sm:block" aria-hidden="true" />
                <button type="button" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo added element change" className="chef-hit-y chef-pressable flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)] disabled:opacity-55"><Undo2 size={18} /></button>
                <button type="button" onClick={redo} disabled={redoStack.current.length === 0} aria-label="Redo added element change" className="chef-hit-y chef-pressable flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-secondary)] disabled:opacity-55"><Redo2 size={18} /></button>
                <button type="button" onClick={() => addText()} className="chef-hit-y chef-pressable flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-4 font-bold text-[var(--text-primary)] hover:border-[var(--accent-rest)]"><Type size={18}/> Text</button>
                <button type="button" onClick={() => imageInputRef.current?.click()} className="chef-hit-y chef-pressable flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-4 font-bold text-[var(--text-primary)] hover:border-[var(--accent-rest)]"><ImagePlus size={18}/> Image</button>
                <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={(event) => { void addImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                <div className="flex min-h-11 flex-wrap overflow-hidden rounded-[var(--radius-control)] border border-[var(--border-strong)]">
                  <select value={shapeKind} onChange={(event) => setShapeKind(event.target.value as EditorElement['type'])} aria-label="Shape type" className="min-h-11 border-0 bg-[var(--surface-raised)] px-2 text-sm font-semibold text-[var(--text-primary)] outline-none">
                    <option value="rectangle">Rectangle</option><option value="ellipse">Ellipse</option><option value="line">Line</option><option value="arrow">Arrow</option>
                  </select>
                  <button type="button" onClick={() => addShape()} aria-label={`Add ${shapeKind}`} className="chef-hit-y chef-pressable flex min-h-11 items-center gap-1 border-l border-[var(--border-strong)] px-3 font-bold text-[var(--text-primary)]"><Shapes size={18}/> Add</button>
                </div>
                <button type="button" onClick={handleSave} disabled={status.isProcessing} className="chef-hit-y chef-pressable flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-rest)] px-6 font-bold text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] disabled:opacity-55"><Save size={18}/> Save</button>
             </div>
          )}
          {selectedElement && (
            <div role="region" aria-label={`Selected ${selectedElement.type} properties`} className="rounded-[var(--radius-field)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-3 py-2">
              <div className="flex flex-wrap items-end gap-2">
                <span className="pb-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">Selected {selectedElement.type}</span>
                {selectedElement.type === 'text' && <label className="min-w-0 flex-1 basis-[220px] text-xs font-semibold text-[var(--text-secondary)]">Text<input value={selectedElement.content} onChange={(event) => updateInspectorText(selectedElement.id, event.currentTarget.value)} onBlur={finishInspectorTextChange} className="mt-1 h-11 w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-rest)] focus:shadow-[inset_0_0_0_1px_var(--accent-rest)]" /></label>}
                {selectedElement.replacementSource && <label className="text-xs font-semibold text-[var(--text-secondary)]">Save mode<select aria-label="Existing text save mode" value={selectedElement.replacementSource.saveMode} onChange={(event) => updateReplacementSaveMode(selectedElement, event.target.value as 'native' | 'visual')} className="mt-1 block h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]"><option value="native" disabled={!selectedElement.replacementSource.nativeEligible}>Direct text</option><option value="visual" disabled={!selectedElement.replacementSource.visualEligible}>Visual fallback</option></select></label>}
                {selectedElement.replacementSource?.saveMode === 'visual' && <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] px-2 text-xs font-semibold text-[var(--text-secondary)]"><input type="checkbox" checked={selectedElement.replacementSource.backgroundMode === 'solid'} onChange={(event) => commitElementUpdate(selectedElement.id, { replacementSource: { ...selectedElement.replacementSource!, backgroundMode: event.target.checked ? 'solid' : 'automatic' } })} className="h-5 w-5" />Solid background</label>}
                {selectedElement.replacementSource?.saveMode === 'visual' && selectedElement.replacementSource.backgroundMode === 'solid' && <label className="text-xs font-semibold text-[var(--text-secondary)]">Background<input type="color" value={selectedElement.replacementSource.backgroundColor} onChange={(event) => commitElementUpdate(selectedElement.id, { replacementSource: { ...selectedElement.replacementSource!, backgroundColor: event.target.value } })} className="mt-1 block h-11 w-12 rounded border border-[var(--border-strong)] bg-transparent p-1" /></label>}
                {selectedElement.type !== 'image' && !isDirectTextReplacement && <label className="text-xs font-semibold text-[var(--text-secondary)]">Colour<input type="color" value={selectedElement.color || '#2563eb'} onChange={(event) => commitElementUpdate(selectedElement.id, { color: event.target.value })} className="mt-1 block h-11 w-12 rounded border border-[var(--border-strong)] bg-transparent p-1" /></label>}
                {selectedElement.type === 'text' && !isDirectTextReplacement && <label className="text-xs font-semibold text-[var(--text-secondary)]">Font<select value={selectedElement.fontFamily || 'Helvetica'} onChange={(event) => commitElementUpdate(selectedElement.id, { fontFamily: event.target.value })} className="mt-1 block h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select></label>}
                {selectedElement.type === 'text' && !isDirectTextReplacement && <label className="text-xs font-semibold text-[var(--text-secondary)]">Size<input type="number" min={selectedElement.replacementSource ? 1 : 8} max={selectedElement.replacementSource ? 512 : 72} value={selectedElement.fontSize || 16} onChange={(event) => commitElementUpdate(selectedElement.id, { fontSize: normalizeInspectorFontSize(selectedElement, event.target.value) })} className="mt-1 block h-11 w-20 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
                {(selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse') && <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]"><input type="checkbox" checked={Boolean(selectedElement.fillColor && selectedElement.fillColor !== 'transparent')} onChange={(event) => commitElementUpdate(selectedElement.id, { fillColor: event.target.checked ? '#93c5fd' : 'transparent' })} className="h-5 w-5" /> Fill</label>}
                {(selectedElement.type === 'rectangle' || selectedElement.type === 'ellipse') && selectedElement.fillColor !== 'transparent' && <label className="text-xs font-semibold text-[var(--text-secondary)]">Fill colour<input type="color" value={selectedElement.fillColor || '#93c5fd'} onChange={(event) => commitElementUpdate(selectedElement.id, { fillColor: event.target.value })} className="mt-1 block h-11 w-12 rounded border border-[var(--border-strong)] bg-transparent p-1" /></label>}
                {selectedElement.type !== 'text' && selectedElement.type !== 'image' && <label className="text-xs font-semibold text-[var(--text-secondary)]">Stroke<input type="number" min={1} max={16} value={selectedElement.strokeWidth || 2} onChange={(event) => commitElementUpdate(selectedElement.id, { strokeWidth: Math.max(1, Math.min(16, Number(event.target.value) || 2)) })} className="mt-1 block h-11 w-20 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
                {!selectedElement.replacementSource && selectedElement.type !== 'line' && selectedElement.type !== 'arrow' && <label className="text-xs font-semibold text-[var(--text-secondary)]">Rotate<input type="number" min={-180} max={180} value={selectedElement.rotation || 0} onChange={(event) => commitElementUpdate(selectedElement.id, { rotation: Math.max(-180, Math.min(180, Number(event.target.value) || 0)) })} className="mt-1 block h-11 w-20 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]" /></label>}
                {selectedElement.replacementSource
                  ? <span className="self-end pb-3 text-xs font-semibold text-[var(--text-secondary)]">{isDirectTextReplacement ? 'Original PDF font on save · No patch' : 'Position fixed'} · Page {selectedElement.pageIndex + 1}</span>
                  : <label className="text-xs font-semibold text-[var(--text-secondary)]">Page<select value={selectedElement.pageIndex} onChange={(event) => { const nextPage = Number(event.target.value); commitElementUpdate(selectedElement.id, { pageIndex: nextPage }); goToPage(nextPage); }} className="mt-1 block h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-canvas)] px-2 text-sm text-[var(--text-primary)]">{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>}
                <button type="button" onClick={() => deleteElement(selectedElement.id)} className="chef-hit-y chef-pressable inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--status-danger-text)] px-3 text-sm font-bold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-quiet)]"><Trash2 size={16}/> Delete</button>
              </div>
            </div>
          )}
          {file && fillableFieldCount > 0 && (
            <p className="px-1 text-xs font-medium text-[var(--text-secondary)]">
              {fillableFieldCount} fillable field{fillableFieldCount === 1 ? '' : 's'} · Form values aren’t included in Undo.
            </p>
          )}
          {file && (
            <p className="px-1 text-xs font-medium text-[var(--text-secondary)]">
              Select a word to edit it in place. Direct text edits stay searchable and use no patch; unsupported structures use the clearly labeled Visual fallback. No OCR or paragraph reflow; content edits can invalidate digital signatures.
            </p>
          )}
          {file && (status.message || status.error) && (
            <div aria-live="polite" role={status.error ? 'alert' : 'status'}>
              <StatusLine tone={status.error ? 'danger' : status.progress === 100 ? 'success' : 'info'}>
                {status.error || status.message}
              </StatusLine>
            </div>
          )}
       </div>

       <AnimatePresence mode="wait">
          {!file ? (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-xl">
                <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Choose a PDF to edit" />
             </motion.div>
          ) : (
             <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-sunken)]">
                <div className="flex justify-end border-b border-[var(--border-hairline)] bg-[var(--surface-raised)] px-2 py-1.5 [&_button]:h-11 [&_button]:w-11 [&_button]:p-0">
                  <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
                </div>
                <div
                  ref={bindPdfZoomViewport}
                  data-testid="pdf-zoom-viewport"
                  data-pdf-zoom={zoom.toFixed(3)}
                  className="chef-pdf-zoom-viewport h-[70dvh] min-h-96 max-h-[48rem] overflow-x-auto overflow-y-auto p-2 sm:p-8"
                >
                      <PDFPage
                          key={targetPageIndex} pageIndex={targetPageIndex} pageCount={pageCount} pdfDoc={pdfDoc}
                          elements={elements.filter(e => e.pageIndex === targetPageIndex)}
                          formFields={formFields.filter((field) => field.pageIndex === targetPageIndex)}
                          formValues={formValues}
                          selectedId={selectedId} onSelect={setSelectedId}
                          onUpdate={updateElement} onBeginElementChange={rememberSnapshot} onDelete={deleteElement}
                          onFormValueChange={updateFormValue}
                          onPagePress={() => setSelectedId(null)}
                          onReplaceTextLine={(line, pageDimensions) => handleReplaceTextLine(targetPageIndex, line, pageDimensions)}
                          insertMode={null}
                          zoom={zoom}
                      />
                </div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};
