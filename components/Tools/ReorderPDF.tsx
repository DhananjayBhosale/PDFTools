import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPDFPageCount, getPdfPagePreviews, extractPages } from '../../services/pdfService';
import { Move, Loader2, Save, Undo2, Redo2, History } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

interface PageItem {
  id: string;
  index: number;
  url: string;
}

export const ReorderPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // State
  const [pages, setPages] = useState<PageItem[]>([]);
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for Auto-Scroll
  const pointerY = useRef<number | null>(null);
  const scrollInterval = useRef<number | null>(null);

  // Keyboard support for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Load File
  useEffect(() => {
    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file).then(urls => {
        const initialPages = urls.map((url, index) => ({ id: `page-${index}`, index, url }));
        setPages(initialPages);
        // Reset History
        setHistory([initialPages]);
        setHistoryIndex(0);
        setLoadingPreviews(false);
      });
    } else {
      setPages([]);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [file]);

  // Auto-Scroll Logic
  useEffect(() => {
    const updatePointer = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) {
        pointerY.current = e.touches[0].clientY;
      } else {
        pointerY.current = (e as MouseEvent).clientY;
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', updatePointer);
      window.addEventListener('touchmove', updatePointer, { passive: false });
      
      const scrollLoop = () => {
        if (pointerY.current !== null) {
          const y = pointerY.current;
          const winH = window.innerHeight;
          const topZone = 120; // px from top
          const bottomZone = 120; // px from bottom
          const maxSpeed = 15; // px per frame

          if (y < topZone) {
            // Scroll Up
            const intensity = (topZone - y) / topZone;
            window.scrollBy(0, -maxSpeed * intensity);
          } else if (y > winH - bottomZone) {
            // Scroll Down
            const intensity = (y - (winH - bottomZone)) / bottomZone;
            window.scrollBy(0, maxSpeed * intensity);
          }
        }
        scrollInterval.current = requestAnimationFrame(scrollLoop);
      };
      
      scrollInterval.current = requestAnimationFrame(scrollLoop);
    } else {
      if (scrollInterval.current) cancelAnimationFrame(scrollInterval.current);
      window.removeEventListener('mousemove', updatePointer);
      window.removeEventListener('touchmove', updatePointer);
    }

    return () => {
      if (scrollInterval.current) cancelAnimationFrame(scrollInterval.current);
      window.removeEventListener('mousemove', updatePointer);
      window.removeEventListener('touchmove', updatePointer);
    };
  }, [isDragging]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size, pageCount: await getPDFPageCount(f) });
  };

  const commitToHistory = (newPages: PageItem[]) => {
    // Check if changed
    const current = history[historyIndex];
    if (JSON.stringify(newPages.map(p => p.id)) === JSON.stringify(current.map(p => p.id))) {
      return; // No change
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPages);
    
    // Cap history
    if (newHistory.length > 20) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setPages(history[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setPages(history[nextIndex]);
      setHistoryIndex(nextIndex);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Reordering pages...' });
    try {
      const newOrderIndices = pages.map(p => p.index);
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

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Reorder PDF Pages</h1>
         <p className="text-slate-500 dark:text-slate-400">Drag pages to rearrange. Drag near edges to auto-scroll.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to reorder" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            
            {/* Sticky Toolbar */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between sticky top-4 z-40 shadow-lg border border-slate-200 dark:border-slate-800 ring-1 ring-black/5">
               
               <div className="flex items-center gap-4 min-w-0">
                 <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500" title="Change File">
                   <History size={20}/>
                 </button>
                 
                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                 
                 <div className="flex items-center gap-2">
                   <button 
                    onClick={handleUndo} 
                    disabled={historyIndex <= 0}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Undo (Ctrl+Z)"
                   >
                     <Undo2 size={20}/>
                   </button>
                   <button 
                    onClick={handleRedo} 
                    disabled={historyIndex >= history.length - 1}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Redo (Ctrl+Shift+Z)"
                   >
                     <Redo2 size={20}/>
                   </button>
                 </div>

                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                 
                 <h3 className="font-bold text-slate-900 dark:text-white truncate hidden md:block max-w-[200px]">{file.name}</h3>
               </div>

               <button 
                 onClick={handleSave} 
                 disabled={status.isProcessing} 
                 className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
               >
                 {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                 <span className="hidden sm:inline">Save Order</span>
                 <span className="sm:hidden">Save</span>
               </button>
            </div>

            {/* Reorder Area */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[500px] relative">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                   <Loader2 className="animate-spin mb-4" size={32} />
                   <p>Generating previews...</p>
                 </div>
               ) : (
                 <Reorder.Group 
                  axis="y" 
                  values={pages} 
                  onReorder={setPages} 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                 >
                   {pages.map((page) => (
                     <Reorder.Item 
                       key={page.id} 
                       value={page} 
                       onDragStart={() => setIsDragging(true)}
                       onDragEnd={() => {
                         setIsDragging(false);
                         commitToHistory(pages);
                       }}
                       className="touch-none cursor-grab active:cursor-grabbing relative group"
                     >
                        <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-blue-400 transition-colors transform active:scale-105 active:shadow-xl duration-200">
                          <img src={page.url} alt="" className="w-full h-full object-contain p-2 pointer-events-none" />
                          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-xs py-1.5 text-center font-mono">
                            Page {page.index + 1}
                          </div>
                        </div>
                     </Reorder.Item>
                   ))}
                 </Reorder.Group>
               )}
            </div>
            
            <div className="text-center text-xs text-slate-400 pb-8">
              {historyIndex + 1} / {history.length} history states
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};