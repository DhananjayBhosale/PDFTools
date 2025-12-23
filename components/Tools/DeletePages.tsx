import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPDFPageCount, getPdfPagePreviews, extractPages } from '../../services/pdfService';
import { Trash2, Loader2, Undo2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { PageThumbnail } from '../UI/PageThumbnail';

export const DeletePages: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [pagesToDelete, setPagesToDelete] = useState<number[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file).then(urls => { setPreviews(urls); setLoadingPreviews(false); });
    } else { setPreviews([]); setPagesToDelete([]); }
  }, [file]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size, pageCount: await getPDFPageCount(f) });
  };

  const togglePage = (idx: number) => {
    setPagesToDelete(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const handleDelete = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Removing pages...' });
    try {
      const totalPages = file.pageCount || previews.length;
      const keepIndices = Array.from({ length: totalPages }, (_, i) => i).filter(i => !pagesToDelete.includes(i));
      const pdfBytes = await extractPages(file.file, keepIndices);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deleted-${file.name}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) { setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to delete' }); }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Delete PDF Pages</h1>
         <p className="text-slate-500 dark:text-slate-400">Click on pages to mark them for deletion.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to delete pages" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex items-center justify-between sticky top-20 z-10 shadow-sm border border-slate-200 dark:border-slate-800">
               <div className="flex items-center gap-4">
                 <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><Undo2 size={20}/></button>
                 <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{file.name}</h3>
                 <span className="text-sm text-rose-500 font-medium">{pagesToDelete.length} marked for deletion</span>
               </div>
               <button onClick={handleDelete} disabled={pagesToDelete.length === 0 || status.isProcessing} className="px-6 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-colors flex items-center gap-2 disabled:opacity-50">
                 {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>} Apply Deletion
               </button>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[400px]">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mb-4" size={32} /><p>Loading pages...</p></div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {previews.map((url, index) => (
                     <div key={index} onClick={() => togglePage(index)} className={`relative cursor-pointer transition-all duration-200 ${pagesToDelete.includes(index) ? 'opacity-50 grayscale scale-95' : 'hover:-translate-y-1'}`}>
                        <div className={`rounded-lg overflow-hidden border-2 ${pagesToDelete.includes(index) ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}>
                           <img src={url} alt="" className="w-full h-auto" />
                           {pagesToDelete.includes(index) && (
                             <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20">
                               <div className="bg-rose-500 text-white p-2 rounded-full"><Trash2 size={24}/></div>
                             </div>
                           )}
                        </div>
                        <div className="text-center mt-2 text-xs font-mono text-slate-500">Page {index + 1}</div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
            <div className="h-24"/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
