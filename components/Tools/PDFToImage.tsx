import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPDFPageCount, getPdfPagePreviews } from '../../services/pdfService';
import { Image as ImageIcon, Loader2, Undo2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file).then(urls => { setPreviews(urls); setLoadingPreviews(false); });
    } else { setPreviews([]); }
  }, [file]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size, pageCount: await getPDFPageCount(f) });
  };

  const downloadImage = (url: string, index: number) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace('.pdf', '')}-page-${index + 1}.jpg`;
    a.click();
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">PDF to JPG</h1>
         <p className="text-slate-500 dark:text-slate-400">Convert PDF pages to high-quality images.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to convert" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
             <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex items-center gap-4 sticky top-20 z-10 shadow-sm border border-slate-200 dark:border-slate-800">
                 <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><Undo2 size={20}/></button>
                 <h3 className="font-bold text-slate-900 dark:text-white truncate">{file.name}</h3>
             </div>

             <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mb-4" size={32} /><p>Rendering pages...</p></div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                   {previews.map((url, index) => (
                     <div key={index} className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all">
                        <img src={url} alt="" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <button onClick={() => downloadImage(url, index)} className="bg-white text-slate-900 px-4 py-2 rounded-full font-bold flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                              <Download size={16} /> Save JPG
                           </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 text-center py-1 text-xs font-mono">Page {index + 1}</div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
