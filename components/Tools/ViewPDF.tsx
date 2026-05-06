import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  Edit3,
  FileDown,
  FileImage,
  FileSignature,
  Hash,
  Loader2,
  RotateCw,
  Scissors,
  Trash2,
  Type,
  Wrench,
} from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { ZoomControls } from '../UI/ZoomControls';
import { StatusToast } from '../UI/StatusToast';
import { loadPDFDocument } from '../../services/pdfBrowser';
import { downloadBlob } from '../../services/pdfShared';
import { useOpenedPdf } from '../../hooks/useOpenedPdf';
import { useZoom } from '../../hooks/useZoom';
import type { ProcessingStatus } from '../../types';

const viewerTools = [
  { label: 'Edit PDF', path: '/edit', icon: Edit3 },
  { label: 'Sign', path: '/sign', icon: FileSignature },
  { label: 'Compress', path: '/compress', icon: FileDown },
  { label: 'Split', path: '/split', icon: Scissors },
  { label: 'Rotate', path: '/rotate', icon: RotateCw },
  { label: 'Delete pages', path: '/delete-pages', icon: Trash2 },
  { label: 'PDF to Image', path: '/pdf-to-jpg', icon: FileImage },
  { label: 'Extract text', path: '/ocr', icon: Type },
  { label: 'Page numbers', path: '/page-numbers', icon: Hash },
  { label: 'Repair', path: '/repair', icon: Wrench },
];

const ViewerPage: React.FC<{ pdfDoc: any; pageIndex: number; zoom: number }> = ({ pdfDoc, pageIndex, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 612, height: 792 });

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { rootMargin: '600px' });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;

    let cancelled = false;
    const render = async () => {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      setDimensions({ width: viewport.width / 2, height: viewport.height / 2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [isVisible, pageIndex, pdfDoc]);

  return (
    <div ref={containerRef} className="relative mb-5 rounded border border-slate-200 bg-white shadow-sm dark:border-slate-800">
      <div
        className="origin-top-left"
        style={{
          width: dimensions.width * zoom,
          height: dimensions.height * zoom,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block origin-top-left"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
      <div className="absolute left-2 top-2 rounded bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">
        {pageIndex + 1}
      </div>
    </div>
  );
};

export const ViewPDF: React.FC = () => {
  const { openedPdf, setOpenedPdfFile } = useOpenedPdf();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [toolsOpen, setToolsOpen] = useState(false);
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1, 0.5, 2, 0.25);
  const navigate = useNavigate();

  useEffect(() => {
    if (!openedPdf) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    setStatus({ isProcessing: true, progress: 20, message: 'Opening PDF...' });

    loadPDFDocument(openedPdf.file)
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setStatus({ isProcessing: false, progress: 100, message: '' });
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setStatus({ isProcessing: false, progress: 0, message: '', error: 'Could not open this PDF.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [openedPdf]);

  const handleFilesSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setOpenedPdfFile(file);
  };

  const openTool = (path: string) => {
    setToolsOpen(false);
    navigate(path, { state: { useOpenedPdf: true, openedPdfId: openedPdf?.id } });
  };

  if (!openedPdf) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center px-4 py-8">
        <div className="mb-5">
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
            ← Back
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">View PDF</h1>
        </div>
        <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf,application/pdf" label="Open PDF in PDF Chef" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <header className="z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <img src="/logo.svg" alt="" className="h-6 w-6 rounded-md object-contain" />
              <span>PDF Chef</span>
            </Link>
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">{openedPdf.name}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
            <button
              type="button"
              onClick={() => downloadBlob(openedPdf.file, openedPdf.name, 'application/pdf')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              title="Download original"
              aria-label="Download original"
            >
              <Download size={18} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                aria-expanded={toolsOpen}
              >
                Tools
                <ChevronDown size={16} />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {viewerTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.path}
                        type="button"
                        onClick={() => openTool(tool.path)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Icon size={16} />
                        {tool.label}
                      </button>
                    );
                  })}
                  <Link
                    to="/"
                    className="block border-t border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    All tools
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {!pdfDoc ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Opening PDF
          </div>
        ) : (
          <div className="mx-auto flex w-max min-w-0 flex-col items-center">
            {Array.from({ length: pdfDoc.numPages || 0 }).map((_, index) => (
              <ViewerPage key={index} pdfDoc={pdfDoc} pageIndex={index} zoom={zoom} />
            ))}
          </div>
        )}
      </main>

      <StatusToast status={status} />
    </div>
  );
};
