import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPdfPagePreviews, addWatermarkToPage } from '../../services/pdfService';
import { PenTool, Loader2, Save, Undo2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

export const EditPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [activePage, setActivePage] = useState<number | null>(null);
  const [textInput, setTextInput] = useState('My Annotation');

  useEffect(() => {
    if (file) {
      getPdfPagePreviews(file.file).then(setPreviews);
    }
  }, [file]);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: files[0], name: files[0].name, size: files[0].size });
  };

  const handleApply = async () => {
    if (!file || activePage === null) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying text...' });
    try {
      const pdfBytes = await addWatermarkToPage(file.file, textInput, activePage, 0.5, 0.5); // Center
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-${file.name}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) { setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed' }); }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Edit PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Add text annotations to your document.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to edit" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
             <div className="bg-white dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center shadow-sm border border-slate-200 dark:border-slate-800">
               <button onClick={() => setFile(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800"><Undo2 size={16}/> Change File</button>
               <div className="flex gap-2">
                 <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 dark:border-slate-700" placeholder="Text to add" />
                 <button onClick={handleApply} disabled={activePage === null || status.isProcessing} className="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-pink-600 disabled:opacity-50">
                    {status.isProcessing ? <Loader2 className="animate-spin"/> : <Save size={16}/>} Add to Selected Page
                 </button>
               </div>
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {previews.map((url, index) => (
                 <div key={index} onClick={() => setActivePage(index)} className={`relative cursor-pointer border-2 rounded-xl overflow-hidden ${activePage === index ? 'border-pink-500 ring-2 ring-pink-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                   <img src={url} alt="" className="w-full h-auto" />
                   {activePage === index && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="bg-pink-500 text-white text-xs px-2 py-1 rounded">Target</span></div>}
                 </div>
               ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
