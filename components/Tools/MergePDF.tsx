import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { mergePDFs, getPDFPageCount } from '../../services/pdfService';
import { FileText, X, ArrowDown, GripVertical, Loader2 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const MergePDF: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (newFiles: File[]) => {
    const pdfs = newFiles.filter(f => f.type === 'application/pdf');
    if (pdfs.length === 0) return;

    const mappedFiles: PDFFile[] = await Promise.all(pdfs.map(async (f) => ({
      id: uuidv4(),
      file: f,
      name: f.name,
      size: f.size,
      pageCount: await getPDFPageCount(f)
    })));

    setFiles(prev => [...prev, ...mappedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Processing...' });
    try {
      const rawFiles = files.map(f => f.file);
      await new Promise(r => setTimeout(r, 500));
      const mergedPdfBytes = await mergePDFs(rawFiles);
      
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged-${new Date().getTime()}.pdf`;
      a.click();
      
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Merge failed' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Merge PDFs</h1>
         <p className="text-slate-500 dark:text-slate-400">Combine multiple PDF files into one document.</p>
      </div>

      <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" multiple label="Drop PDFs here to merge" />

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8 space-y-4"
          >
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 px-2">
              <span>{files.length} files selected</span>
              <button onClick={() => setFiles([])} className="text-rose-500 hover:text-rose-600 font-medium">Clear All</button>
            </div>

            <Reorder.Group axis="y" values={files} onReorder={setFiles} className="space-y-3">
              {files.map((file) => (
                <Reorder.Item key={file.id} value={file}>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 group cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors">
                    <GripVertical className="text-slate-400" />
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{file.pageCount} pages • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={() => removeFile(file.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleMerge}
                disabled={files.length < 2 || status.isProcessing}
                className="px-8 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:bg-slate-400"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />}
                <span>Merge PDF</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
