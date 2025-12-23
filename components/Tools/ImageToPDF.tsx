
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { ProcessingStatus } from '../../types';
import { createPDFFromImages } from '../../services/pdfService';
import { X, ArrowDown, Loader2, GripVertical, FileImage, Move, LayoutTemplate } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

interface ImagePage {
  id: string;
  file: File;
  previewUrl: string;
}

export const ImageToPDF: React.FC = () => {
  const [pages, setPages] = useState<ImagePage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // Load Images
  const handleFilesSelected = async (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;

    const newPages: ImagePage[] = images.map(f => ({
      id: uuidv4(),
      file: f,
      previewUrl: URL.createObjectURL(f)
    }));

    setPages(prev => [...prev, ...newPages]);
  };

  const removePage = (id: string) => {
    setPages(prev => {
      const page = prev.find(p => p.id === id);
      if (page) URL.revokeObjectURL(page.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  };

  const handleConvert = async () => {
    if (pages.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Generating PDF...' });
    try {
      const sortedFiles = pages.map(p => p.file);
      await new Promise(r => setTimeout(r, 500)); // UX delay
      
      const pdfBytes = await createPDFFromImages(sortedFiles, { fit: 'contain', margin: 20 });
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `images-to-pdf-${Date.now()}.pdf`;
      a.click();
      
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Conversion failed' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
       <div className="mb-6 flex items-center justify-between">
         <div>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Image to PDF Builder</h1>
         </div>
         {pages.length > 0 && (
           <button onClick={() => setPages([])} className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
             Clear All
           </button>
         )}
      </div>

      <AnimatePresence mode="wait">
        {pages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto mt-10">
             <FileUpload onFilesSelected={handleFilesSelected} accept="image/*" multiple label="Drop images to start building" />
             <div className="text-center mt-6 text-slate-400 text-sm">
               <p>Drag & Drop images to reorder. Each image becomes a page.</p>
             </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-8"
          >
            {/* TOOLBAR */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between sticky top-4 z-30 shadow-lg">
               <div className="flex items-center gap-3">
                 <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-lg">
                   <LayoutTemplate size={20} />
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-900 dark:text-white">{pages.length} Pages</h3>
                   <p className="text-xs text-slate-500">Drag pages to reorder</p>
                 </div>
               </div>
               
               <button
                onClick={handleConvert}
                disabled={status.isProcessing}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <ArrowDown size={18} />}
                <span>Export PDF</span>
              </button>
            </div>

            {/* DOCUMENT GRID */}
            <div className="bg-slate-100 dark:bg-slate-950/50 p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 min-h-[60vh]">
               <Reorder.Group axis="y" values={pages} onReorder={setPages} className="flex flex-wrap gap-8 justify-center">
                  {pages.map((page, index) => (
                    <Reorder.Item 
                      key={page.id} 
                      value={page}
                      className="relative group cursor-grab active:cursor-grabbing"
                    >
                       {/* A4 Paper Container (Scaled Down) */}
                       <div className="w-[210px] h-[297px] bg-white shadow-xl relative flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 group-active:scale-105 group-active:shadow-2xl ring-1 ring-black/5">
                          {/* Page Number */}
                          <div className="absolute top-2 right-2 text-[10px] font-bold text-slate-300 z-10">
                             {index + 1}
                          </div>

                          {/* Alignment Guides (Visual decoration) */}
                          <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                             <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-400/30" />
                             <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-400/30" />
                             <div className="absolute inset-4 border border-blue-400/10 border-dashed" />
                          </div>

                          {/* Image */}
                          <img 
                            src={page.previewUrl} 
                            alt={`Page ${index + 1}`} 
                            className="max-w-[170px] max-h-[257px] object-contain shadow-sm pointer-events-none" 
                          />

                          {/* Hover Actions */}
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                             <div className="self-end">
                                <button onClick={() => removePage(page.id)} className="p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-md transform hover:scale-110 transition-transform">
                                  <X size={14} />
                                </button>
                             </div>
                             <div className="self-center bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                                <Move size={10} className="inline mr-1"/> Drag to move
                             </div>
                          </div>
                       </div>
                    </Reorder.Item>
                  ))}
               </Reorder.Group>
               
               {/* Drop Zone at bottom for more files */}
               <div className="mt-8 flex justify-center">
                 <label className="cursor-pointer px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2">
                    <FileImage size={18} /> Add more images
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleFilesSelected(Array.from(e.target.files))} />
                 </label>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
