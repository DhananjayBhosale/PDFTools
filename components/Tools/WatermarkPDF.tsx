import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { Droplets, Loader2, Maximize2, Move, X } from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { ChefSlider } from '../UI/ChefSlider';
import { PDFFile, ProcessingStatus } from '../../types';
import { addWatermarkToPDF } from '../../services/pdfDocument';
import { downloadBlob } from '../../services/pdfShared';
import { loadPDFDocument, renderPageAsImage } from '../../services/pdfBrowser';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampPercent = (value: number) => clamp(value, 2, 98);

export const WatermarkPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [text, setText] = useState('CONFIDENTIAL');
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-45);
  const [color, setColor] = useState('#000000');
  const [xPercent, setXPercent] = useState(50);
  const [yPercent, setYPercent] = useState(50);

  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 595, height: 842 });

  const [isDragging, setIsDragging] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const inlinePreviewRef = useRef<HTMLDivElement | null>(null);
  const modalPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const opacityPercent = Number((opacity * 100).toFixed(1));
  const previewAspect = useMemo(() => `${previewDimensions.width} / ${previewDimensions.height}`, [previewDimensions]);
  const overlayFontPx = Math.max(10, Math.min(128, size * 0.55));

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    const selected = files[0];
    setFile({
      id: uuidv4(),
      file: selected,
      name: selected.name,
      size: selected.size,
    });
    setXPercent(50);
    setYPercent(50);
    setShowLargePreview(false);
  };

  const handleApplyWatermark = async () => {
    if (!file || !text.trim()) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying watermark...' });
    try {
      const bytes = await addWatermarkToPDF(file.file, {
        text: text.trim(),
        size,
        opacity,
        rotation,
        color,
        xPercent,
        yPercent,
      });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `watermarked-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to add watermark' });
    }
  };

  useEffect(() => {
    const revoke = (value: string | null) => {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
    };
    return () => {
      revoke(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const revoke = (value: string | null) => {
      if (value && value.startsWith('blob:')) URL.revokeObjectURL(value);
    };

    if (!file) {
      revoke(previewUrlRef.current);
      previewUrlRef.current = null;
      setOriginalPreviewUrl(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let pdfDoc: any = null;

    const renderOriginal = async () => {
      setPreviewLoading(true);
      try {
        pdfDoc = await loadPDFDocument(file.file);
        const rendered = await renderPageAsImage(pdfDoc, 0, {
          scale: 1.4,
          format: 'image/jpeg',
          quality: 0.9,
        });

        if (cancelled) {
          URL.revokeObjectURL(rendered.objectUrl);
          return;
        }

        revoke(previewUrlRef.current);
        previewUrlRef.current = rendered.objectUrl;
        setOriginalPreviewUrl(rendered.objectUrl);
        setPreviewDimensions({ width: rendered.width, height: rendered.height });
      } catch (error) {
        console.error(error);
      } finally {
        if (typeof pdfDoc?.destroy === 'function') {
          void pdfDoc.destroy();
        }
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void renderOriginal();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const placeWatermarkFromPointer = useCallback((clientX: number, clientY: number) => {
    const container = dragContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nextX = ((clientX - rect.left) / rect.width) * 100;
    const nextY = ((clientY - rect.top) / rect.height) * 100;
    setXPercent(clampPercent(nextX));
    setYPercent(clampPercent(nextY));
  }, []);

  const beginWatermarkDrag = (event: React.PointerEvent, container: HTMLDivElement | null) => {
    if (!text.trim() || !container) return;
    event.preventDefault();
    event.stopPropagation();

    dragContainerRef.current = container;
    activePointerIdRef.current = event.pointerId;
    setIsDragging(true);
    placeWatermarkFromPointer(event.clientX, event.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      placeWatermarkFromPointer(event.clientX, event.clientY);
    };

    const handleStop = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return;
      setIsDragging(false);
      activePointerIdRef.current = null;
      dragContainerRef.current = null;
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleStop, { passive: true });
    window.addEventListener('pointercancel', handleStop, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleStop);
      window.removeEventListener('pointercancel', handleStop);
    };
  }, [isDragging, placeWatermarkFromPointer]);

  const watermarkOverlayStyle: React.CSSProperties = {
    left: `${xPercent}%`,
    top: `${yPercent}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    color,
    opacity,
    fontSize: `${overlayFontPx}px`,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
    userSelect: 'none',
  };

  const renderPreviewCanvas = (containerRef: React.RefObject<HTMLDivElement | null>, large = false) => (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
      <div className={`mx-auto ${large ? 'h-[70vh] max-h-[70vh] max-w-full' : 'w-full max-w-[460px]'}`}>
        <div
          ref={containerRef}
          className={`relative ${large ? 'h-full max-w-full' : 'w-full'} overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ aspectRatio: previewAspect, touchAction: 'none' }}
          onPointerDown={(event) => beginWatermarkDrag(event, containerRef.current)}
        >
          {originalPreviewUrl ? (
            <img src={originalPreviewUrl} alt="Watermark preview" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
          )}

          {text.trim() && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute whitespace-nowrap font-bold tracking-wide" style={watermarkOverlayStyle}>
                {text}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Move size={12} /> Drag text to place watermark
        </span>
        <span>
          X {xPercent.toFixed(1)}% • Y {yPercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Watermark PDF</h1>
        <p className="text-slate-500 dark:text-slate-400">Add a text watermark, place it anywhere, then export.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
            <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to add watermark" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Watermark text</label>
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  placeholder="CONFIDENTIAL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Size ({Number.isInteger(size) ? size : size.toFixed(1)} pt)
                </label>
                <ChefSlider
                  min={8}
                  max={140}
                  step={0.5}
                  value={size}
                  onChange={setSize}
                  ariaLabel="Watermark size"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Opacity ({opacityPercent}%)</label>
                <ChefSlider
                  min={5}
                  max={100}
                  step={0.5}
                  value={opacityPercent}
                  onChange={(next) => setOpacity(next / 100)}
                  ariaLabel="Watermark opacity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Rotation ({Number.isInteger(rotation) ? rotation : rotation.toFixed(1)}°)
                </label>
                <ChefSlider
                  min={-180}
                  max={180}
                  step={0.5}
                  value={rotation}
                  onChange={setRotation}
                  ariaLabel="Watermark rotation"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Horizontal ({xPercent.toFixed(1)}%)</label>
                  <ChefSlider min={2} max={98} step={0.1} value={xPercent} onChange={setXPercent} ariaLabel="Watermark horizontal position" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Vertical ({yPercent.toFixed(1)}%)</label>
                  <ChefSlider min={2} max={98} step={0.1} value={yPercent} onChange={setYPercent} ariaLabel="Watermark vertical position" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-11 w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Live Preview (Page 1)</div>
                <button
                  onClick={() => setShowLargePreview(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Maximize2 size={13} /> Open large preview
                </button>
              </div>

              {previewLoading ? (
                <div className="h-56 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500">
                  <Loader2 className="animate-spin mr-2" size={16} /> Rendering...
                </div>
              ) : (
                renderPreviewCanvas(inlinePreviewRef)
              )}

              <button
                onClick={handleApplyWatermark}
                disabled={status.isProcessing || !text.trim()}
                className="w-full px-5 py-3 rounded-xl font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Droplets size={18} />}
                <span>Apply Watermark</span>
              </button>
              <button onClick={() => setFile(null)} className="w-full text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-1.5">
                Choose another file
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLargePreview && file && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          >
            <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLargePreview(false)} aria-label="Close large preview" />
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative z-10 w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Large Watermark Preview</div>
                  <div className="text-xs text-slate-400">Drag text directly on the page to position watermark.</div>
                </div>
                <button
                  onClick={() => setShowLargePreview(false)}
                  className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {renderPreviewCanvas(modalPreviewRef, true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {status.error && (
        <div className="fixed bottom-3 right-3 bg-rose-600 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
          {status.error}
        </div>
      )}
    </div>
  );
};
