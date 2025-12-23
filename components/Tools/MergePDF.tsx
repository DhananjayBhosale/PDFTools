
import React, { useState, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { mergePDFs, getPDFPageCount } from '../../services/pdfService';
import { FileText, X, ArrowDown, GripVertical, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useDragReorder } from '../../hooks/useDragReorder';
import { SEOHead } from '../SEO/SEOHead';
import { FAQ, FAQItem } from '../UI/FAQ';

const faqItems: FAQItem[] = [
  {
    question: "Is it safe to merge PDF files here?",
    answer: "Yes, absolutely. ZenPDF processes all your files locally in your browser. Your files never leave your device and are never uploaded to any server."
  },
  {
    question: "Can I merge PDF files offline?",
    answer: "Yes! Since the app works entirely on your device, you can turn off your internet connection and still merge your PDF documents without any issues."
  },
  {
    question: "How many PDFs can I combine at once?",
    answer: "There is no strict limit set by the app. Performance depends on your device's memory and processor. Merging 20-30 typical files works smoothly on most devices."
  },
  {
    question: "Is this tool free?",
    answer: "Yes, ZenPDF is completely free to use. There are no hidden costs, watermarks, or subscription fees."
  }
];

export const MergePDF: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const containerRef = useRef<HTMLDivElement>(null);

  const { activeId, dragHandlers, registerItem, overlayStyle } = useDragReorder({
    items: files,
    onReorder: setFiles,
    containerRef,
    keyExtractor: (f) => f.id
  });

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

  const activeItem = files.find(f => f.id === activeId);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 select-none">
      <SEOHead 
        title="Merge PDF Files Online - Free & Private | ZenPDF"
        description="Combine multiple PDFs into one document instantly. 100% local processing, no file uploads. Secure and free PDF merger."
      />

      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Merge PDFs</h1>
         <p className="text-slate-500 dark:text-slate-400">Combine multiple PDF files into one document. Drag and drop to reorder.</p>
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

            <div ref={containerRef} className="space-y-3 relative">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  ref={(el) => registerItem(file.id, el)}
                  onPointerDown={(e) => dragHandlers.onPointerDown(e, file.id)}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4 group cursor-grab active:cursor-grabbing hover:border-blue-500/50 transition-colors touch-none ${activeId === file.id ? 'opacity-30' : 'opacity-100'}`}
                >
                  <GripVertical className="text-slate-400" />
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{file.pageCount} pages • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

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

      <div className="mt-12">
        <FAQ items={faqItems} />
      </div>

      {/* Drag Overlay */}
      {activeId && activeItem && createPortal(
         <div 
            className="fixed pointer-events-none z-50 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-2xl border-2 border-blue-500 flex items-center gap-4 w-[var(--width)]"
            style={{ 
               top: overlayStyle.top, 
               left: overlayStyle.left,
               width: overlayStyle.width,
               height: overlayStyle.height,
               transform: 'scale(1.02)'
            }}
         >
            <GripVertical className="text-slate-400" />
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg">
               <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
               <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{activeItem.name}</p>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
};
