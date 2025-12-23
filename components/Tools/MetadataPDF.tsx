import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus, PDFMetadata } from '../../types';
import { getPDFMetadata, setPDFMetadata } from '../../services/pdfService';
import { FileSearch, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const MetadataPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [metadata, setMetadata] = useState<PDFMetadata>({});
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;

    // Load metadata immediately
    try {
      const meta = await getPDFMetadata(f);
      setMetadata(meta);
      setFile({
        id: uuidv4(),
        file: f,
        name: f.name,
        size: f.size
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Saving...' });
    
    try {
      const pdfBytes = await setPDFMetadata(file.file, metadata);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metadata-${file.name}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to save' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">PDF Metadata</h1>
         <p className="text-slate-500 dark:text-slate-400">View and edit document properties.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to view metadata" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-3 gap-8"
          >
            {/* Sidebar info */}
            <div className="md:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 h-fit">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">File Info</h3>
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Filename</label>
                  <div className="truncate">{file.name}</div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Size</label>
                  <div>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <button onClick={() => setFile(null)} className="w-full py-2 mt-4 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  Close File
                </button>
              </div>
            </div>

            {/* Editor */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <FileSearch className="text-cyan-500" /> Properties
              </h3>
              
              <div className="space-y-4">
                {['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'].map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{field}</label>
                    <input
                      type="text"
                      value={(metadata as any)[field.toLowerCase()] || ''}
                      onChange={(e) => setMetadata({ ...metadata, [field.toLowerCase()]: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={status.isProcessing}
                  className="px-8 py-3 rounded-xl font-semibold text-white bg-cyan-500 hover:bg-cyan-600 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                >
                  {status.isProcessing ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  <span>Save Metadata</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
