import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Wrench } from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { repairPDF } from '../../services/pdfDocument';
import { downloadBlob } from '../../services/pdfShared';

export const RepairPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    const selected = files[0];
    setFile({
      id: uuidv4(),
      file: selected,
      name: selected.name,
      size: selected.size,
    });
  };

  const handleRepair = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Re-saving PDF structure...' });
    try {
      const bytes = await repairPDF(file.file);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `repaired-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Repair failed' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Repair PDF</h1>
        <p className="text-slate-500 dark:text-slate-400">Re-save readable PDFs to fix minor structural compatibility issues.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to repair" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wrench size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{file.name}</h3>
            <p className="text-slate-500 text-sm mb-6">This rebuilds and re-saves the file without changing content.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRepair}
                disabled={status.isProcessing}
                className="w-full px-8 py-3 rounded-xl font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Wrench size={20} />}
                <span>Repair PDF</span>
              </button>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-800 text-sm font-medium py-2">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status.error && (
        <div className="fixed bottom-3 right-3 bg-rose-600 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
          {status.error}
        </div>
      )}
    </div>
  );
};
