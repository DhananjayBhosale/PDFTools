import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { flattenPDF } from '../../services/pdfService';
import { Maximize, Loader2, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const FlattenPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: files[0], name: files[0].name, size: files[0].size });
  };

  const handleFlatten = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Flattening forms...' });
    try {
      const pdfBytes = await flattenPDF(file.file);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flattened-${file.name}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) { setStatus({ isProcessing: false, progress: 0, message: '', error: 'Error flattening' }); }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Flatten PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Merge form fields and layers into a single document.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to flatten" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileCheck size={32} /></div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{file.name}</h3>
            <p className="text-slate-500 text-sm mb-6">Ready to make form fields un-editable and merge layers?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleFlatten} disabled={status.isProcessing} className="w-full px-8 py-3 rounded-xl font-semibold text-white bg-slate-700 hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Maximize size={20} />} <span>Flatten PDF</span>
              </button>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-800 text-sm font-medium py-2">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
