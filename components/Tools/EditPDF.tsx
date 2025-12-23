
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument, savePDFWithAnnotations, EditorElement } from '../../services/pdfService';
import { 
  Loader2, Save, Image as ImageIcon, Trash2, Type, 
  ArrowLeft, ArrowRight, RotateCw, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

// --- REUSABLE PAGE COMPONENT (Virtual Scroll) ---
const PDFPage: React.FC<{
  pageIndex: number;
  pdfDoc: any;
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<EditorElement>) => void;
  onDelete: (id: string) => void;
}> = ({ pageIndex, pdfDoc, elements, selectedId, onSelect, onUpdate, onDelete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [dims, setDims] = useState({ w: 600, h: 850 });

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
       if (entry.isIntersecting) setIsVisible(true);
    }, { rootMargin: '300px' });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const render = async () => {
      if (!isVisible || isRendered || !pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1.5 });
        setDims({ w: viewport.width, h: viewport.height });
        
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

  return (
    <div ref={containerRef} className="relative mb-8 shadow-lg bg-white mx-auto" style={{ width: dims.w, height: dims.h }} onClick={() => onSelect(null)}>
       <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
       {elements.map(el => (
         <ResizableElement 
           key={el.id} element={el} containerRef={containerRef}
           isSelected={selectedId === el.id}
           onSelect={() => onSelect(el.id)}
           onUpdate={onUpdate} onDelete={onDelete}
         />
       ))}
       <div className="absolute -right-10 top-0 text-xs font-bold text-slate-300">{pageIndex + 1}</div>
    </div>
  );
};

// Re-implementing simplified ResizableElement
const ResizableElement: React.FC<any> = ({ element, isSelected, onSelect, onUpdate, onDelete, containerRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleStart = (e: any) => {
    e.stopPropagation();
    onSelect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const rect = e.target.getBoundingClientRect();
    dragStart.current = { x: clientX - rect.left, y: clientY - rect.top };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (e: any) => {
      if (!isDragging || !containerRef.current) return;
      const clientX = e.clientX || e.touches[0].clientX;
      const clientY = e.clientY || e.touches[0].clientY;
      const cRect = containerRef.current.getBoundingClientRect();
      const x = (clientX - cRect.left - dragStart.current.x) / cRect.width;
      const y = (clientY - cRect.top - dragStart.current.y) / cRect.height;
      onUpdate(element.id, { x, y });
    };
    const handleEnd = () => setIsDragging(false);
    if (isDragging) {
       window.addEventListener('mousemove', handleMove);
       window.addEventListener('mouseup', handleEnd);
    }
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleEnd); };
  }, [isDragging, containerRef]);

  return (
    <div 
      className={`absolute z-10 cursor-move ${isSelected ? 'ring-2 ring-blue-500 z-20' : 'hover:ring-1 ring-blue-300'}`}
      style={{ left: `${element.x*100}%`, top: `${element.y*100}%`, position: 'absolute' }}
      onMouseDown={handleStart}
    >
      {element.type === 'text' ? (
         <textarea 
           value={element.content} 
           onChange={e => onUpdate(element.id, { content: e.target.value })}
           className="bg-transparent border-none resize-none outline-none overflow-hidden"
           style={{ fontSize: `${element.fontSize}px`, color: element.color, fontFamily: element.fontFamily, width: '200px', height: 'auto' }}
         />
      ) : (
         <img src={element.content} className="w-32 h-auto pointer-events-none" />
      )}
      {isSelected && <button onClick={() => onDelete(element.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1"><Trash2 size={12}/></button>}
    </div>
  );
};

export const EditPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    setFile({ id: uuidv4(), file: files[0], name: files[0].name, size: files[0].size });
    const doc = await loadPDFDocument(files[0]);
    setPdfDoc(doc);
  };

  const addText = () => {
    const newEl: EditorElement = {
      id: uuidv4(), type: 'text', pageIndex: 0, // Default to top of page 1
      x: 0.1, y: 0.1, content: 'Text', fontSize: 16, color: '#000'
    };
    setElements([...elements, newEl]);
  };

  const updateElement = (id: string, updates: any) => setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const deleteElement = (id: string) => setElements(prev => prev.filter(e => e.id !== id));

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 0, message: 'Saving...' });
    const bytes = await savePDFWithAnnotations(file.file, elements);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-${file.name}`;
    a.click();
    setStatus({ isProcessing: false, progress: 0, message: '' });
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 h-[calc(100vh-80px)] flex flex-col">
       <div className="flex items-center justify-between mb-4">
          <div><Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800">← Back</Link><h1 className="text-2xl font-bold">Edit PDF <span className="text-xs bg-green-100 text-green-700 px-2 rounded">Safe</span></h1></div>
          {file && (
             <div className="flex gap-2">
                <button onClick={addText} className="px-4 py-2 bg-slate-100 rounded-lg font-bold flex gap-2"><Type size={18}/> Text</button>
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex gap-2"><Save size={18}/> Save</button>
             </div>
          )}
       </div>

       <AnimatePresence mode="wait">
          {!file ? (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl">
                <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to edit" />
             </motion.div>
          ) : (
             <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 rounded-2xl overflow-y-auto custom-scrollbar p-8 flex flex-col items-center border border-slate-200 dark:border-slate-800">
                {Array.from({ length: pdfDoc?.numPages || 0 }).map((_, i) => (
                   <PDFPage 
                      key={i} pageIndex={i} pdfDoc={pdfDoc}
                      elements={elements.filter(e => e.pageIndex === i)}
                      selectedId={selectedId} onSelect={setSelectedId}
                      onUpdate={updateElement} onDelete={deleteElement}
                   />
                ))}
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};
