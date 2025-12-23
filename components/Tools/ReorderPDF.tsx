
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPDFPageCount, getPdfPagePreviews, extractPages } from '../../services/pdfService';
import { Loader2, Save, Undo2, Redo2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useDragReorder } from '../../hooks/useDragReorder';

interface PageItem {
  id: string;
  index: number;
  originalIndex: number;
  url: string;
}

export const ReorderPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // History State
  const [items, setItems] = useState<PageItem[]>([]);
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);

  // Use Shared Engine
  const { activeId, dragHandlers, registerItem, overlayStyle } = useDragReorder({
    items,
    onReorder: (newItems) => {
        setItems(newItems);
        // We commit to history on drag end in the engine usually, but engine triggers onReorder live.
        // We will simple debounce commit or commit on mouse up logic.
        // For simplicity with this hook, we assume live update. 
        // We'll manage history in a useEffect derived from drag state if needed, or just commit every change (spammy).
        // Better: Hook doesn't expose dragEnd event. 
        // We can check if activeId becomes null.
    },
    containerRef,
    keyExtractor: (i) => i.id
  });
  
  // Track previous activeId to commit history on drop
  const prevActiveId = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveId.current && !activeId) {
       // Drag ended
       commitToHistory(items);
    }
    prevActiveId.current = activeId;
  }, [activeId, items]);

  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file).then(urls => {
        const initialPages = urls.map((url, i) => ({ 
          id: `page-${i}`, 
          index: i, 
          originalIndex: i, 
          url 
        }));
        setItems(initialPages);
        setHistory([initialPages]);
        setHistoryIndex(0);
        setLoadingPreviews(false);
      });
    } else {
      setItems([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [file]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size, pageCount: await getPDFPageCount(f) });
  };

  const commitToHistory = (newItems: PageItem[]) => {
    const current = history[historyIndex];
    if (current && JSON.stringify(newItems.map(p => p.id)) === JSON.stringify(current.map(p => p.id))) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setItems(history[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setItems(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Reordering pages...' });
    try {
      const newOrderIndices = items.map(p => p.originalIndex);
      const pdfBytes = await extractPages(file.file, newOrderIndices);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reordered-${file.name}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Save failed' });
    }
  };

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 select-none">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Reorder PDF Pages</h1>
         <p className="text-slate-500 dark:text-slate-400">Drag pages to rearrange. Drag to edges to auto-scroll.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to reorder" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between sticky top-4 z-40 shadow-lg border border-slate-200 dark:border-slate-800 ring-1 ring-black/5">
               <div className="flex items-center gap-4 min-w-0">
                 <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500" title="Change File"><History size={20}/></button>
                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                 <div className="flex items-center gap-2">
                   <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><Undo2 size={20}/></button>
                   <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><Redo2 size={20}/></button>
                 </div>
                 <h3 className="font-bold text-slate-900 dark:text-white truncate hidden md:block max-w-[200px] ml-2">{file.name}</h3>
               </div>
               <button onClick={handleSave} disabled={status.isProcessing} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20">
                 {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} <span className="hidden sm:inline">Save</span>
               </button>
            </div>

            <div ref={containerRef} className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[500px] relative">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Loader2 className="animate-spin mb-4" size={32} /><p>Generating previews...</p></div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {items.map((item) => (
                     <div
                       key={item.id}
                       ref={(el) => registerItem(item.id, el)}
                       onPointerDown={(e) => dragHandlers.onPointerDown(e, item.id)}
                       className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 bg-white dark:bg-slate-800 shadow-sm
                         border-slate-200 dark:border-slate-700 hover:border-blue-400
                         touch-none cursor-grab active:cursor-grabbing
                         ${activeId === item.id ? 'opacity-0' : 'opacity-100'}
                       `}
                     >
                        <img src={item.url} alt="" className="w-full h-full object-contain p-2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-xs py-1.5 text-center font-mono pointer-events-none">
                          Page {item.originalIndex + 1}
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
            
            <div className="text-center text-xs text-slate-400 pb-8">
              {historyIndex + 1} / {history.length} states • Drag to reorder
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag Overlay Portal */}
      {activeId && activeItem && createPortal(
        <div 
          className="fixed pointer-events-none z-50 rounded-lg overflow-hidden border-2 border-blue-500 bg-white dark:bg-slate-800 shadow-2xl"
          style={{ 
            left: overlayStyle.left, 
            top: overlayStyle.top, 
            width: overlayStyle.width, 
            height: overlayStyle.height,
            transform: 'scale(1.05)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <img src={activeItem.url} alt="" className="w-full h-full object-contain p-2" />
          <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-xs py-1.5 text-center font-bold">
            Moving Page {activeItem.originalIndex + 1}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
