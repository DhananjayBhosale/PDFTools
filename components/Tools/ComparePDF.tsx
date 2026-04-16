import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Move, Undo2 } from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { ZoomControls } from '../UI/ZoomControls';
import { useZoom } from '../../hooks/useZoom';
import { getPageTextSignatures, loadPDFDocument, renderPageAsImage } from '../../services/pdfBrowser';
import { downloadBlob } from '../../services/pdfShared';

interface PreviewState {
  left: string;
  right: string;
}

const revokePreview = (url?: string) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

export const ComparePDF: React.FC = () => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [pdf1, setPdf1] = useState<any>(null);
  const [pdf2, setPdf2] = useState<any>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const previewRef = useRef<PreviewState | null>(null);

  const maxPageCount = Math.min(pdf1?.numPages ?? 0, pdf2?.numPages ?? 0);

  useEffect(() => {
    return () => {
      if (pdf1?.destroy) void pdf1.destroy();
    };
  }, [pdf1]);

  useEffect(() => {
    return () => {
      if (pdf2?.destroy) void pdf2.destroy();
    };
  }, [pdf2]);

  useEffect(() => {
    return () => {
      revokePreview(previewRef.current?.left);
      revokePreview(previewRef.current?.right);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const render = async () => {
      if (!pdf1 || !pdf2) return;
      setLoading(true);

      try {
        const [left, right] = await Promise.all([
          renderPageAsImage(pdf1, pageIndex, { format: 'image/jpeg', quality: 0.9, scale: 1.5 }),
          renderPageAsImage(pdf2, pageIndex, { format: 'image/jpeg', quality: 0.9, scale: 1.5 }),
        ]);

        if (!active) {
          revokePreview(left.objectUrl);
          revokePreview(right.objectUrl);
          return;
        }

        revokePreview(previewRef.current?.left);
        revokePreview(previewRef.current?.right);
        const nextPreview = { left: left.objectUrl, right: right.objectUrl };
        previewRef.current = nextPreview;
        setPreview(nextPreview);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void render();

    return () => {
      active = false;
    };
  }, [pdf1, pdf2, pageIndex]);

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const handleFileSelection = async (slot: 'left' | 'right', file: File) => {
    try {
      const nextDoc = await loadPDFDocument(file);
      if (slot === 'left') {
        if (pdf1?.destroy) void pdf1.destroy();
        setFile1(file);
        setPdf1(nextDoc);
      } else {
        if (pdf2?.destroy) void pdf2.destroy();
        setFile2(file);
        setPdf2(nextDoc);
      }
      setPageIndex(0);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const onMove = (moveEvent: PointerEvent) => {
      setPan({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
    };

    const onUp = (upEvent: PointerEvent) => {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const reset = () => {
    if (pdf1?.destroy) void pdf1.destroy();
    if (pdf2?.destroy) void pdf2.destroy();
    revokePreview(previewRef.current?.left);
    revokePreview(previewRef.current?.right);
    previewRef.current = null;
    setPreview(null);
    setFile1(null);
    setFile2(null);
    setPdf1(null);
    setPdf2(null);
    setPageIndex(0);
    setPan({ x: 0, y: 0 });
    resetZoom();
  };

  const handleExportReport = async () => {
    if (!file1 || !file2 || !pdf1 || !pdf2) return;
    setLoading(true);
    try {
      const commonPages = Math.min(pdf1.numPages, pdf2.numPages);
      const maxPagesCompared = Math.min(commonPages, 50);

      const [leftSignatures, rightSignatures] = await Promise.all([
        getPageTextSignatures(file1, { maxPages: maxPagesCompared, maxCharsPerPage: 600 }),
        getPageTextSignatures(file2, { maxPages: maxPagesCompared, maxCharsPerPage: 600 }),
      ]);

      const differentPages: number[] = [];
      const identicalPages: number[] = [];

      for (let index = 0; index < maxPagesCompared; index += 1) {
        const left = (leftSignatures[index] || '').trim();
        const right = (rightSignatures[index] || '').trim();
        if (left === right) {
          identicalPages.push(index + 1);
        } else {
          differentPages.push(index + 1);
        }
      }

      const matchRatio = maxPagesCompared > 0
        ? Math.round((identicalPages.length / maxPagesCompared) * 100)
        : 0;

      const mismatchDetails = differentPages.slice(0, 20).map((pageNumber) => {
        const left = leftSignatures[pageNumber - 1] || '<empty>';
        const right = rightSignatures[pageNumber - 1] || '<empty>';
        return [
          `Page ${pageNumber}`,
          `A: ${left.slice(0, 180)}`,
          `B: ${right.slice(0, 180)}`,
        ].join('\n');
      }).join('\n\n');

      const report = [
        'PDF Chef Compare Report',
        `Generated: ${new Date().toISOString()}`,
        '',
        `File A: ${file1.name}`,
        `Pages: ${pdf1.numPages}`,
        `Size: ${file1.size} bytes`,
        '',
        `File B: ${file2.name}`,
        `Pages: ${pdf2.numPages}`,
        `Size: ${file2.size} bytes`,
        '',
        'Summary',
        `- Page count equal: ${pdf1.numPages === pdf2.numPages}`,
        `- Pages compared: ${maxPagesCompared}`,
        `- Identical pages: ${identicalPages.length}`,
        `- Different pages: ${differentPages.length}`,
        `- Match ratio: ${matchRatio}%`,
        ...(maxPagesCompared < commonPages ? [`- Note: compared first ${maxPagesCompared} common pages only`] : []),
        '',
        'Different pages:',
        differentPages.length > 0 ? differentPages.join(', ') : '<none>',
        '',
        'Mismatch details (truncated):',
        mismatchDetails || '<none>',
      ].join('\n');
      downloadBlob(
        new Blob([report], { type: 'text/plain;charset=utf-8' }),
        `compare-report-${Date.now()}.txt`,
      );
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-6xl flex-col px-4 py-12">
      <div className="mb-4 flex-shrink-0">
        <Link to="/" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Compare PDF</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Preview matching pages side by side with synced zoom and pan, then export a text comparison report.
            </p>
          </div>

          {file1 && file2 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
                  disabled={pageIndex === 0}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="min-w-[110px] text-center font-medium text-slate-700 dark:text-slate-200">
                  Page {pageIndex + 1} / {maxPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPageIndex((value) => Math.min(maxPageCount - 1, value + 1))}
                  disabled={pageIndex >= maxPageCount - 1}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <ArrowRight size={16} />
                </button>
              </div>

              <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!file1 || !file2 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid flex-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Document A</h3>
              <FileUpload
                onFilesSelected={(files) => files[0] && void handleFileSelection('left', files[0])}
                accept=".pdf"
                label={file1 ? file1.name : 'Upload first PDF'}
              />
            </div>
            <div>
              <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Document B</h3>
              <FileUpload
                onFilesSelected={(files) => files[0] && void handleFileSelection('right', files[0])}
                accept=".pdf"
                label={file2 ? file2.name : 'Upload second PDF'}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col gap-6">
            <button
              type="button"
              onClick={reset}
              className="self-center rounded-full border bg-white px-4 py-2 text-slate-500 shadow-sm transition-colors hover:text-slate-900 dark:bg-slate-900"
            >
              <span className="inline-flex items-center gap-2"><Undo2 size={16} /> Reset</span>
            </button>
            <button
              type="button"
              onClick={handleExportReport}
              className="self-center rounded-full border bg-white px-4 py-2 text-slate-500 shadow-sm transition-colors hover:text-slate-900 dark:bg-slate-900"
            >
              <span className="inline-flex items-center gap-2">Export Compare Report</span>
            </button>

            <div className="grid flex-1 gap-8 overflow-hidden md:grid-cols-2">
              {[{ name: file1.name, src: preview?.left }, { name: file2.name, src: preview?.right }].map((entry) => (
                <div key={entry.name} className="flex min-h-0 flex-col gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
                    {entry.name}
                  </div>
                  <div
                    className={`relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onPointerDown={handlePointerDown}
                  >
                    {loading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-slate-950/70">
                        <Loader2 className="animate-spin text-cyan-500" size={28} />
                      </div>
                    )}
                    {entry.src && (
                      <img
                        src={entry.src}
                        alt={entry.name}
                        draggable={false}
                        className="max-h-full max-w-full select-none object-contain shadow-lg transition-transform duration-75 will-change-transform"
                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                      />
                    )}
                    {zoom > 1 && isPanning && (
                      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-white">
                        <Move size={12} />
                        Synced pan
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
