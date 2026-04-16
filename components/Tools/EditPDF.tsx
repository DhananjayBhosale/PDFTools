
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument } from '../../services/pdfBrowser';
import { savePDFWithAnnotations, type EditorElement } from '../../services/pdfDocument';
import { downloadBlob } from '../../services/pdfShared';
import { Save, Trash2, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { ZoomControls } from '../UI/ZoomControls';
import { useZoom } from '../../hooks/useZoom';
import { StatusToast } from '../UI/StatusToast';

// --- REUSABLE PAGE COMPONENT (Virtual Scroll) ---
const PDFPage: React.FC<{
  pageIndex: number;
  pdfDoc: any;
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<EditorElement>) => void;
  onDelete: (id: string) => void;
  zoom: number;
}> = ({ pageIndex, pdfDoc, elements, selectedId, onSelect, onUpdate, onDelete, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  // Base dimensions at scale 1.0 (PDF Points)
  const [dims, setDims] = useState({ w: 600, h: 850 });

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
       if (entry.isIntersecting) setIsVisible(true);
    }, { rootMargin: '500px' }); // Larger preload margin for smooth zooming
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const render = async () => {
      if (!isVisible || isRendered || !pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        // Render at a high fixed scale (e.g. 2.0) for sharpness when zooming in
        // We do NOT re-render on zoom change, we just scale the CSS
        const renderScale = 2.0; 
        const viewport = page.getViewport({ scale: renderScale });
        
        // Store logical dimensions (1.0 scale) for layout
        setDims({ w: viewport.width / renderScale, h: viewport.height / renderScale });
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        setIsRendered(true);
      } catch (e) { console.error(e); }
    };
    render();
  }, [isVisible, isRendered, pdfDoc]);

  // Scaled dimensions for the wrapper
  const scaledW = dims.w * zoom;
  const scaledH = dims.h * zoom;

  return (
    <div 
      className="relative mb-8 shadow-lg transition-all duration-200 bg-white"
      style={{ width: scaledW, height: scaledH }} // Helper wrapper for layout flow
      onClick={() => onSelect(null)}
    >
      <div 
        ref={containerRef}
        className="relative origin-top-left bg-white"
        style={{ 
          width: dims.w, 
          height: dims.h, 
          transform: `scale(${zoom})`,
          // Ensure visual quality when scaling
          willChange: 'transform'
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full" />
        {elements.map(el => (
          <ResizableElement 
            key={el.id} element={el} containerRef={containerRef}
            isSelected={selectedId === el.id}
            onSelect={() => onSelect(el.id)}
            onUpdate={onUpdate} onDelete={onDelete}
          />
        ))}
        <div className="absolute -right-8 top-0 text-xs font-bold text-slate-300 pointer-events-none" style={{ transform: `scale(${1/zoom})`, transformOrigin: 0 }}>
          {pageIndex + 1}
        </div>
      </div>
    </div>
  );
};

// Re-implementing simplified ResizableElement
const ResizableElement: React.FC<any> = ({ element, isSelected, onSelect, onUpdate, onDelete, containerRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const clientX = e.clientX;
    const clientY = e.clientY;
    dragStart.current = { x: clientX - rect.left, y: clientY - rect.top };
    setIsDragging(true);
  };

  useEffect(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const handleMove = (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const cRect = containerRef.current.getBoundingClientRect();
      
      const x = clamp((clientX - cRect.left - dragStart.current.x) / cRect.width, 0, 0.95);
      const y = clamp((clientY - cRect.top - dragStart.current.y) / cRect.height, 0, 0.95);
      onUpdate(element.id, { x, y });
    };

    const handleEnd = () => setIsDragging(false);
    if (isDragging) {
       window.addEventListener('pointermove', handleMove);
       window.addEventListener('pointerup', handleEnd);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
    };
  }, [isDragging, containerRef]);

  return (
    <div 
      className={`absolute z-10 cursor-move ${isSelected ? 'ring-2 ring-blue-500 z-20' : 'hover:ring-1 ring-blue-300'}`}
      style={{ left: `${element.x*100}%`, top: `${element.y*100}%`, position: 'absolute' }}
      onPointerDown={handleStart}
      onClick={(e) => e.stopPropagation()}
    >
      {element.type === 'text' ? (
         <div
           className={`min-w-[96px] max-w-[220px] rounded px-1.5 py-1 leading-tight shadow-sm ${
             isSelected ? 'bg-white/85' : 'bg-white/70'
           }`}
           style={{
             fontSize: `${element.fontSize}px`,
             color: element.color,
             fontFamily: element.fontFamily,
             whiteSpace: 'pre-wrap',
           }}
         >
           {element.content || 'Text'}
         </div>
      ) : (
         <img src={element.content} className="w-32 h-auto pointer-events-none" />
      )}
      {isSelected && (
        <button
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(element.id)}
          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1"
        >
          <Trash2 size={12}/>
        </button>
      )}
    </div>
  );
};

export const EditPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0);
  const selectedElement = elements.find((element) => element.id === selectedId) ?? null;

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    setFile({ id: uuidv4(), file: files[0], name: files[0].name, size: files[0].size });
    const doc = await loadPDFDocument(files[0]);
    setPdfDoc(doc);
  };

  useEffect(() => {
    return () => {
      if (pdfDoc?.destroy) {
        void pdfDoc.destroy();
      }
    };
  }, [pdfDoc]);

  const addText = () => {
    const newEl: EditorElement = {
      id: uuidv4(), type: 'text', pageIndex: 0, // Default to top of page 1
      x: 0.1, y: 0.1, content: 'Text', fontSize: 16, color: '#000000'
    };
    setElements([...elements, newEl]);
  };

  const updateElement = (id: string, updates: any) => setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const deleteElement = (id: string) => setElements(prev => prev.filter(e => e.id !== id));

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 20, message: 'Saving annotations...' });
    try {
      const bytes = await savePDFWithAnnotations(file.file, elements);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `edited-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to save edited PDF' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-6 px-4 h-[100dvh] min-h-[100dvh] flex flex-col">
       <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">← Back</Link><h1 className="text-2xl font-bold">Edit PDF <span className="text-xs bg-green-100 text-green-700 px-2 rounded">Safe</span></h1></div>
          {file && (
             <div className="flex gap-2">
                <button onClick={addText} className="px-4 py-2 bg-slate-100 rounded-lg font-bold flex gap-2"><Type size={18}/> Text</button>
                <button onClick={handleSave} disabled={status.isProcessing} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex gap-2 disabled:opacity-50"><Save size={18}/> Save</button>
             </div>
          )}
          </div>
          {selectedElement?.type === 'text' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Selected text</span>
              <input
                value={selectedElement.content}
                onChange={(event) => updateElement(selectedElement.id, { content: event.target.value })}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}
       </div>

       <AnimatePresence mode="wait">
          {!file ? (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl">
                <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to edit" />
             </motion.div>
          ) : (
             <div className="flex-1 flex flex-col min-h-0 bg-slate-100 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                
                {/* Floating Zoom Controls */}
                <div className="absolute bottom-6 right-6 z-30">
                  <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-4 sm:p-8 flex flex-col items-start sm:items-center">
                    {Array.from({ length: pdfDoc?.numPages || 0 }).map((_, i) => (
                      <PDFPage 
                          key={i} pageIndex={i} pdfDoc={pdfDoc}
                          elements={elements.filter(e => e.pageIndex === i)}
                          selectedId={selectedId} onSelect={setSelectedId}
                          onUpdate={updateElement} onDelete={deleteElement}
                          zoom={zoom}
                      />
                    ))}
                    <div className="h-20" /> {/* Bottom Spacer */}
                </div>
             </div>
          )}
       </AnimatePresence>
       <StatusToast status={status} />
    </div>
  );
};
