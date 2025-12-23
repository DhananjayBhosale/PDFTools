
import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { splitPDF, getPDFPageCount, getPdfPagePreviews, extractPages } from '../../services/pdfService';
import { Scissors, FileText, Loader2, CheckSquare, Square, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { PageThumbnail } from '../UI/PageThumbnail';
import { SEOHead } from '../SEO/SEOHead';
import { FAQ, FAQItem } from '../UI/FAQ';

const faqItems: FAQItem[] = [
  {
    question: "Can I extract specific pages?",
    answer: "Yes, you can select individual pages to extract into a new PDF, or split the entire document into separate single-page files."
  },
  {
    question: "Is there a page limit?",
    answer: "ZenPDF can handle large documents. However, for very large files (500+ pages), performance depends on your device's memory since processing is local."
  },
  {
    question: "Does it work on Mac and Windows?",
    answer: "Yes, ZenPDF works in any modern web browser (Chrome, Edge, Firefox, Safari) on any operating system, including mobile."
  }
];

export const SplitPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  // Load previews when file changes
  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file)
        .then(urls => {
          setPreviews(urls);
          setLoadingPreviews(false);
          setSelectedPages([]);
        })
        .catch(err => {
          console.error("Failed to load previews", err);
          setLoadingPreviews(false);
        });
    } else {
      setPreviews([]);
      setSelectedPages([]);
    }
  }, [file]);

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

  const togglePage = (index: number) => {
    setSelectedPages(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const selectAll = () => {
    if (file && file.pageCount) {
      setSelectedPages(Array.from({ length: file.pageCount }, (_, i) => i));
    }
  };

  const deselectAll = () => setSelectedPages([]);

  const handleSplitAll = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Splitting into individual files...' });
    try {
      const zipBlob = await splitPDF(file.file);
      setStatus({ isProcessing: true, progress: 100, message: 'Done!' });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}-all-pages.zip`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 0, message: '' });
    } catch (error) {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Split failed' });
    }
  };

  const handleExtractSelected = async () => {
    if (!file || selectedPages.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Extracting pages...' });
    try {
      const pdfBytes = await extractPages(file.file, selectedPages);
      setStatus({ isProcessing: true, progress: 100, message: 'Done!' });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace('.pdf', '')}-extracted.pdf`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 0, message: '' });
    } catch (error) {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Extraction failed' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <SEOHead 
        title="Split PDF Pages - Extract & Separate Online | ZenPDF"
        description="Split PDF files or extract specific pages securely in your browser. No server uploads. Free offline PDF splitter."
      />

      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Split & Extract PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Extract specific pages or split the entire document.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to split" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Header / Toolbar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-10">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                  <FileText size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{file.name}</h3>
                  <div className="text-xs text-slate-500">{file.pageCount} pages</div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <button onClick={selectAll} className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors">
                   <CheckSquare size={14} /> Select All
                 </button>
                 <button onClick={deselectAll} className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors">
                   <Square size={14} /> Deselect
                 </button>
                 <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                 <button onClick={() => setFile(null)} className="text-rose-500 hover:text-rose-600 text-sm font-medium px-2">
                   Change File
                 </button>
              </div>
            </div>

            {/* Visual Grid */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[400px]">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                   <Loader2 className="animate-spin mb-4" size={32} />
                   <p>Generating page previews...</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {previews.map((url, index) => (
                     <PageThumbnail
                       key={index}
                       pageIndex={index}
                       imageUrl={url}
                       isSelected={selectedPages.includes(index)}
                       onToggle={() => togglePage(index)}
                     />
                   ))}
                 </div>
               )}
            </div>

            {/* Actions Footer */}
            <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
              <div className="bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex items-center gap-3 pointer-events-auto scale-90 sm:scale-100 transform transition-transform">
                 <button
                   onClick={handleExtractSelected}
                   disabled={selectedPages.length === 0 || status.isProcessing}
                   className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:bg-slate-500"
                 >
                   {status.isProcessing && selectedPages.length > 0 ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                   <span>Extract {selectedPages.length} Pages</span>
                 </button>
                 
                 <div className="text-slate-300 dark:text-slate-700">or</div>

                 <button
                   onClick={handleSplitAll}
                   disabled={status.isProcessing}
                   className="px-6 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                 >
                   {status.isProcessing && selectedPages.length === 0 ? <Loader2 className="animate-spin" /> : <Scissors size={20} />}
                   <span>Split All to ZIP</span>
                 </button>
              </div>
            </div>
            
            {/* Spacer for fixed footer */}
            <div className="h-24" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-12">
        <FAQ items={faqItems} />
      </div>
    </div>
  );
};
