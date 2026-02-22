
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { ProcessingStatus } from '../../types';
import { createPDFFromLayout, PDFPageLayout, PDFImageElement } from '../../services/pdfService';
import { X, ArrowDown, Loader2, FileImage, LayoutTemplate, Plus, Trash2, Maximize2, Move, Undo2 } from 'lucide-react';
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

interface PageData {
  id: string;
  elements: ImageElement[];
}

// --- SUB-COMPONENTS ---

const DraggableResizableImage: React.FC<{ 
   element: ImageElement, 
   pageId: string,
   containerRef: React.RefObject<HTMLDivElement>,
   onUpdate: (u: Partial<ImageElement>) => void,
   onRemove: () => void,
   onDragStart: (e: React.PointerEvent, pageId: string, element: ImageElement, containerRef: React.RefObject<HTMLDivElement>) => void,
   zoom: number,
   isDraggingGlobally: boolean
}> = ({ element, pageId, containerRef, onUpdate, onRemove, onDragStart, zoom, isDraggingGlobally }) => {
  const [resizingHandle, setResizingHandle] = useState<string | null>(null);
  const startRef = useRef({ x: 0, y: 0, ex: 0, ey: 0, w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!resizingHandle) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pageWidth_px = rect.width;
      const pageHeight_px = rect.height;

      const dx = e.clientX - startRef.current.x;
      
      const initialW = startRef.current.w / pageWidth_px;
      const initialH = startRef.current.h / pageHeight_px;
      const initialX = startRef.current.ex / pageWidth_px;
      const initialY = startRef.current.ey / pageHeight_px;

      let newW_px = resizingHandle.includes('right') 
        ? startRef.current.w + dx 
        : startRef.current.w - dx;
      
      const newW = newW_px / pageWidth_px;
      const newH = newW / element.aspectRatio;
      
      let newX = resizingHandle.includes('right') 
        ? initialX 
        : (startRef.current.ex + dx) / pageWidth_px;
        
      let newY = resizingHandle.includes('top') 
        ? initialY - (newH - initialH) 
        : initialY;

      onUpdate({ 
         x: Math.max(0, newX), 
         y: Math.max(0, newY),
         width: Math.max(0.05, newW), 
         height: Math.max(0.05, newH) 
      });
    };

    const handlePointerUp = () => {
      setResizingHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingHandle, onUpdate, zoom, element.aspectRatio, element.height, element.x, element.y, containerRef]);

  const handleDown = (e: React.PointerEvent) => {
     e.stopPropagation();
     onDragStart(e, pageId, element, containerRef);
  };

  const handleResizeDown = (e: React.PointerEvent, handle: string) => {
     e.stopPropagation();
     setResizingHandle(handle);
     const rect = containerRef.current!.getBoundingClientRect();
     const pageWidth_px = rect.width;
     const pageHeight_px = rect.height;

     startRef.current = { 
        x: e.clientX, y: e.clientY, 
        ex: element.x * pageWidth_px, ey: element.y * pageHeight_px,
        w: element.width * pageWidth_px, h: element.height * pageHeight_px
     };
  };

  return (
     <div
        onPointerDown={handleDown}
        className={`absolute group select-none transition-shadow ${!!resizingHandle ? 'ring-2 ring-blue-500 z-50 shadow-2xl' : 'hover:ring-1 hover:ring-blue-400 z-10'}`}
        style={{
           left: `${element.x * 100}%`,
           top: `${element.y * 100}%`,
           width: `${element.width * 100}%`,
           height: `${element.height * 100}%`,
           cursor: 'grab',
           opacity: isDraggingGlobally ? 0 : 1,
           pointerEvents: isDraggingGlobally ? 'none' : 'auto'
        }}
     >
        <img src={element.previewUrl} className="w-full h-full object-contain pointer-events-none" />
        
        {/* Controls */}
        <div className="absolute -top-3 -right-3 hidden group-hover:flex z-20">
           <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="bg-rose-500 text-white rounded-full p-1.5 shadow-lg hover:bg-rose-600 transition-colors">
              <X size={14}/>
           </button>
        </div>

        {/* Resize Handles - All Corners */}
        {[
          { pos: 'bottom-right', cursor: 'nwse-resize' },
          { pos: 'bottom-left', cursor: 'nesw-resize' },
          { pos: 'top-right', cursor: 'nesw-resize' },
          { pos: 'top-left', cursor: 'nwse-resize' }
        ].map((handle) => (
          <div 
             key={handle.pos}
             onPointerDown={(e) => handleResizeDown(e, handle.pos)}
             className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm ${
               handle.pos === 'bottom-right' ? '-bottom-1.5 -right-1.5' : 
               handle.pos === 'bottom-left' ? '-bottom-1.5 -left-1.5' :
               handle.pos === 'top-right' ? '-top-1.5 -right-1.5' :
               '-top-1.5 -left-1.5'
             }`}
             style={{ cursor: handle.cursor }}
          />
        ))}
        
        {/* Visual feedback for dragging/resizing */}
        {(!!resizingHandle) && (
          <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
        )}
     </div>
  );
};

const CanvasPage: React.FC<{ 
  page: PageData, 
  index: number,
  zoom: number,
  updateElement: (pageId: string, elementId: string, updates: Partial<ImageElement>) => void,
  removeElement: (pageId: string, elementId: string) => void,
  onImageDragStart: (e: React.PointerEvent, pageId: string, element: ImageElement, containerRef: React.RefObject<HTMLDivElement>) => void,
  activeImageDragId: string | null
}> = ({ page, index, zoom, updateElement, removeElement, onImageDragStart, activeImageDragId }) => {
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      className="bg-white shadow-lg relative overflow-hidden ring-1 ring-slate-200"
      style={{ width: '100%', aspectRatio: '210/297' }} // A4 Ratio
      ref={pageRef}
      data-page-id={page.id}
    >
      <div className="absolute top-2 left-2 text-[10px] font-mono text-slate-300 pointer-events-none select-none">Page {index + 1}</div>
      {page.elements.map(el => (
         <DraggableResizableImage 
            key={el.id} 
            element={el} 
            pageId={page.id}
            containerRef={pageRef}
            onUpdate={(u) => updateElement(page.id, el.id, u)}
            onRemove={() => removeElement(page.id, el.id)}
            onDragStart={onImageDragStart}
            zoom={zoom}
            isDraggingGlobally={activeImageDragId === el.id}
         />
      ))}
    </div>
  );
};

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
  const [activeImageDrag, setActiveImageDrag] = useState<{
    pageId: string;
    element: ImageElement;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const handleImageDragStart = useCallback((e: React.PointerEvent, pageId: string, element: ImageElement, containerRef: React.RefObject<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = containerRef.current!.getBoundingClientRect();
    const width = rect.width * element.width;
    const height = rect.height * element.height;
    const elementLeft = rect.left + rect.width * element.x;
    const elementTop = rect.top + rect.height * element.y;
    
    setActiveImageDrag({
      pageId,
      element,
      offsetX: e.clientX - elementLeft,
      offsetY: e.clientY - elementTop,
      width,
      height,
      clientX: e.clientX,
      clientY: e.clientY
    });
  }, []);

  useLayoutEffect(() => {
    if (!activeImageDrag) return;

    const handleMove = (e: PointerEvent) => {
      setActiveImageDrag(prev => prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : null);
    };

    const handleUp = (e: PointerEvent) => {
      setActiveImageDrag(prev => {
        if (!prev) return null;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const pageNode = elements.find(el => el.hasAttribute('data-page-id'));
        
        if (pageNode) {
          const targetPageId = pageNode.getAttribute('data-page-id')!;
          const rect = pageNode.getBoundingClientRect();
          
          const dropX = e.clientX - prev.offsetX;
          const dropY = e.clientY - prev.offsetY;
          
          const newX = (dropX - rect.left) / rect.width;
          const newY = (dropY - rect.top) / rect.height;
          const newWidth = prev.width / rect.width;
          const newHeight = prev.height / rect.height;

          setPages(prevPages => {
            let newPages = [...prevPages];
            
            // Remove from old page
            newPages = newPages.map(p => {
              if (p.id === prev.pageId) {
                return { ...p, elements: p.elements.filter(el => el.id !== prev.element.id) };
              }
              return p;
            });
            
            // Add to new page
            newPages = newPages.map(p => {
              if (p.id === targetPageId) {
                return { 
                  ...p, 
                  elements: [...p.elements, { 
                    ...prev.element, 
                    x: newX, 
                    y: newY,
                    width: newWidth,
                    height: newHeight
                  }] 
                };
              }
              return p;
            });
            
            return newPages;
          });
        }
        
        return null;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [activeImageDrag ? true : false]);

  // Initialize with pages if files dropped
  const handleFilesSelected = async (newFiles: File[]) => {
    const images = newFiles.filter(f => f.type.startsWith('image/'));
    if (images.length === 0) return;
    
    // Create a new page for each image by default (standard flow)
    const newPages = await Promise.all(images.map(async (f: File) => {
      let fileToUse = f;
      let url = URL.createObjectURL(f);
      
      // Convert WebP or other non-standard formats to PNG for pdf-lib compatibility
      if (f.type === 'image/webp' || !['image/jpeg', 'image/png'].includes(f.type)) {
         const img = new Image();
         img.src = url;
         await new Promise<void>(r => { img.onload = () => r(); });
         const canvas = document.createElement('canvas');
         canvas.width = img.width;
         canvas.height = img.height;
         const ctx = canvas.getContext('2d');
         ctx?.drawImage(img, 0, 0);
         const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
         if (blob) {
            fileToUse = new File([blob], f.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
            URL.revokeObjectURL(url);
            url = URL.createObjectURL(fileToUse);
         }
      }

      // Get dimensions to set initial aspect ratio
      const img = new Image();
      img.src = url;
      await new Promise<void>(r => { img.onload = () => r(); });
      
      const aspect = img.width / img.height;
      // Default: Center, 80% width
      return {
        id: uuidv4(),
        elements: [{
          id: uuidv4(),
          file: fileToUse,
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

  const updateElement = useCallback((pageId: string, elementId: string, updates: Partial<ImageElement>) => {
    setPages(prev => prev.map(p => {
       if (p.id !== pageId) return p;
       return { ...p, elements: p.elements.map(e => e.id === elementId ? { ...e, ...updates } : e) };
    }));
  }, []);

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

  const activePage = pages.find(p => p.id === activeId);

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
       <SEOHead 
        title="JPG to PDF Converter - Create PDFs from Images | ZenPDF"
        description="Convert JPG, PNG, and WebP images to PDF documents. Drag and drop layout builder. Free, local, and secure."
       />

       {/* Header */}
       <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between flex-shrink-0 z-30 shadow-sm">
         <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
               <Undo2 size={20} />
            </Link>
            <div>
               <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Document Builder</h1>
               <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">JPG to PDF</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={() => setPages([])} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Clear All</button>
            <button 
               onClick={handleConvert} 
               disabled={status.isProcessing || pages.length === 0}
               className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
               {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <ArrowDown size={18}/>} 
               <span>Export PDF</span>
            </button>
         </div>
      </div>

      {pages.length === 0 ? (
         <div className="flex-1 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl">
               <FileUpload onFilesSelected={handleFilesSelected} accept="image/*" multiple label="Drop images to start building your PDF" />
            </motion.div>
         </div>
      ) : (
         <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Controls */}
            <div className="w-72 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full z-20 shadow-xl">
               <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  <section>
                     <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Document Actions</h3>
                     <div className="space-y-2">
                        <button className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 relative transition-colors">
                           <FileImage size={16}/> Add New Pages
                           <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && handleFilesSelected(Array.from(e.target.files))} />
                        </button>
                        <button onClick={addEmptyPage} className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors">
                           <Plus size={16}/> New Blank Page
                        </button>
                     </div>
                  </section>

                  <section>
                     <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">View Controls</h3>
                     <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} className="w-full justify-between" />
                     </div>
                  </section>

                  <section>
                     <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Page List</h3>
                     <div className="space-y-2">
                        {pages.map((p, i) => (
                           <div 
                              key={p.id} 
                              className={`p-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors ${activeId === p.id ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                           >
                              <span className="flex items-center gap-2">
                                 <Move size={12} className="opacity-40" />
                                 Page {i + 1}
                              </span>
                              <button onClick={() => removePage(p.id)} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 size={12}/></button>
                           </div>
                        ))}
                     </div>
                  </section>
               </div>
               
               <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <p className="text-[10px] text-slate-400 text-center">Drag images on pages to rearrange. Use the handles to resize.</p>
               </div>
            </div>

            {/* Main Canvas Scroll Area */}
            <div ref={containerRef} className="flex-1 bg-slate-200/50 dark:bg-slate-950/50 overflow-auto custom-scrollbar relative p-12">
               <div 
                  className="flex flex-col items-center gap-16 pb-64 transition-all duration-200 mx-auto" 
                  style={{ 
                    width: `calc(210mm * ${zoom})`,
                    minHeight: '100%'
                  }}
               >
                  {pages.map((page, i) => (
                     <div 
                        key={page.id}
                        ref={(el) => registerItem(page.id, el)}
                        className={`relative group shadow-2xl transition-shadow hover:shadow-blue-500/10 ${activeId === page.id ? 'opacity-0' : 'opacity-100'}`}
                        style={{ width: '210mm' }}
                     >
                        {/* Page Header Actions */}
                        <div className="absolute -top-10 left-0 right-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <div className="flex items-center gap-3">
                              <div 
                                 className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 text-xs font-bold"
                                 onPointerDown={(e) => dragHandlers.onPointerDown(e, page.id)}
                              >
                                 <Move size={14} /> Page {i + 1}
                              </div>
                              <button 
                                 className="relative flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 hover:text-blue-500 transition-colors"
                              >
                                 <Plus size={14} /> Add Image to Page
                                 <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                    onChange={async e => {
                                       if (e.target.files) {
                                          const files = Array.from(e.target.files);
                                          const newElements = await Promise.all(files.map(async (f: File) => {
                                             let fileToUse = f;
                                             let url = URL.createObjectURL(f);

                                             if (f.type === 'image/webp' || !['image/jpeg', 'image/png'].includes(f.type)) {
                                                const img = new Image();
                                                img.src = url;
                                                await new Promise<void>(r => { img.onload = () => r(); });
                                                const canvas = document.createElement('canvas');
                                                canvas.width = img.width;
                                                canvas.height = img.height;
                                                const ctx = canvas.getContext('2d');
                                                ctx?.drawImage(img, 0, 0);
                                                const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
                                                if (blob) {
                                                   fileToUse = new File([blob], f.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
                                                   URL.revokeObjectURL(url);
                                                   url = URL.createObjectURL(fileToUse);
                                                }
                                             }

                                             const img = new Image();
                                             img.src = url;
                                             await new Promise<void>(r => { img.onload = () => r(); });
                                             const aspect = img.width / img.height;
                                             return {
                                                id: uuidv4(),
                                                file: fileToUse,
                                                previewUrl: url,
                                                x: 0.1,
                                                y: 0.1,
                                                width: 0.4,
                                                height: 0.4 / aspect,
                                                aspectRatio: aspect
                                             };
                                          }));
                                          setPages(prev => prev.map(p => p.id === page.id ? { ...p, elements: [...p.elements, ...newElements] } : p));
                                       }
                                    }} 
                                 />
                              </button>
                           </div>
                           <button onClick={() => removePage(page.id)} className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 text-rose-500 hover:bg-rose-50 transition-colors">
                              <Trash2 size={16}/>
                           </button>
                        </div>

                         <CanvasPage 
                            page={page} 
                            index={i} 
                            zoom={zoom}
                            updateElement={updateElement}
                            removeElement={removeElement}
                            onImageDragStart={handleImageDragStart}
                            activeImageDragId={activeImageDrag?.element.id || null}
                         />
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* Page Drag Overlay */}
      {activeId && activePage && createPortal(
         <div 
            className="fixed pointer-events-none z-50 bg-white shadow-2xl ring-2 ring-blue-500 opacity-90"
            style={{ 
               top: overlayStyle.top, 
               left: overlayStyle.left,
               width: overlayStyle.width,
               height: overlayStyle.height
            }}
         >
             {/* Simplified preview for performance */}
             <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xl border border-dashed border-slate-300">
                Moving Page...
             </div>
         </div>,
         document.body
      )}

      {/* Image Drag Overlay */}
      {activeImageDrag && createPortal(
         <div 
            className="fixed pointer-events-none z-[60] shadow-2xl ring-2 ring-blue-500 opacity-90"
            style={{ 
               top: activeImageDrag.clientY - activeImageDrag.offsetY, 
               left: activeImageDrag.clientX - activeImageDrag.offsetX,
               width: activeImageDrag.width,
               height: activeImageDrag.height,
               cursor: 'grabbing'
            }}
         >
            <img src={activeImageDrag.element.previewUrl} className="w-full h-full object-contain pointer-events-none" />
         </div>,
         document.body
      )}
    </div>
  );
};
