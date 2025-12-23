import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { protectPDF, getPDFPageCount } from '../../services/pdfService';
import { Lock, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const SecurityPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;

    setFile({
      id: uuidv4(),
      file: f,
      name: f.name,
      size: f.size,
      pageCount: await getPDFPageCount(f)
    });
  };

  const handleProtect = async () => {
    if (!file || !password) return;
    
    setStatus({ isProcessing: true, progress: 10, message: 'Encrypting...' });
    
    try {
      await new Promise(r => setTimeout(r, 800)); // UX delay
      const pdfBytes = await protectPDF(file.file, password);
      
      setStatus({ isProcessing: true, progress: 100, message: 'Done!' });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `protected-${file.name}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 0, message: '' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Encryption failed' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Protect PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Encrypt your PDF with a password locally.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to protect" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{file.name}</h3>

            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Set Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter strong password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleProtect}
                disabled={status.isProcessing || !password}
                className="w-full px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Lock size={20} />}
                <span>Encrypt PDF</span>
              </button>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-slate-800 text-sm font-medium py-2">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
