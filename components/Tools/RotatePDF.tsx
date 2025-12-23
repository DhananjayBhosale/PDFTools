import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { rotateSpecificPages, getPDFPageCount, getPdfPagePreviews } from '../../services/pdfService';
import { RotateCw, FileText, Loader2, Undo2, CheckSquare, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { PageThumbnail } from '../UI/PageThumbnail';

export const RotatePDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({}); // Map pageIndex -> rotation
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // Load previews
  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file)
        .then(urls => {
          setPreviews(urls);
          setLoadingPreviews(false);
          // Initialize rotations to 0
          const initialRotations: Record<number, number> = {};
          for(let i=0; i < (file.pageCount || 0); i++) initialRotations[i] = 0;
          setPageRotations(initialRotations);
        })
        .catch(err => {
          console.error(err);
          setLoadingPreviews(false);
        });
    } else {
      setPreviews([]);
      setPageRotations({});
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
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const selectAll = () => {
    if (file && file.pageCount) {
      setSelectedPages(Array.from({ length: file.pageCount }, (_, i) => i));
    }
  };

  const rotateSelected = (angle: 90 | -90) => {
    setPageRotations(prev => {
      const next = { ...prev };
      const pagesToRotate = selectedPages.length > 0 
        ? selectedPages 
        : Array.from({ length: file?.pageCount || 0 }, (_, i) => i); // Rotate all if none selected

      pagesToRotate.forEach(index => {
        next[index] = (next[index] || 0) + angle;
      });
      return next;
    });
  };

  const resetRotation = () => {
    const next: Record<number, number> = {};
    for(let i=0; i < (file?.pageCount || 0); i++) next[i] = 0;
    setPageRotations(next);
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying rotations...' });
    
    try {
      // Convert map to array of rotations
      const rotationArray = Object.entries(pageRotations)
        .filter(([_, rot]) => (rot as number) % 360 !== 0)
        .map(([idx, rot]) => ({ pageIndex: parseInt(idx), rotation: rot as number }));

      if (rotationArray.length === 0) {
        setStatus({ isProcessing: false, progress: 0, message: '', error: 'No changes to save' });
        return;
      }

      const pdfBytes = await rotateSpecificPages(file.file, rotationArray);
      
      setStatus({ isProcessing: true, progress: 100, message: 'Done!' });

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotated-${file.name}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 0, message: '' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Rotation failed' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Rotate PDF Pages</h1>
         <p className="text-slate-500 dark:text-slate-400">Select pages and rotate them individually or all at once.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to rotate" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-6"
          >
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-20 z-10">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
                  <Undo2 size={20} />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">{file.name}</h3>
                  <div className="text-xs text-slate-500">{selectedPages.length > 0 ? `${selectedPages.length} selected` : 'Select pages to rotate'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                 <button onClick={() => rotateSelected(-90)} className="px-3 py-2 text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 rounded-lg flex items-center gap-2 whitespace-nowrap">
                   <RotateCw className="-scale-x-100" size={16} /> Left 90°
                 </button>
                 <button onClick={() => rotateSelected(90)} className="px-3 py-2 text-xs font-bold bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 rounded-lg flex items-center gap-2 whitespace-nowrap">
                   <RotateCw size={16} /> Right 90°
                 </button>
                 <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                 <button onClick={resetRotation} className="text-slate-500 hover:text-slate-800 text-xs font-medium px-2 whitespace-nowrap">
                   Reset
                 </button>
              </div>
            </div>

            {/* Visual Grid */}
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
                       rotation={pageRotations[index] || 0}
                     />
                   ))}
                 </div>
               )}
            </div>

            {/* Save Action */}
            <div className="fixed bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
              <button
                onClick={handleSave}
                disabled={status.isProcessing}
                className="pointer-events-auto shadow-2xl px-8 py-3 rounded-xl font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:bg-slate-500 scale-110"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                <span>Apply Changes & Download</span>
              </button>
            </div>
            
            <div className="h-24" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};