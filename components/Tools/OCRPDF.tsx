import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { extractTextFromPDF } from '../../services/pdfService';
import { ScanText, Copy, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const OCRPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    const f = files[0];
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size });
    setStatus({ isProcessing: true, progress: 10, message: 'Extracting text...' });
    
    try {
      const extracted = await extractTextFromPDF(f);
      setText(extracted);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (e) {
      setText("Could not extract text. The PDF might be an image-only scan without a text layer.");
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Extraction failed' });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">OCR Text Extractor</h1>
         <p className="text-slate-500 dark:text-slate-400">Extract text content from your PDF files.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to extract text" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
             <div className="flex items-center justify-between">
                <button onClick={() => { setFile(null); setText(''); }} className="flex items-center gap-2 text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Extract another</button>
                <button onClick={copyToClipboard} className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium hover:bg-blue-200 transition-colors">
                  <Copy size={16} /> Copy All
                </button>
             </div>
             
             {status.isProcessing ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                 <Loader2 className="animate-spin mb-4" size={32} />
                 <p>Scanning document...</p>
               </div>
             ) : (
               <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm min-h-[400px]">
                 <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 dark:text-slate-300">{text || "No text found."}</pre>
               </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
