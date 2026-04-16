import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, Hash, Loader2, Move } from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { ChefSlider } from '../UI/ChefSlider';
import { PDFFile, ProcessingStatus } from '../../types';
import { addPageNumbersToPDF, getPDFPageCount } from '../../services/pdfDocument';
import { loadPDFDocument, renderPageAsImage } from '../../services/pdfBrowser';
import { downloadBlob } from '../../services/pdfShared';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type EditMode = 'drag' | 'resize' | null;

const parsePageInput = (value: string) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : null;
};

const buildPreviewLabel = (format: string, pageNumber: number, totalPages: number) => {
  const trimmed = format.trim();
  if (!trimmed) return `Page ${pageNumber}`;
  if (trimmed.includes('{n}') || trimmed.includes('{total}')) {
    return trimmed.replaceAll('{n}', String(pageNumber)).replaceAll('{total}', String(totalPages));
  }
  if (/\d+/.test(trimmed)) {
    return trimmed.replace(/\d+/, String(pageNumber));
  }
  return `${trimmed} ${pageNumber}`;
};

export const PageNumbersPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const [format, setFormat] = useState('Page 1');
  const [fontSize, setFontSize] = useState(12);
  const [xPercent, setXPercent] = useState(50);
  const [yPercent, setYPercent] = useState(10);
  const [startPage, setStartPage] = useState('1');
  const [endPage, setEndPage] = useState('1');
  const [totalPages, setTotalPages] = useState(1);

  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 595, height: 842 });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const editModeRef = useRef<EditMode>(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startXPercent: 50,
    startYPercent: 10,
    startFontSize: 12,
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setPreviewSize({ width, height });
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [previewUrl]);

  const renderPreviewPage = useCallback(async (sourceFile: File, requestedPageIndex: number) => {
    setPreviewLoading(true);
    try {
      const pdf = await loadPDFDocument(sourceFile);
      const count = Math.max(1, pdf.numPages || 1);
      const clampedPage = clamp(requestedPageIndex, 0, count - 1);
      const preview = await renderPageAsImage(pdf, clampedPage, {
        format: 'image/jpeg',
        quality: 0.9,
        scale: 1.4,
      });

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewUrlRef.current = preview.objectUrl;

      setPreviewUrl(preview.objectUrl);
      setPreviewDimensions({ width: preview.width, height: preview.height });
      setPreviewPageIndex(clampedPage);
      setPreviewError(null);
      setTotalPages(count);
    } catch (error) {
      console.error(error);
      setPreviewError('Unable to load preview page.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    const selected = files[0];
    const count = await getPDFPageCount(selected).catch(() => 1);
    const normalizedCount = Math.max(1, count);

    setFile({
      id: uuidv4(),
      file: selected,
      name: selected.name,
      size: selected.size,
      pageCount: normalizedCount,
    });
    setTotalPages(normalizedCount);
    setStartPage('1');
    setEndPage(String(normalizedCount));
    setPreviewPageIndex(0);

    void renderPreviewPage(selected, 0);
  };

  const validationMessage = useMemo(() => {
    const start = parsePageInput(startPage);
    const end = parsePageInput(endPage);

    if (startPage.trim() !== '' && start === null) return 'Start page must be a whole number.';
    if (endPage.trim() !== '' && end === null) return 'End page must be a whole number.';
    if (start !== null && start > totalPages) return `Start page must be within 1-${totalPages}.`;
    if (end !== null && end > totalPages) return `End page must be within 1-${totalPages}.`;
    if (start !== null && end !== null && start > end) return 'Start page must be less than or equal to end page.';

    return null;
  }, [endPage, startPage, totalPages]);

  const resolvedStartPage = parsePageInput(startPage) ?? 1;
  const resolvedEndPage = parsePageInput(endPage) ?? totalPages;
  const previewNumber = clamp(resolvedStartPage, 1, totalPages);
  const previewText = buildPreviewLabel(format, previewNumber, totalPages);

  const measuredTextWidth = useMemo(() => {
    if (typeof document === 'undefined') return previewText.length * fontSize * 0.5;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return previewText.length * fontSize * 0.5;
    context.font = `${fontSize}px Arial, sans-serif`;
    return context.measureText(previewText).width;
  }, [fontSize, previewText]);

  const overlayBoxWidth = Math.max(measuredTextWidth + 24, 90);
  const overlayBoxHeight = Math.max(fontSize * 1.9, 46);
  const overlayLeft = clamp((xPercent / 100) * previewSize.width - overlayBoxWidth / 2, 0, previewSize.width - overlayBoxWidth);
  const overlayTop = clamp((yPercent / 100) * previewSize.height - overlayBoxHeight / 2, 0, previewSize.height - overlayBoxHeight);

  const startEditing = (event: React.PointerEvent, mode: Exclude<EditMode, null>) => {
    if (!previewSize.width || !previewSize.height) return;
    event.stopPropagation();

    editModeRef.current = mode;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startXPercent: xPercent,
      startYPercent: yPercent,
      startFontSize: fontSize,
    };
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;

    const onPointerMove = (event: PointerEvent) => {
      const mode = editModeRef.current;
      if (!mode || !previewSize.width || !previewSize.height) return;

      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;

      if (mode === 'drag') {
        const nextX = dragRef.current.startXPercent + (dx / previewSize.width) * 100;
        const nextY = dragRef.current.startYPercent + (dy / previewSize.height) * 100;
        setXPercent(clamp(nextX, 2, 98));
        setYPercent(clamp(nextY, 2, 98));
      } else if (mode === 'resize') {
        const primaryDelta = Math.max(dx, dy * 0.7);
        const scaled = dragRef.current.startFontSize * (1 + primaryDelta / 180);
        setFontSize(clamp(Math.round(scaled), 8, 72));
      }
    };

    const onPointerUp = () => {
      editModeRef.current = null;
      setEditing(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [editing, previewSize.height, previewSize.width]);

  const handleApply = async () => {
    if (!file || validationMessage) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying page numbers...' });

    try {
      const bytes = await addPageNumbersToPDF(file.file, {
        format,
        fontSize,
        xPercent: xPercent / 100,
        yPercent: yPercent / 100,
        startPage: resolvedStartPage,
        endPage: resolvedEndPage,
      });

      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `numbered-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to add page numbers.' });
    }
  };

  const jumpPreviewPage = (next: number) => {
    if (!file) return;
    const clampedPage = clamp(next, 0, totalPages - 1);
    void renderPreviewPage(file.file, clampedPage);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Page Numbers</h1>
        <p className="text-slate-500 dark:text-slate-400">Drag to place page numbers on a real preview. Resize from the corner handle.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-3xl">
            <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to add page numbers" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Live Preview</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Page {previewPageIndex + 1} of {totalPages}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => jumpPreviewPage(previewPageIndex - 1)}
                    disabled={previewLoading || previewPageIndex <= 0}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => jumpPreviewPage(previewPageIndex + 1)}
                    disabled={previewLoading || previewPageIndex >= totalPages - 1}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/50">
                {previewLoading && !previewUrl && (
                  <div className="flex h-[320px] items-center justify-center text-slate-500">
                    <Loader2 className="mr-2 animate-spin" size={18} /> Rendering preview...
                  </div>
                )}

                {previewError && !previewUrl && <div className="p-6 text-sm text-rose-600">{previewError}</div>}

                {previewUrl && (
                  <div
                    ref={previewContainerRef}
                    className="relative w-full overflow-hidden rounded-lg bg-white"
                    style={{ aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}` }}
                  >
                    <img src={previewUrl} alt="Page preview" className="absolute inset-0 h-full w-full object-contain" />

                    <div
                      className={`absolute border-2 border-dashed ${editing ? 'border-blue-600' : 'border-blue-500/80'} bg-blue-50/70 backdrop-blur-[1px]`}
                      style={{
                        left: overlayLeft,
                        top: overlayTop,
                        width: overlayBoxWidth,
                        height: overlayBoxHeight,
                        fontSize,
                      }}
                      onPointerDown={(event) => startEditing(event, 'drag')}
                    >
                      <div className="flex h-full items-center justify-center px-2 text-center font-medium text-slate-700">{previewText}</div>
                      <button
                        className="absolute -bottom-3 -right-3 rounded-full bg-blue-600 p-1.5 text-white shadow"
                        onPointerDown={(event) => startEditing(event, 'resize')}
                        aria-label="Resize page number"
                      >
                        <Expand size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Move size={12} /> Drag to place
                <span className="opacity-40">•</span>
                <Expand size={12} /> Drag handle to resize
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Format</label>
                <input
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Use <code>{'{n}'}</code> for page number and <code>{'{total}'}</code> for total pages.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Font size ({fontSize.toFixed(1).replace(/\.0$/, '')} pt)
                </label>
                <ChefSlider min={8} max={72} step={0.5} value={fontSize} onChange={setFontSize} ariaLabel="Page number font size" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Horizontal ({Math.round(xPercent)}%)</label>
                  <ChefSlider min={2} max={98} step={0.25} value={xPercent} onChange={setXPercent} ariaLabel="Page number horizontal position" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Vertical ({Math.round(yPercent)}%)</label>
                  <ChefSlider min={2} max={98} step={0.25} value={yPercent} onChange={setYPercent} ariaLabel="Page number vertical position" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Start page</label>
                  <input
                    value={startPage}
                    onChange={(event) => setStartPage(event.target.value.replace(/[^\d]/g, ''))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">End page</label>
                  <input
                    value={endPage}
                    onChange={(event) => setEndPage(event.target.value.replace(/[^\d]/g, ''))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className={`rounded-lg px-3 py-2 text-xs ${validationMessage ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300'}`}>
                {validationMessage ?? `Numbering applies to pages ${resolvedStartPage} to ${resolvedEndPage}.`}
              </div>

              <button
                onClick={handleApply}
                disabled={status.isProcessing || !!validationMessage}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Hash size={18} />}
                <span>Add Page Numbers</span>
              </button>

              <button
                onClick={() => {
                  setFile(null);
                  if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                    previewUrlRef.current = null;
                  }
                  setPreviewUrl(null);
                }}
                className="w-full py-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Choose another file
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status.error && <div className="fixed bottom-3 right-3 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white">{status.error}</div>}
    </div>
  );
};
