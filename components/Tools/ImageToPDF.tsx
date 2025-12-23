import React, { useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { createPDFFromImages } from '../../services/pdfService';
import { X, ArrowDown, Loader2 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const ImageToPDF: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;

    const mappedFiles: PDFFile[] = await Promise.all(images.map(async (f) => ({
      id: uuidv4(),
      file: f,
      name: f.name,
      size: f.size,
      previewUrl: URL.createObjectURL(f)
    })));

    setFiles(prev => [...prev, ...mappedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleConvert = async () => {
    if (files.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Processing...' });
    try {
      const rawFiles = files.map(f => f.file);
      await new Promise(r => setTimeout(r, 500));
      const pdfBytes = await createPDFFromImages(rawFiles);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `images-${new Date().getTime()}.pdf`;
      a.click();
      
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Conversion failed' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
       <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Images to PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Convert photos and images into a PDF.</p>
      </div>

      <FileUpload onFilesSelected={handleFilesSelected} accept="image/*" multiple label="Drop images here" />

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-8 space-y-4"
          >
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 px-2">
              <span>{files.length} images selected</span>
              <button onClick={() => setFiles([])} className="text-rose-500 hover:text-rose-600 font-medium">Clear All</button>
            </div>

            <Reorder.Group axis="y" values={files} onReorder={setFiles} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {files.map((file) => (
                <Reorder.Item key={file.id} value={file} className="relative group cursor-grab active:cursor-grabbing">
                   <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 relative hover:border-purple-500/50 transition-colors">
                     {file.previewUrl && (
                       <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                     )}
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                       <button onClick={() => removeFile(file.id)} className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-lg">
                         <X size={18} />
                       </button>
                     </div>
                     <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/70 text-white text-[10px] truncate backdrop-blur-sm">
                        {file.name}
                     </div>
                   </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleConvert}
                disabled={files.length === 0 || status.isProcessing}
                className="px-8 py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:bg-slate-400"
              >
                {status.isProcessing ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />}
                <span>Convert PDF</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
