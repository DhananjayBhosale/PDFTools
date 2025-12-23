import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPDFPageCount, getPdfPagePreviews, extractPages } from '../../services/pdfService';
import { Loader2, Save, Undo2, Redo2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';

interface PageItem {
  id: string;
  index: number;
  originalIndex: number; // For PDF extraction mapping
  url: string;
}

// 1. Define the Slot Type for the Grid Model
interface Slot {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const ReorderPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  // State for Pages and History
  const [items, setItems] = useState<PageItem[]>([]);
  const [history, setHistory] = useState<PageItem[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Dragging State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlayStyle, setOverlayStyle] = useState({ top: 0, left: 0, width: 0, height: 0 });

  // Refs for Logic (Stable across renders)
  const itemsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragIdRef = useRef<string | null>(null);
  const slotsRef = useRef<Slot[]>([]); // 2. Store Slot Rects instead of Centers
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const scrollIntervalRef = useRef<number | null>(null);
  const pointerPosRef = useRef<{ x: number, y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTargetIndexRef = useRef<number | null>(null);

  // 1. Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? handleRedo() : handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // 2. Initial Load
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

  // --- HISTORY LOGIC ---

  const commitToHistory = (newItems: PageItem[]) => {
    const current = history[historyIndex];
    if (current && JSON.stringify(newItems.map(p => p.id)) === JSON.stringify(current.map(p => p.id))) {
      return; 
    }
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

  // --- DRAG & DROP ENGINE (GRID SLOT MODEL) ---

  const getTargetIndex = (docX: number, docY: number): number => {
    const slots = slotsRef.current;
    
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];

      const isInRow = docY >= s.top && docY <= s.bottom;
      const isAboveRow = docY < s.top;
      
      // 1. If we are strictly above a row, we insert at the start of that row
      if (isAboveRow) {
        return i;
      }

      // 2. If we are inside a row, we check horizontal position
      if (isInRow) {
        // Calculate center X of the slot
        const centerX = s.left + (s.right - s.left) / 2;
        if (docX < centerX) {
          return i;
        }
      }
    }

    // 3. If we are below all slots, return the length (append to end)
    return slots.length;
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const el = itemsRef.current.get(id);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    
    // 1. Capture Offset for smooth visual drag
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    dragOffsetRef.current = { x: offsetX, y: offsetY };

    // 2. Initialize Overlay
    setOverlayStyle({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });
    
    // 3. FREEZE SLOTS (Document Coordinates)
    // We capture specific slot rectangles for every item EXCEPT the dragged one.
    const frozenSlots: Slot[] = [];
    items.forEach((p) => {
      if (p.id === id) return; // Skip dragged item

      const node = itemsRef.current.get(p.id);
      if (node) {
        const r = node.getBoundingClientRect();
        frozenSlots.push({
          top: r.top + window.scrollY,
          bottom: r.bottom + window.scrollY,
          left: r.left + window.scrollX,
          right: r.right + window.scrollX,
        });
      }
    });

    // Sort slots visually: Top-to-Bottom, then Left-to-Right
    // This creates a linear representation of the grid
    slotsRef.current = frozenSlots.sort((a, b) => {
       // Allow small sub-pixel tolerance for row alignment
       if (Math.abs(a.top - b.top) > 5) {
         return a.top - b.top;
       }
       return a.left - b.left;
    });

    // 4. Set Active State
    setActiveId(id);
    dragIdRef.current = id;
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    lastTargetIndexRef.current = null;

    // 5. Attach Listeners
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    // 6. Start AutoScroll Loop
    startAutoScroll();
  };

  const handlePointerMove = (e: PointerEvent) => {
    pointerPosRef.current = { x: e.clientX, y: e.clientY };
    
    // 1. Update Overlay Visuals (Fixed position relative to viewport)
    setOverlayStyle(prev => ({
      ...prev,
      top: e.clientY - dragOffsetRef.current.y,
      left: e.clientX - dragOffsetRef.current.x
    }));

    performReorder(e.clientX, e.clientY);
  };

  const performReorder = (clientX: number, clientY: number) => {
    const currentDragId = dragIdRef.current;
    if (!currentDragId) return;

    const docX = clientX + window.scrollX;
    const docY = clientY + window.scrollY;

    const fromIndex = items.findIndex(p => p.id === currentDragId);
    if (fromIndex === -1) return;

    const targetIndex = getTargetIndex(docX, docY);

    // Optimization: Don't update if index hasn't changed
    if (targetIndex === fromIndex) return;
    if (lastTargetIndexRef.current === targetIndex) return;

    lastTargetIndexRef.current = targetIndex;

    setItems(prevItems => {
      const copy = [...prevItems];
      const currentIndex = copy.findIndex(p => p.id === currentDragId);
      if (currentIndex === -1) return prevItems;
      
      const [moved] = copy.splice(currentIndex, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    stopAutoScroll();
    
    dragIdRef.current = null;
    setActiveId(null);
    slotsRef.current = [];
    lastTargetIndexRef.current = null;
    
    // Commit final state to history
    setItems(current => {
      commitToHistory(current);
      return current;
    });
  };

  // --- AUTO SCROLL ---

  const startAutoScroll = () => {
    if (scrollIntervalRef.current) return;

    const scrollLoop = () => {
      if (!pointerPosRef.current || !dragIdRef.current) return;
      
      const { x, y } = pointerPosRef.current;
      const h = window.innerHeight;
      const zone = 100; // Activation zone
      
      // Calculate Scroll Speed
      let speed = 0;
      if (y < zone) {
        speed = -(zone - y) * 0.3; // Scroll Up
      } else if (y > h - zone) {
        speed = (y - (h - zone)) * 0.3; // Scroll Down
      }

      if (speed !== 0) {
        window.scrollBy(0, speed);
        // While scrolling, we must re-evaluate reorder logic because document coordinates of the mouse have changed!
        performReorder(x, y);
      }
      
      scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
    };
    
    scrollIntervalRef.current = requestAnimationFrame(scrollLoop);
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) cancelAnimationFrame(scrollIntervalRef.current);
    scrollIntervalRef.current = null;
  };

  // --- SAVE ---
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
            
            {/* Sticky Toolbar */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between sticky top-4 z-40 shadow-lg border border-slate-200 dark:border-slate-800 ring-1 ring-black/5">
               <div className="flex items-center gap-4 min-w-0">
                 <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500" title="Change File">
                   <History size={20}/>
                 </button>
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

            {/* Grid Container */}
            <div ref={containerRef} className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 min-h-[500px] relative">
               {loadingPreviews ? (
                 <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                   <Loader2 className="animate-spin mb-4" size={32} />
                   <p>Generating previews...</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                   {items.map((item) => (
                     <motion.div
                       layout
                       key={item.id}
                       ref={(el) => { if(el) itemsRef.current.set(item.id, el); }}
                       onPointerDown={(e) => handlePointerDown(e, item.id)}
                       initial={false}
                       animate={{ 
                         opacity: activeId === item.id ? 0 : 1, // Hide original when dragging (gap effect)
                         scale: 1
                       }}
                       transition={{ duration: 0.2 }}
                       className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 bg-white dark:bg-slate-800 shadow-sm
                         border-slate-200 dark:border-slate-700 hover:border-blue-400
                         touch-none cursor-grab active:cursor-grabbing
                       `}
                     >
                        <img src={item.url} alt="" className="w-full h-full object-contain p-2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-xs py-1.5 text-center font-mono pointer-events-none">
                          Page {item.originalIndex + 1}
                        </div>
                     </motion.div>
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