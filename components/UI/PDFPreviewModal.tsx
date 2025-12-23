
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { loadPDFDocument, renderPageAsImage } from '../../services/pdfService';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [loading, setLoading] = useState(true);
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0, 0.5, 3.0);
  const [error, setError] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Load High-Res Page
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const doc = await loadPDFDocument(file);
        if (!active) return;
        
        // Render at scale 2.0 for crispness on typical screens
        const { dataUrl } = await renderPageAsImage(doc, pageIndex, {
          scale: 2.0,
          format: 'image/jpeg',
          quality: 0.9
        });
        
        if (active) {
          setImageUrl(dataUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setError("Failed to render preview.");
          setLoading(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [file, pageIndex]);

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
          <h3 className="text-white font-bold text-lg">{pageLabel}</h3>
          <div className="flex items-center gap-4">
            <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
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
        <div className="flex-1 relative overflow-auto flex items-center justify-center p-8 bg-black/50 custom-scrollbar">
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
                transform: `scale(${zoom})`, 
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-out'
              }}
              className="shadow-2xl"
            >
              <img 
                src={imageUrl} 
                alt={pageLabel} 
                className="max-w-full max-h-none object-contain bg-white rounded-sm"
                draggable={false}
              />
            </div>
          ) : null}
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
