import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { getPdfPagePreviews } from '../../services/pdfService';
import { GitCompare, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

export const ComparePDF: React.FC = () => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [preview1, setPreview1] = useState<string>('');
  const [preview2, setPreview2] = useState<string>('');

  useEffect(() => {
    if (file1) getPdfPagePreviews(file1).then(p => setPreview1(p[0]));
    if (file2) getPdfPagePreviews(file2).then(p => setPreview2(p[0]));
  }, [file1, file2]);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Compare PDFs</h1>
         <p className="text-slate-500 dark:text-slate-400">Visual side-by-side comparison of two documents.</p>
      </div>

      <AnimatePresence mode="wait">
        {(!file1 || !file2) ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-8">
             <div>
               <h3 className="font-bold mb-4 text-center text-slate-500">Document A</h3>
               <FileUpload onFilesSelected={f => f.length && setFile1(f[0])} accept=".pdf" label={file1 ? file1.name : "Upload First PDF"} />
             </div>
             <div>
               <h3 className="font-bold mb-4 text-center text-slate-500">Document B</h3>
               <FileUpload onFilesSelected={f => f.length && setFile2(f[0])} accept=".pdf" label={file2 ? file2.name : "Upload Second PDF"} />
             </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
             <button onClick={() => { setFile1(null); setFile2(null); }} className="self-center flex items-center gap-2 text-slate-500 hover:text-slate-900 bg-white dark:bg-slate-800 px-4 py-2 rounded-full border shadow-sm"><Undo2 size={16}/> Reset Comparison</button>
             
             <div className="grid md:grid-cols-2 gap-8">
               <div className="flex flex-col gap-2">
                 <div className="font-bold text-center bg-slate-100 dark:bg-slate-800 py-2 rounded-lg">{file1.name}</div>
                 <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 p-4 min-h-[500px]">
                   {preview1 && <img src={preview1} className="w-full h-auto shadow-md" alt="Doc 1" />}
                 </div>
               </div>
               <div className="flex flex-col gap-2">
                 <div className="font-bold text-center bg-slate-100 dark:bg-slate-800 py-2 rounded-lg">{file2.name}</div>
                 <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 p-4 min-h-[500px]">
                   {preview2 && <img src={preview2} className="w-full h-auto shadow-md" alt="Doc 2" />}
                 </div>
               </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
