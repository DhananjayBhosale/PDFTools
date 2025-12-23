
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument, renderPageAsImage, ImageExportConfig } from '../../services/pdfService';
import { Image as ImageIcon, Loader2, Undo2, Download, Settings2, FileImage, ZoomIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import JSZip from 'jszip';

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // Preview State
  const [config, setConfig] = useState<ImageExportConfig>({ format: 'image/jpeg', quality: 0.8, scale: 2 });
  const [preview, setPreview] = useState<{ dataUrl: string; width: number; height: number; sizeBytes: number } | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Generate Preview (Debounced)
  const updatePreview = useCallback(async () => {
    if (!pdfDoc) return;
    setIsGeneratingPreview(true);
    try {
      // Always preview page 1
      const res = await renderPageAsImage(pdfDoc, 0, config);
      setPreview(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [pdfDoc, config]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updatePreview, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [updatePreview]);

  // Bulk Export
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
        const base64Data = dataUrl.split(',')[1];
        zip.file(`Page-${i + 1}.${ext}`, base64Data, { base64: true });
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
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Export failed' });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 h-[calc(100vh-80px)] flex flex-col">
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="m-auto w-full max-w-xl">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to convert" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden"
          >
             {/* LEFT: SETTINGS */}
             <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                   <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold border-b border-slate-100 dark:border-slate-800 pb-3">
                      <Settings2 size={18} className="text-blue-500"/> Export Settings
                   </div>

                   {/* Format */}
                   <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Format</label>
                      <div className="grid grid-cols-3 gap-2">
                         {['image/jpeg', 'image/png', 'image/webp'].map((fmt) => (
                           <button
                             key={fmt}
                             onClick={() => setConfig({ ...config, format: fmt as any })}
                             className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                               config.format === fmt 
                                 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600' 
                                 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                             }`}
                           >
                             {fmt.split('/')[1].toUpperCase()}
                           </button>
                         ))}
                      </div>
                   </div>

                   {/* Quality Slider (JPG/WEBP only) */}
                   {config.format !== 'image/png' && (
                     <div className="space-y-2">
                        <div className="flex justify-between">
                           <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quality</label>
                           <span className="text-xs font-mono text-slate-400">{Math.round(config.quality * 100)}%</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="1" step="0.1" 
                          value={config.quality} 
                          onChange={(e) => setConfig({ ...config, quality: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                     </div>
                   )}

                   {/* Resolution */}
                   <div className="space-y-2">
                      <div className="flex justify-between">
                         <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolution (DPI)</label>
                         <span className="text-xs font-mono text-slate-400">{Math.round(config.scale * 72)} DPI</span>
                      </div>
                      <input 
                        type="range" min="1" max="4" step="0.5" 
                        value={config.scale} 
                        onChange={(e) => setConfig({ ...config, scale: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                         <span>Screen (72)</span>
                         <span>Print (300)</span>
                      </div>
                   </div>

                   {/* Stats */}
                   <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm">
                         <span className="text-slate-500">Est. File Size</span>
                         <span className="font-mono font-bold text-slate-800 dark:text-white">
                           {preview ? formatSize(preview.sizeBytes) : '...'}
                         </span>
                      </div>
                      <div className="flex justify-between text-sm">
                         <span className="text-slate-500">Dimensions</span>
                         <span className="font-mono font-bold text-slate-800 dark:text-white">
                           {preview ? `${preview.width} x ${preview.height}` : '...'}
                         </span>
                      </div>
                   </div>

                   <button 
                     onClick={handleExport}
                     disabled={status.isProcessing || !preview}
                     className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                   >
                     {status.isProcessing ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                     <span>Convert {pdfDoc?.numPages} Pages</span>
                   </button>
                </div>
             </div>

             {/* RIGHT: PREVIEW */}
             <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center p-8">
                {isGeneratingPreview && (
                   <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 className="animate-spin text-blue-500" size={40} />
                   </div>
                )}
                
                {preview ? (
                   <div className="relative shadow-2xl rounded-sm overflow-hidden max-h-full max-w-full flex">
                      <img src={preview.dataUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                         Page 1 Preview
                      </div>
                   </div>
                ) : (
                   <div className="text-slate-400 flex flex-col items-center">
                      <FileImage size={48} className="mb-2 opacity-50"/>
                      <p>Generating preview...</p>
                   </div>
                )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
