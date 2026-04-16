
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ArrowLeft, ArrowRight, Move } from 'lucide-react';
import { loadPDFDocument, renderPageAsImage } from '../../services/pdfBrowser';
import { motion } from 'framer-motion';
import { ZoomControls } from './ZoomControls';
import { useZoom } from '../../hooks/useZoom';

interface PDFPreviewModalProps {
  file: File;
  pageIndex: number; // 0-based index
  pageLabel: string; // e.g., "Page 1"
  onClose: () => void;
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ file, pageIndex, pageLabel, onClose }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(pageIndex);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0, 0.5, 5.0);
  const [error, setError] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const imageUrlRef = useRef<string | null>(null);
  const pdfDocRef = useRef<any | null>(null);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setCurrentPageIndex((value) => Math.max(0, value - 1));
      if (e.key === 'ArrowRight') setCurrentPageIndex((value) => Math.min(Math.max(0, totalPages - 1), value + 1));
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, totalPages]);

  useEffect(() => {
    setCurrentPageIndex(pageIndex);
  }, [pageIndex]);

  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Load document once
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(null);
        const doc = await loadPDFDocument(file);
        if (!active) return;
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc?.numPages ?? 0);
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Failed to load PDF.');
        }
      }
    })();
    return () => {
      active = false;
      if (pdfDocRef.current?.destroy) {
        void pdfDocRef.current.destroy();
      }
      pdfDocRef.current = null;
      setPdfDoc(null);
    };
  }, [file]);

  // Load active page
  useEffect(() => {
    let active = true;
    if (!pdfDoc) return undefined;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const renderScale = zoom >= 2 ? 2.6 : 2.0;
        const { objectUrl } = await renderPageAsImage(pdfDoc, currentPageIndex, {
          scale: renderScale,
          format: 'image/jpeg',
          quality: 0.92,
        });
        if (!active) {
          if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
          return;
        }
        if (imageUrlRef.current && imageUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(imageUrlRef.current);
        }
        imageUrlRef.current = objectUrl;
        setImageUrl(objectUrl);
      } catch (err) {
        console.error(err);
        if (active) {
          setError('Failed to render preview.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pdfDoc, currentPageIndex, zoom]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [currentPageIndex]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current && imageUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
      imageUrlRef.current = null;
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl h-[90vh] flex flex-col bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 z-10">
          <h3 className="text-white font-bold text-lg">
            {pageLabel} • Page {currentPageIndex + 1}{totalPages > 0 ? ` of ${totalPages}` : ''}
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPageIndex((value) => Math.max(0, value - 1))}
              disabled={currentPageIndex <= 0}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
              aria-label="Previous page"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentPageIndex((value) => Math.min(Math.max(0, totalPages - 1), value + 1))}
              disabled={currentPageIndex >= Math.max(0, totalPages - 1)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
              aria-label="Next page"
            >
              <ArrowRight size={18} />
            </button>
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} max={5} />
            <div className="w-px h-6 bg-slate-700 mx-2" />
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close Preview"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div
          className={`flex-1 relative overflow-hidden flex items-center justify-center p-8 bg-black/50 ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          onPointerDown={handlePointerDown}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={40} />
              <p>Rendering high-quality preview...</p>
            </div>
          ) : error ? (
            <div className="text-rose-400 font-medium bg-rose-900/20 px-6 py-4 rounded-xl border border-rose-900/50">
              {error}
            </div>
          ) : imageUrl ? (
            <div 
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-out'
              }}
              className="flex max-h-full max-w-full items-center justify-center shadow-2xl"
            >
              <img 
                src={imageUrl} 
                alt={pageLabel} 
                className="block max-h-full max-w-full object-contain bg-white rounded-sm"
                draggable={false}
              />
            </div>
          ) : null}
          {zoom > 1 && isPanning && (
            <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-1 text-xs text-white">
              <Move size={12} />
              Dragging
            </div>
          )}
        </div>
        
        {/* Footer Hint */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-500">
          Read-only mode • Use dragging controls in the main list to reorder
        </div>
      </div>
    </motion.div>,
    document.body
  );
};
