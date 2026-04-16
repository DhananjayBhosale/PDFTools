
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPdfPagePreviews } from '../../services/pdfBrowser';
import { extractPages } from '../../services/pdfDocument';
import { downloadBlob, revokeObjectUrls } from '../../services/pdfShared';
import { Loader2, Save, Undo2, Redo2, History, GripVertical, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PDFPreviewModal } from '../UI/PDFPreviewModal';

interface PageItem {
  id: string;
  index: number;
  originalIndex: number;
  url: string;
}

interface Slot {
  id: string;
  top: number;
  bottom: number;
  midY: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const ReorderPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [items, setItems] = useState<PageItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // Drag State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  
  // Preview State (Isolated)
  const [previewTarget, setPreviewTarget] = useState<{ index: number; label: string } | null>(null);
  
  // Refs for Frozen Logic
  const containerRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<Slot[]>([]);
  const dragItemRef = useRef<PageItem | null>(null);
  const isDraggingRef = useRef(false);
  const pointerYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTargetIndexRef = useRef<number | null>(null);
  const dragOverlayRectRef = useRef({ left: 0, width: 0, height: 0 });
  const dragOffsetYRef = useRef(40);

  // --- INITIALIZATION ---

  useEffect(() => {
    let cancelled = false;

    if (file) {
      setLoadingPreviews(true);
      getPdfPagePreviews(file.file)
        .then(urls => {
          if (cancelled) {
            revokeObjectUrls(urls);
            return;
          }

          const initialPages = urls.map((url, i) => ({
            id: `page-${i}`,
            index: i,
            originalIndex: i,
            url,
          }));
          setPreviewUrls(urls);
          setItems(initialPages);
          setHistory([initialPages]);
          setHistoryIndex(0);
          setLoadingPreviews(false);
        })
        .catch((error) => {
          if (cancelled) return;
          console.error(error);
          setLoadingPreviews(false);
        });
    } else {
      setItems([]);
      setPreviewUrls([]);
      setHistory([]);
      setHistoryIndex(-1);
    }

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      revokeObjectUrls(previewUrls);
    };
  }, [previewUrls]);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: f, name: f.name, size: f.size });
  };

  // --- HISTORY MANAGEMENT ---

  const commitToHistory = (newItems: PageItem[]) => {
    const current = history[historyIndex];
    // Simple deep check to avoid duplicate states
    if (current && JSON.stringify(newItems.map(p => p.id)) === JSON.stringify(current.map(p => p.id))) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newItems]);
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

  // --- DRAG & DROP LOGIC (ISOLATED) ---

  const measureSlots = () => {
    if (!containerRef.current) return;
    
    const children = Array.from(containerRef.current.children) as HTMLElement[];
    // Filter out potential overlays or temp elements if any, focus on page items
    const pageElements = children.filter(el => el.dataset.pageid);

    const newSlots: Slot[] = pageElements.map(el => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = rect.bottom + window.scrollY;
      return {
        id: el.dataset.pageid!,
        top,
        bottom,
        midY: (top + bottom) / 2
      };
    });

    // Sort strictly by Y to ensure linear logic works
    newSlots.sort((a, b) => a.top - b.top);
    slotsRef.current = newSlots;
    
    // DEBUG: Validate slots
    // console.log('Frozen Slots:', newSlots);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    e.stopPropagation();

    const item = items.find(p => p.id === id);
    if (!item) return;
    const row = containerRef.current?.querySelector<HTMLElement>(`[data-pageid="${id}"]`);
    if (!row) return;
    const rowRect = row.getBoundingClientRect();

    // 1. Freeze World
    measureSlots();
    
    // 2. Set State
    isDraggingRef.current = true;
    dragItemRef.current = item;
    setActiveId(id);
    pointerYRef.current = e.clientY;
    setDragY(e.clientY);
    lastTargetIndexRef.current = items.findIndex((entry) => entry.id === id);
    dragOverlayRectRef.current = {
      left: rowRect.left,
      width: rowRect.width,
      height: rowRect.height,
    };
    dragOffsetYRef.current = clamp(e.clientY - rowRect.top, 12, rowRect.height - 12);

    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';

    // 3. Attach Global Listeners
    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);

    const tick = () => {
      if (!isDraggingRef.current) return;
      const nextPointerY = pointerYRef.current;
      setDragY(nextPointerY);

      const docY = nextPointerY + window.scrollY;
      const slots = slotsRef.current;

      let targetIndex = slots.length;
      for (let i = 0; i < slots.length; i += 1) {
        if (docY < slots[i].midY) {
          targetIndex = i;
          break;
        }
      }

      if (lastTargetIndexRef.current !== targetIndex) {
        setItems((previous) => {
          const active = dragItemRef.current;
          if (!active) return previous;
          const currentIndex = previous.findIndex((entry) => entry.id === active.id);
          if (currentIndex === -1) return previous;

          let insertionIndex = targetIndex;
          if (targetIndex > currentIndex) insertionIndex -= 1;
          insertionIndex = clamp(insertionIndex, 0, previous.length - 1);

          if (currentIndex === insertionIndex) {
            lastTargetIndexRef.current = targetIndex;
            return previous;
          }

          const next = [...previous];
          const [moved] = next.splice(currentIndex, 1);
          next.splice(insertionIndex, 0, moved);
          lastTargetIndexRef.current = targetIndex;
          return next;
        });
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const handleGlobalMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    pointerYRef.current = e.clientY;
  }, []);

  const handleGlobalUp = useCallback(() => {
    isDraggingRef.current = false;
    dragItemRef.current = null;
    setActiveId(null);
    slotsRef.current = []; // Clear slots
    lastTargetIndexRef.current = null;
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    document.body.style.userSelect = '';
    document.body.style.touchAction = '';

    window.removeEventListener('pointermove', handleGlobalMove);
    window.removeEventListener('pointerup', handleGlobalUp);
    
    // Commit final state to history
    setItems(current => {
      commitToHistory(current);
      return current;
    });
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, [handleGlobalMove, handleGlobalUp]);

  // --- RENDER HELPERS ---

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Reordering pages...' });
    try {
      const newOrderIndices = items.map(p => p.originalIndex);
      const pdfBytes = await extractPages(file.file, newOrderIndices);
      downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `reordered-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Save failed' });
    }
  };

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 select-none">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Reorder PDF Pages</h1>
         <p className="text-slate-500 dark:text-slate-400">Drag pages to rearrange. Vertical list ensures precision.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to reorder" />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            
            {/* Toolbar */}
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

            {/* List Container - Vertical Stack */}
            <div 
              ref={containerRef}
              className="flex flex-col gap-3 min-h-[500px] relative pb-24"
            >
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                   <Loader2 className="animate-spin mb-4" size={32} />
                   <p>Generating page previews...</p>
                 </div>
               ) : (
                 items.map((item, i) => (
                  <div
                     key={item.id}
                     data-pageid={item.id}
                     className={`
                       relative flex items-center gap-4 p-3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm transition-colors group
                       ${activeId === item.id ? 'opacity-0' : 'opacity-100 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'}
                     `}
                     style={{ touchAction: 'pan-y' }}
                   >
                      <button
                        type="button"
                        onPointerDown={(e) => handlePointerDown(e, item.id)}
                        className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 active:cursor-grabbing dark:hover:bg-slate-800"
                        style={{ touchAction: 'none' }}
                        aria-label={`Drag page ${item.originalIndex + 1}`}
                      >
                        <GripVertical size={20} />
                      </button>
                      
                      <div className="w-16 h-20 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 relative">
                        <img src={item.url} alt="" className="w-full h-full object-contain" />
                        
                        {/* Thumbnail overlay for click-to-preview */}
                        <div 
                          className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center cursor-pointer"
                          onPointerDown={(e) => e.stopPropagation()} // Stop drag
                          onClick={() => setPreviewTarget({ index: item.originalIndex, label: `Page ${item.originalIndex + 1}` })}
                        />
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-bold text-slate-700 dark:text-slate-200">Page {item.originalIndex + 1}</div>
                        <div className="text-xs text-slate-400">Position {i + 1}</div>
                      </div>

                      {/* Preview Button */}
                      <button
                        onPointerDown={(e) => e.stopPropagation()} // CRITICAL: Prevent Drag
                        onClick={() => setPreviewTarget({ index: item.originalIndex, label: `Page ${item.originalIndex + 1}` })}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Preview Page"
                      >
                        <Eye size={20} />
                      </button>
                   </div>
                 ))
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
          className="fixed z-50 pointer-events-none"
          style={{
            top: dragY - dragOffsetYRef.current,
            left: dragOverlayRectRef.current.left,
            width: dragOverlayRectRef.current.width,
          }}
        >
          <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl shadow-2xl p-3 flex items-center gap-4 transform scale-[1.02] opacity-95">
             <div className="text-blue-500"><GripVertical size={20} /></div>
             <div className="w-16 h-20 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0">
                <img src={activeItem.url} alt="" className="w-full h-full object-contain" />
             </div>
             <div>
                <div className="font-bold text-slate-900 dark:text-white">Page {activeItem.originalIndex + 1}</div>
                <div className="text-xs text-blue-500 font-bold">Moving...</div>
             </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal Portal */}
      <AnimatePresence>
        {previewTarget && file && (
          <PDFPreviewModal
            file={file.file}
            pageIndex={previewTarget.index}
            pageLabel={previewTarget.label}
            onClose={() => setPreviewTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
