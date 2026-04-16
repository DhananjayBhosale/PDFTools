import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { PageThumbnail } from '../UI/PageThumbnail';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPdfPagePreviews } from '../../services/pdfBrowser';
import { extractPages } from '../../services/pdfDocument';
import { downloadBlob, revokeObjectUrls } from '../../services/pdfShared';

export const ExtractPages: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const totalPages = previews.length || file?.pageCount || 0;

  useEffect(() => {
    let cancelled = false;

    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file)
        .then((urls) => {
          if (cancelled) {
            revokeObjectUrls(urls);
            return;
          }
          setPreviews(urls);
          setSelectedPages([]);
          setLoadingPreviews(false);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error(error);
          setLoadingPreviews(false);
        });
    } else {
      setPreviews([]);
      setSelectedPages([]);
    }

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(previews);
    };
  }, [previews]);

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

  const togglePage = (index: number) => {
    setSelectedPages((prev) => (
      prev.includes(index)
        ? prev.filter((value) => value !== index)
        : [...prev, index].sort((a, b) => a - b)
    ));
  };

  const selectAll = () => {
    setSelectedPages(Array.from({ length: totalPages }, (_, index) => index));
  };

  const clearSelection = () => setSelectedPages([]);

  const handleExtract = async () => {
    if (!file || selectedPages.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Extracting selected pages...' });
    try {
      const pdfBytes = await extractPages(file.file, selectedPages);
      downloadBlob(
        new Blob([pdfBytes], { type: 'application/pdf' }),
        `${file.name.replace('.pdf', '')}-extracted-pages.pdf`,
      );
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Extraction failed' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Extract Pages</h1>
        <p className="text-slate-500 dark:text-slate-400">Pick exact pages and export them into a new PDF.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
            <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to extract pages" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-10 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">{file.name}</h3>
                  <div className="text-xs text-slate-500">{selectedPages.length} selected • {totalPages} total</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} disabled={loadingPreviews || totalPages === 0} className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Select all</button>
                <button onClick={clearSelection} disabled={selectedPages.length === 0} className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Clear</button>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[400px]">
              {loadingPreviews ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <p>Loading pages...</p>
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

            <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
              <button
                onClick={handleExtract}
                disabled={loadingPreviews || status.isProcessing || selectedPages.length === 0}
                className="pointer-events-auto shadow-2xl px-8 py-3 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                <span>Extract {selectedPages.length} Pages</span>
              </button>
            </div>
            <div className="h-24" />
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
