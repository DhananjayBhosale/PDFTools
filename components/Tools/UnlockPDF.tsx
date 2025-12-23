import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { unlockPDF } from '../../services/pdfService';
import { Unlock, Lock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const UnlockPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size });
  };

  const handleUnlock = async () => {
    if (!file || !password) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Decrypting...' });
    try {
      const pdfBytes = await unlockPDF(file.file, password);
      setStatus({ isProcessing: true, progress: 100, message: 'Done!' });
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unlocked-${file.name}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 0, message: '' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Incorrect password or failed to unlock.' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Unlock PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Remove password protection from your PDF.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop locked PDF" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock size={32} /></div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{file.name}</h3>
            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Enter Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="File password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-lime-500 outline-none" />
              {status.error && <p className="text-rose-500 text-sm mt-2">{status.error}</p>}
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleUnlock} disabled={status.isProcessing || !password} className="w-full px-8 py-3 rounded-xl font-semibold text-white bg-lime-600 hover:bg-lime-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Unlock size={20} />} <span>Unlock PDF</span>
              </button>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-800 text-sm font-medium py-2">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
