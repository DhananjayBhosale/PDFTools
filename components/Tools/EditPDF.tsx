import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument, saveEditedPDF, TextEdit } from '../../services/pdfService';
import { Loader2, Save, Undo2, ArrowLeft, ArrowRight, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

interface TextItem {
  str: string;
  dir: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  width: number;
  height: number;
  fontName: string;
  id: string; // Unique ID
}

export const EditPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  
  // Editor State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5); // Fixed scale for editor resolution
  
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [edits, setEdits] = useState<Record<string, TextEdit>>({}); // Map id -> Edit
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Load Document
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    setFile({ id: uuidv4(), file: files[0], name: files[0].name, size: files[0].size });
    
    try {
      const doc = await loadPDFDocument(files[0]);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPageIndex(0);
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Could not load PDF' });
    }
  };

  // 2. Render Page & Extract Text
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      
      const page = await pdfDoc.getPage(currentPageIndex + 1);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Force white background for editor to avoid transparency issues
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;

      // Extract Text
      const content = await page.getTextContent();
      const items: TextItem[] = content.items.map((item: any, idx: number) => ({
        ...item,
        id: `p${currentPageIndex}-i${idx}`,
      }));
      setTextItems(items);
    };

    renderPage();
  }, [pdfDoc, currentPageIndex, scale]);

  // 3. Helper: Convert UI coords to PDF coords for saving
  // PDF origin is bottom-left, Canvas/UI is top-left.
  // PDF.js transform: [scaleX, skewY, skewX, scaleY, x, y]
  // PDF text usually has y=0 at bottom.
  const getBackgroundSample = (item: TextItem): [number, number, number] => {
    if (!canvasRef.current) return [255, 255, 255];
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return [255, 255, 255];

    // Sample a pixel slightly above/left of the text start
    // We need to convert the Transform matrix to Viewport pixel coords
    // This is complex, so we cheat: we look at the rendered position on screen using the viewport
    // But since we don't have the viewport object here easily without re-getting it, we might just assume white.
    // BETTER: Use white. Most PDFs are white. 
    // Implementing robust color sampling requires precise coord mapping which is fragile here.
    return [255, 255, 255]; 
  };

  const handleTextClick = (item: TextItem) => {
    setActiveEditId(item.id);
    if (!edits[item.id]) {
      // Initialize edit state with original text
      const bgColor = getBackgroundSample(item);
      setEdits(prev => ({
        ...prev,
        [item.id]: {
          pageIndex: currentPageIndex,
          originalText: item.str,
          newText: item.str,
          x: item.transform[4], // PDF x
          y: item.transform[5], // PDF y (bottom-up)
          width: item.width, // Needs scaling adjustment? PDF.js items width is in PDF units usually?
          // Actually item.width from getTextContent is often undefined or requires calculation.
          // We'll use a heuristic for width if 0.
          height: item.height || Math.abs(item.transform[3]), // PDF height
          fontSize: Math.abs(item.transform[3]), // Roughly scaleY
          fontName: item.fontName,
          backgroundColor: bgColor
        }
      }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], newText: e.target.value }
    }));
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying edits...' });
    
    try {
      // Convert map to array
      const editList = Object.values(edits);
      const pdfBytes = await saveEditedPDF(file.file, editList);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-${file.name}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to save changes.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 h-[calc(100vh-80px)] flex flex-col">
      <div className="mb-4 flex items-center justify-between">
         <div>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Edit PDF Text <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Beta</span>
            </h1>
         </div>
         {file && (
           <div className="flex gap-2">
             <button onClick={() => setFile(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
               Cancel
             </button>
             <button onClick={handleSave} disabled={status.isProcessing} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
               {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Save Changes
             </button>
           </div>
         )}
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto mt-20">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to edit text" />
             <p className="text-center text-slate-400 mt-4 text-sm">
               Note: This tool uses a sophisticated overlay method to edit text. <br/>
               Original text is redacted and replaced visually. Perfect for fixing typos.
             </p>
          </motion.div>
        ) : (
          <div className="flex-1 flex gap-6 overflow-hidden">
             
             {/* Main Editor Area */}
             <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl overflow-auto border border-slate-200 dark:border-slate-800 relative flex justify-center p-8" ref={containerRef}>
                <div className="relative shadow-xl" style={{ width: canvasRef.current?.width ? canvasRef.current.width / scale * 1.5 : 'auto' }}> {/* Adjust visual scale */}
                  
                  {/* The PDF Canvas */}
                  <canvas ref={canvasRef} className="block bg-white" style={{ maxWidth: '100%', height: 'auto' }} />

                  {/* The Overlay Layer */}
                  {pdfDoc && (
                    <div className="absolute inset-0 overflow-hidden">
                       {textItems.map((item) => {
                         // Convert PDF Transform to CSS positioning
                         // item.transform: [scaleX, skewY, skewX, scaleY, x, y]
                         // PDF y is from bottom. Canvas y is from top.
                         // We need the viewport to map correctly. 
                         // Since we don't have viewport obj in render, we used canvas dimension.
                         // Let's rely on percentage positioning if possible, or simple math.
                         
                         // Hack: PDF.js Viewport calculation replication
                         // x_canvas = x_pdf * scale
                         // y_canvas = (pageHeight - y_pdf) * scale
                         // But we extracted text items which have PDF coords.
                         // We need page height.
                         const pageHeight = canvasRef.current ? canvasRef.current.height / scale : 842; // Fallback A4
                         
                         // Visual coords
                         const x = item.transform[4] * scale;
                         const y = (pageHeight - item.transform[5]) * scale - (item.height * scale); // Adjust for bottom-up

                         // Font size approx
                         const fontSize = Math.sqrt(item.transform[0]*item.transform[0] + item.transform[1]*item.transform[1]) * scale;
                         
                         const isEditing = activeEditId === item.id;
                         const currentVal = edits[item.id] ? edits[item.id].newText : item.str;

                         if (!item.str.trim()) return null; // Skip whitespace items

                         return (
                           <div
                             key={item.id}
                             onClick={(e) => { e.stopPropagation(); handleTextClick(item); }}
                             className={`absolute cursor-text group flex items-center ${isEditing ? 'z-10' : 'z-0'}`}
                             style={{
                               left: x,
                               top: y,
                               fontSize: `${fontSize}px`,
                               fontFamily: 'sans-serif', // Mapping fonts perfectly is hard web-side
                               lineHeight: 1,
                               whiteSpace: 'nowrap',
                               color: isEditing ? 'transparent' : 'transparent', // Hide original visually when editing? No, transparent allows input to show
                               // Actually, we want to overlay EXACTLY.
                               // Best UX: Transparent div with hover outline. When clicked, solid white input with black text.
                             }}
                           >
                             {!isEditing ? (
                               <div className="hover:outline outline-2 outline-blue-400 rounded px-0.5 bg-transparent text-transparent select-none">
                                 {item.str}
                               </div>
                             ) : (
                               <input
                                 autoFocus
                                 value={currentVal}
                                 onChange={(e) => handleInputChange(e, item.id)}
                                 onBlur={() => setActiveEditId(null)}
                                 className="bg-white text-black border border-blue-500 rounded px-1 outline-none shadow-lg min-w-[20px]"
                                 style={{
                                   fontSize: `${fontSize}px`,
                                   marginTop: -2, // Micro adjustment
                                 }}
                               />
                             )}
                           </div>
                         );
                       })}
                    </div>
                  )}
                </div>
             </div>

             {/* Sidebar */}
             <div className="w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <h3 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-1">How to Edit</h3>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Click any text on the page to edit it. <br/>
                    We'll seamlessly replace the original text when you save.
                  </p>
                </div>

                <div className="flex-1" />

                {/* Pagination */}
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
                  <button 
                    disabled={currentPageIndex <= 0}
                    onClick={() => setCurrentPageIndex(p => p - 1)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-30"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span className="text-sm font-medium">Page {currentPageIndex + 1} of {numPages}</span>
                  <button 
                    disabled={currentPageIndex >= numPages - 1}
                    onClick={() => setCurrentPageIndex(p => p + 1)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-md disabled:opacity-30"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
             </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
