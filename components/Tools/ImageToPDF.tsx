
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { ProcessingStatus } from '../../types';
import { createPDFFromLayout, PDFPageLayout, PDFImageElement } from '../../services/pdfService';
import { X, ArrowDown, Loader2, FileImage, LayoutTemplate, Plus, Trash2, Maximize2, Move } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { ZoomControls } from '../UI/ZoomControls';
import { useZoom } from '../../hooks/useZoom';
import { useDragReorder } from '../../hooks/useDragReorder';
import { createPortal } from 'react-dom';
import { SEOHead } from '../SEO/SEOHead';
import { FAQ, FAQItem } from '../UI/FAQ';

const faqItems: FAQItem[] = [
  {
    question: "What image formats are supported?",
    answer: "We support common formats including JPG, PNG, and WebP. You can mix multiple formats in a single PDF document."
  },
  {
    question: "Can I rearrange the images?",
    answer: "Yes, you can drag and drop images to reorder pages, or move images around freely on each page canvas to create custom layouts."
  },
  {
    question: "Is the quality preserved?",
    answer: "Yes, we embed the images directly into the PDF without aggressive re-compression, preserving the original quality as much as possible."
  }
];

// Data Model
interface PageData {
  id: string;
  elements: ImageElement[];
}
interface ImageElement {
  id: string;
  file: File;
  previewUrl: string;
  x: number; // 0-1
  y: number; // 0-1
  width: number; // 0-1
  height: number; // 0-1 aspect ratio preserved by default
  aspectRatio: number;
}

export const ImageToPDF: React.FC = () => {
  const [pages, setPages] = useState<PageData[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0, 0.5, 1.5, 0.25);
  
  // Reorder Engine for Pages
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeId, dragHandlers, registerItem, overlayStyle } = useDragReorder<PageData>({
    items: pages,
    onReorder: setPages,
    containerRef,
    keyExtractor: p => p.id
  });

  // Free Drag State for Images
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);

  // Initialize with pages if files dropped
  const handleFilesSelected = async (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;
    
    // Create a new page for each image by default (standard flow)
    const newPages = await Promise.all(images.map(async f => {
      const url = URL.createObjectURL(f);
      // Get dimensions to set initial aspect ratio
      const img = new Image();
      img.src = url;
      await new Promise(r => img.onload = r);
      
      const aspect = img.width / img.height;
      // Default: Center, 80% width
      return {
        id: uuidv4(),
        elements: [{
          id: uuidv4(),
          file: f,
          previewUrl: url,
          x: 0.1,
          y: 0.1,
          width: 0.8,
          height: 0.8 / aspect,
          aspectRatio: aspect
        }]
      };
    }));
    
    setPages(prev => [...prev, ...newPages]);
  };

  const addEmptyPage = () => {
    setPages(prev => [...prev, { id: uuidv4(), elements: [] }]);
  };

  const removePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const removeElement = (pageId: string, elementId: string) => {
    setPages(prev => prev.map(p => {
       if (p.id !== pageId) return p;
       return { ...p, elements: p.elements.filter(e => e.id !== elementId) };
    }));
  };

  const updateElement = (pageId: string, elementId: string, updates: Partial<ImageElement>) => {
    setPages(prev => prev.map(p => {
       if (p.id !== pageId) return p;
       return { ...p, elements: p.elements.map(e => e.id === elementId ? { ...e, ...updates } : e) };
    }));
  };

  const handleConvert = async () => {
    if (pages.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Building PDF...' });
    try {
      const layout: PDFPageLayout[] = pages.map(p => ({
         width: 595.28,
         height: 841.89,
         elements: p.elements.map(e => ({
            file: e.file,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height
         }))
      }));
      
      const pdfBytes = await createPDFFromLayout(layout);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `layout-${Date.now()}.pdf`;
      a.click();
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed' });
    }
  };

  // --- Sub-Components for Canvas Interaction ---
  
  const CanvasPage: React.FC<{ page: PageData, index: number }> = ({ page, index }) => {
    const pageRef = useRef<HTMLDivElement>(null);

    // Cross-page drop logic could go here if we lifted drag state higher
    // For now, dragging is constrained to the page for simplicity in this implementation
    // unless we implement a global drag layer for images too.
    
    return (
      <div 
        className="bg-white shadow-lg relative overflow-hidden ring-1 ring-slate-200"
        style={{ width: '100%', aspectRatio: '210/297' }} // A4 Ratio
        ref={pageRef}
      >
        <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-300 pointer-events-none select-none">Page {index + 1}</div>
        {page.elements.map(el => (
           <DraggableResizableImage 
              key={el.id} 
              element={el} 
              containerRef={pageRef}
              onUpdate={(u) => updateElement(page.id, el.id, u)}
              onRemove={() => removeElement(page.id, el.id)}
           />
        ))}
      </div>
    );
  };

  const DraggableResizableImage: React.FC<{ 
     element: ImageElement, 
     containerRef: React.RefObject<HTMLDivElement>,
     onUpdate: (u: Partial<ImageElement>) => void,
     onRemove: () => void
  }> = ({ element, containerRef, onUpdate, onRemove }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const startRef = useRef({ x: 0, y: 0, ex: 0, ey: 0, w: 0, h: 0 });

    const handleDown = (e: React.PointerEvent) => {
       e.stopPropagation();
       e.currentTarget.setPointerCapture(e.pointerId);
       setIsDragging(true);
       const rect = containerRef.current!.getBoundingClientRect();
       startRef.current = { 
          x: e.clientX, y: e.clientY, 
          ex: element.x * rect.width, ey: element.y * rect.height, 
          w: 0, h: 0 
       };
    };

    const handleResizeDown = (e: React.PointerEvent) => {
       e.stopPropagation();
       e.currentTarget.setPointerCapture(e.pointerId);
       setIsResizing(true);
       const rect = containerRef.current!.getBoundingClientRect();
       startRef.current = { 
          x: e.clientX, y: e.clientY, 
          ex: 0, ey: 0,
          w: element.width * rect.width, h: element.height * rect.height
       };
    };

    const handleMove = (e: React.PointerEvent) => {
       if (!containerRef.current) return;
       const rect = containerRef.current.getBoundingClientRect();

       if (isDragging) {
          const dx = e.clientX - startRef.current.x;
          const dy = e.clientY - startRef.current.y;
          const nx = (startRef.current.ex + dx) / rect.width;
          const ny = (startRef.current.ey + dy) / rect.height;
          onUpdate({ x: nx, y: ny });
       }
       if (isResizing) {
          const dx = e.clientX - startRef.current.x;
          // Maintain aspect ratio
          // width change
          const newW_px = startRef.current.w + dx;
          const newW = newW_px / rect.width;
          const newH = newW / element.aspectRatio; // Keep aspect
          onUpdate({ width: Math.max(0.05, newW), height: Math.max(0.05, newH) });
       }
    };

    const handleUp = (e: React.PointerEvent) => {
       setIsDragging(false);
       setIsResizing(false);
       e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
       <div
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          className={`absolute group cursor-move hover:ring-1 hover:ring-blue-400 select-none ${isDragging ? 'opacity-80' : ''}`}
          style={{
             left: `${element.x * 100}%`,
             top: `${element.y * 100}%`,
             width: `${element.width * 100}%`,
             height: `${element.height * 100}%`
          }}
       >
          <img src={element.previewUrl} className="w-full h-full object-contain pointer-events-none" />
          
          {/* Controls */}
          <div className="absolute -top-3 -right-3 hidden group-hover:flex">
             <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="bg-rose-500 text-white rounded-full p-1 shadow-sm"><X size={12}/></button>
          </div>

          {/* Resize Handle */}
          <div 
             onPointerDown={handleResizeDown}
             onPointerMove={handleMove}
             onPointerUp={handleUp}
             className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 rounded-tl"
          />
          
          {/* Guides (Center lines logic would go here) */}
       </div>
    );
  };

  const activePage = pages.find(p => p.id === activeId);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 h-[calc(100vh-80px)] flex flex-col">
       <SEOHead 
        title="JPG to PDF Converter - Create PDFs from Images | ZenPDF"
        description="Convert JPG, PNG, and WebP images to PDF documents. Drag and drop layout builder. Free, local, and secure."
       />

       {/* Header */}
       <div className="mb-6 flex items-center justify-between flex-shrink-0">
         <div>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Document Builder</h1>
         </div>
         <div className="flex gap-2">
            <button onClick={() => setPages([])} className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">Clear</button>
         </div>
      </div>

      {pages.length === 0 ? (
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="m-auto w-full max-w-xl">
            <FileUpload onFilesSelected={handleFilesSelected} accept="image/*" multiple label="Drop images to start" />
         </motion.div>
      ) : (
         <div className="flex-1 flex gap-6 overflow-hidden">
            {/* Sidebar Controls */}
            <div className="w-64 flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 h-fit">
               <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><LayoutTemplate size={18}/> Layout</h3>
               
               <div className="space-y-2">
                  <button className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 relative">
                     <FileImage size={16}/> Add Images
                     <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && handleFilesSelected(Array.from(e.target.files))} />
                  </button>
                  <button onClick={addEmptyPage} className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2">
                     <Plus size={16}/> New Page
                  </button>
               </div>

               <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-4">
                  <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} className="w-full justify-center" />
               </div>

               <button 
                  onClick={handleConvert} 
                  disabled={status.isProcessing}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
               >
                  {status.isProcessing ? <Loader2 className="animate-spin"/> : <ArrowDown size={18}/>} Export PDF
               </button>
            </div>

            {/* Main Canvas Scroll Area */}
            <div ref={containerRef} className="flex-1 bg-slate-100 dark:bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar relative p-8">
               <div className="flex flex-col items-center gap-8 pb-20 origin-top" style={{ transform: `scale(${zoom})` }}>
                  {pages.map((page, i) => (
                     <div 
                        key={page.id}
                        ref={(el) => registerItem(page.id, el)}
                        className={`relative group ${activeId === page.id ? 'opacity-0' : 'opacity-100'}`}
                        style={{ width: '210mm', minWidth: '210mm' }} // Fixed Print Width
                     >
                        {/* Page Drag Handle */}
                        <div 
                           className="absolute -left-10 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                           onPointerDown={(e) => dragHandlers.onPointerDown(e, page.id)}
                        >
                           <Move size={20} />
                           <span className="absolute -left-6 font-bold text-xs">{i + 1}</span>
                        </div>
                        
                        {/* Remove Page */}
                        <button onClick={() => removePage(page.id)} className="absolute -right-8 top-0 p-1 text-rose-300 hover:text-rose-500">
                           <Trash2 size={16}/>
                        </button>

                        <CanvasPage page={page} index={i} />
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      <div className="mt-12">
        <FAQ items={faqItems} />
      </div>

      {/* Page Drag Overlay */}
      {activeId && activePage && createPortal(
         <div 
            className="fixed pointer-events-none z-50 bg-white shadow-2xl ring-2 ring-blue-500 opacity-90"
            style={{ 
               top: overlayStyle.top, 
               left: overlayStyle.left,
               width: overlayStyle.width,
               height: overlayStyle.height,
               transform: `scale(${zoom})`
            }}
         >
             {/* Simplified preview for performance */}
             <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xl border border-dashed border-slate-300">
                Moving Page...
             </div>
         </div>,
         document.body
      )}
    </div>
  );
};
