
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument, renderPageAsImage, ImageExportConfig } from '../../services/pdfService';
import { Loader2, Undo2, Download, Settings2, FileImage } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import JSZip from 'jszip';
import { ZoomControls } from '../UI/ZoomControls';
import { useZoom } from '../../hooks/useZoom';
import { SEOHead } from '../SEO/SEOHead';

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // Preview State
  const [config, setConfig] = useState<ImageExportConfig>({ format: 'image/jpeg', quality: 0.8, scale: 2 });
  const [preview, setPreview] = useState<{ dataUrl: string; width: number; height: number; sizeBytes: number } | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Zoom State
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Load PDF
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size });
    try {
      const doc = await loadPDFDocument(f);
      setPdfDoc(doc);
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to load PDF' });
    }
  };

  // Generate Preview
  const updatePreview = useCallback(async () => {
    if (!pdfDoc) return;
    setIsGeneratingPreview(true);
    try {
      const res = await renderPageAsImage(pdfDoc, 0, config);
      setPreview(res);
    } catch (e) { console.error(e); } finally { setIsGeneratingPreview(false); }
  }, [pdfDoc, config]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updatePreview, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [updatePreview]);

  // Handle Drag Panning
  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const onMove = (mv: PointerEvent) => {
      setPan({ x: mv.clientX - startX, y: mv.clientY - startY });
    };
    const onUp = (up: PointerEvent) => {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(up.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Reset pan on zoom out
  useEffect(() => { if (zoom === 1) setPan({ x: 0, y: 0 }); }, [zoom]);

  const handleExport = async () => {
    if (!pdfDoc || !file) return;
    setStatus({ isProcessing: true, progress: 0, message: 'Starting export...' });
    try {
      const zip = new JSZip();
      const numPages = pdfDoc.numPages;
      const ext = config.format === 'image/png' ? 'png' : config.format === 'image/webp' ? 'webp' : 'jpg';
      for (let i = 0; i < numPages; i++) {
        setStatus({ isProcessing: true, progress: (i / numPages) * 100, message: `Rendering page ${i + 1}/${numPages}...` });
        const { dataUrl } = await renderPageAsImage(pdfDoc, i, config);
        zip.file(`Page-${i + 1}.${ext}`, dataUrl.split(',')[1], { base64: true });
      }
      setStatus({ isProcessing: true, progress: 100, message: 'Zipping...' });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}-images.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) { setStatus({ isProcessing: false, progress: 0, message: '', error: 'Export failed' }); }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 h-[calc(100vh-80px)] flex flex-col">
      <SEOHead 
        title="PDF to JPG Converter - Export Pages to Images | ZenPDF"
        description="Convert PDF pages to high-quality JPG or PNG images. Extract images locally. Secure and fast."
      />

      <div className="flex items-center justify-between mb-4 flex-shrink-0">
         <div>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">PDF to Image</h1>
         </div>
         {file && (
            <button onClick={() => { setFile(null); setPdfDoc(null); setPreview(null); }} className="px-3 py-1.5 text-sm rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center gap-2">
               <Undo2 size={14} /> Start Over
            </button>
         )}
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to convert" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden">
             
             {/* LEFT PANEL */}
             <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                   <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
                      <Settings2 size={18} className="text-blue-500"/> Export Settings
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Format</label>
                      <div className="grid grid-cols-3 gap-2">
                         {['image/jpeg', 'image/png', 'image/webp'].map((fmt) => (
                           <button key={fmt} onClick={() => setConfig({ ...config, format: fmt as any })}
                             className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${config.format === fmt ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                             {fmt.split('/')[1].toUpperCase()}
                           </button>
                         ))}
                      </div>
                   </div>
                   {config.format !== 'image/png' && (
                     <div className="space-y-2">
                        <div className="flex justify-between"><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quality</label><span className="text-xs font-mono text-slate-400">{Math.round(config.quality * 100)}%</span></div>
                        <input type="range" min="0.1" max="1" step="0.1" value={config.quality} onChange={(e) => setConfig({ ...config, quality: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg accent-blue-500" />
                     </div>
                   )}
                   <div className="space-y-2">
                      <div className="flex justify-between"><label className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolution</label><span className="text-xs font-mono text-slate-400">{Math.round(config.scale * 72)} DPI</span></div>
                      <input type="range" min="1" max="4" step="0.5" value={config.scale} onChange={(e) => setConfig({ ...config, scale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg accent-blue-500" />
                   </div>
                   <button onClick={handleExport} disabled={status.isProcessing || !preview} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                     {status.isProcessing ? <Loader2 className="animate-spin" /> : <Download size={20} />} <span>Convert {pdfDoc?.numPages} Pages</span>
                   </button>
                </div>
             </div>

             {/* PREVIEW PANEL */}
             <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col">
                <div className="absolute top-4 right-4 z-20">
                   <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
                </div>
                
                <div 
                  className={`flex-1 flex items-center justify-center overflow-hidden relative ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  onPointerDown={handlePointerDown}
                >
                  {isGeneratingPreview && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={40} /></div>}
                  {preview ? (
                     <div className="relative shadow-2xl transition-transform duration-75 will-change-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                        <img src={preview.dataUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain select-none" draggable={false} />
                     </div>
                  ) : <div className="text-slate-400 flex flex-col items-center"><FileImage size={48} className="mb-2 opacity-50"/><p>Generating preview...</p></div>}
                </div>
                
                <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 text-xs text-center text-slate-500">
                   Zoom in to inspect details. {zoom > 1 && "Drag to pan."}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
