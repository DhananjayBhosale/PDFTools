import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { loadPDFDocument, applySignaturesToPDF, SignaturePlacement } from '../../services/pdfService';
import { 
  FileSignature, Loader2, Save, Undo2, Pen, Type, Upload as UploadIcon, 
  Trash2, Grip, Plus, Eraser, Check, X, MousePointer2, ArrowLeft, ArrowRight 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';

// --- TYPE DEFINITIONS ---
interface SignatureItem extends SignaturePlacement {
  localId: string; // Internal ID for React keys
}

interface PageData {
  pageIndex: number;
  viewportWidth: number;
  viewportHeight: number;
  aspectRatio: number;
}

// --- SUB-COMPONENTS ---

// 1. Draggable Signature Overlay
const DraggableSignature: React.FC<{
  item: SignatureItem;
  containerRef: React.RefObject<HTMLDivElement>;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<SignatureItem>) => void;
  onDelete: (id: string) => void;
}> = ({ item, containerRef, isSelected, onSelect, onUpdate, onDelete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const initialResize = useRef({ w: 0, x: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isDragging) {
        const xPixels = clientX - containerRect.left - dragOffset.current.x;
        const yPixels = clientY - containerRect.top - dragOffset.current.y;
        
        // Clamp to boundaries
        const maxX = containerRect.width - (item.width * containerRect.width);
        const maxY = containerRect.height - ((item.width * containerRect.width) / item.aspectRatio);
        
        const clampedX = Math.max(0, Math.min(xPixels, maxX));
        const clampedY = Math.max(0, Math.min(yPixels, maxY));

        onUpdate(item.localId, {
          x: clampedX / containerRect.width,
          y: clampedY / containerRect.height
        });
      }

      if (isResizing) {
        const deltaX = clientX - initialResize.current.x;
        const newWidthPixels = initialResize.current.w + deltaX;
        
        // Min/Max size constraints
        const minW = 50;
        const maxW = containerRect.width * 0.8;
        const finalW = Math.max(minW, Math.min(newWidthPixels, maxW));
        
        onUpdate(item.localId, {
          width: finalW / containerRect.width
        });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, isResizing, item.localId, item.width, item.aspectRatio, onUpdate, containerRef]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onSelect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const rect = (e.target as HTMLElement).closest('.draggable-item')?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
      setIsDragging(true);
    }
  };

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const rect = (e.target as HTMLElement).closest('.draggable-item')?.getBoundingClientRect();
    if (rect) {
      initialResize.current = { w: rect.width, x: clientX };
      setIsResizing(true);
    }
  };

  // Render logic
  // Positions are stored as percentages (0-1), convert to % style
  const style = {
    left: `${item.x * 100}%`,
    top: `${item.y * 100}%`,
    width: `${item.width * 100}%`,
    aspectRatio: `${item.aspectRatio}`,
  };

  return (
    <div
      className={`draggable-item absolute z-10 cursor-move group select-none ${isSelected ? 'z-20' : ''}`}
      style={style}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      <div className={`relative w-full h-full ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'hover:ring-1 hover:ring-blue-300'}`}>
        <img src={item.dataUrl} alt="Signature" className="w-full h-full object-contain pointer-events-none" />
        
        {/* Controls (Only show when selected) */}
        {isSelected && (
          <>
            {/* Delete Button */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.localId); }}
              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-sm hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
            
            {/* Resize Handle */}
            <div
              onMouseDown={startResize}
              onTouchStart={startResize}
              className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center cursor-nwse shadow-sm hover:scale-110 transition-transform"
            >
              <Grip size={12} className="text-blue-500" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 2. Signature Creation Modal
const SignatureModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  
  // Draw State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Type State
  const [typedText, setTypedText] = useState('');
  const [fontFamily, setFontFamily] = useState('cursive');
  
  // Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Drawing Logic
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    if (activeTab === 'draw' && canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    } else if (activeTab === 'type' && typedText) {
      // Convert text to image via canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 600;
        canvas.height = 200;
        ctx.font = `60px ${fontFamily}`; // Using generic cursive or loaded fonts
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        ctx.fillText(typedText, 300, 100);
        onSave(canvas.toDataURL('image/png'));
      }
    } else if (activeTab === 'upload' && uploadedImage) {
      onSave(uploadedImage);
    }
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setUploadedImage(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
      >
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'draw', icon: Pen, label: 'Draw' },
            { id: 'type', icon: Type, label: 'Type' },
            { id: 'upload', icon: UploadIcon, label: 'Upload' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 flex items-center justify-center gap-2 font-medium transition-colors
                ${activeTab === tab.id 
                  ? 'bg-white dark:bg-slate-900 text-blue-600 border-b-2 border-blue-600' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }
              `}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 min-h-[300px] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
          {activeTab === 'draw' && (
            <div className="w-full">
              <div className="bg-white rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden touch-none">
                 <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    className="w-full h-auto cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                 />
              </div>
              <button onClick={clearCanvas} className="text-sm text-slate-500 hover:text-red-500 flex items-center gap-1">
                <Eraser size={14} /> Clear
              </button>
            </div>
          )}

          {activeTab === 'type' && (
            <div className="w-full space-y-4">
              <input
                type="text"
                placeholder="Type your name"
                className="w-full p-4 text-2xl text-center border-b-2 border-slate-300 dark:border-slate-700 bg-transparent outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                style={{ fontFamily }}
              />
              <div className="flex gap-2 justify-center">
                 {['cursive', 'fantasy', 'monospace'].map(font => (
                   <button 
                     key={font} 
                     onClick={() => setFontFamily(font)}
                     className={`px-3 py-1 rounded border ${fontFamily === font ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                     style={{ fontFamily: font }}
                   >
                     Sample
                   </button>
                 ))}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="w-full text-center">
               <label className="cursor-pointer block border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 hover:border-blue-500 transition-colors bg-white dark:bg-slate-900">
                 <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                 {uploadedImage ? (
                   <img src={uploadedImage} alt="Preview" className="max-h-32 mx-auto object-contain" />
                 ) : (
                   <div className="flex flex-col items-center gap-2 text-slate-500">
                     <UploadIcon size={32} />
                     <span>Click to upload image</span>
                   </div>
                 )}
               </label>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            Use Signature
          </button>
        </div>
      </motion.div>
    </div>
  );
};


// --- MAIN COMPONENT ---
export const SignPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0); // Viewer scale
  
  // Signature State
  const [activeSignatureUrl, setActiveSignatureUrl] = useState<string | null>(null); // The currently "held" signature to place
  const [placedSignatures, setPlacedSignatures] = useState<SignatureItem[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load File
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

  // 2. Render Page
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      
      const page = await pdfDoc.getPage(currentPageIndex + 1);
      
      // Calculate responsive scale
      const containerWidth = pageContainerRef.current?.parentElement?.clientWidth || 800;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const responsiveScale = Math.min(1.5, (containerWidth - 48) / unscaledViewport.width);
      setScale(responsiveScale);

      const viewport = page.getViewport({ scale: responsiveScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;
    };

    renderPage();
  }, [pdfDoc, currentPageIndex]); // Recalculate on page/doc change (resize omitted for brevity)

  // 3. Handlers
  const handleCreateSignature = (dataUrl: string) => {
    // Add new signature to current page center
    const newSig: SignatureItem = {
      id: uuidv4(),
      localId: uuidv4(),
      pageIndex: currentPageIndex,
      dataUrl,
      x: 0.35, // Center-ish
      y: 0.4,
      width: 0.3, // 30% width default
      aspectRatio: 2 // Default assumption, will correct if image loads but usually fine for signatures
    };
    
    // Load image to get true aspect ratio for better UX
    const img = new Image();
    img.onload = () => {
      newSig.aspectRatio = img.width / img.height;
      setPlacedSignatures(prev => [...prev, newSig]);
      setSelectedSignatureId(newSig.localId);
    };
    img.src = dataUrl;
  };

  const updateSignature = (id: string, updates: Partial<SignatureItem>) => {
    setPlacedSignatures(prev => prev.map(sig => sig.localId === id ? { ...sig, ...updates } : sig));
  };

  const deleteSignature = (id: string) => {
    setPlacedSignatures(prev => prev.filter(sig => sig.localId !== id));
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Embedding signatures...' });
    
    try {
      const pdfBytes = await applySignaturesToPDF(file.file, placedSignatures);
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed-${file.name}`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (e) {
      console.error(e);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to save.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
         <div>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back</Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Sign PDF
            </h1>
         </div>
         {file && (
           <div className="flex gap-2">
             <button onClick={() => setFile(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
               Cancel
             </button>
             <button onClick={handleSave} disabled={status.isProcessing || placedSignatures.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
               {status.isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Save Signed PDF
             </button>
           </div>
         )}
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto mt-20">
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to sign" />
             <p className="text-center text-slate-400 mt-4 text-sm">
               Securely sign your documents locally. <br/>
               Signatures are never uploaded to any server.
             </p>
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
             
             {/* Left: Viewer & Overlay */}
             <div className="flex-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl overflow-auto border border-slate-200 dark:border-slate-800 relative flex justify-center p-8 select-none" 
                  onClick={() => setSelectedSignatureId(null)}>
                
                <div 
                  ref={pageContainerRef} 
                  className="relative shadow-xl bg-white"
                  style={{ width: canvasRef.current?.width || 'auto', height: canvasRef.current?.height || 'auto' }}
                >
                  <canvas ref={canvasRef} className="block pointer-events-none" />
                  
                  {/* Signatures for Current Page */}
                  {placedSignatures
                    .filter(s => s.pageIndex === currentPageIndex)
                    .map(sig => (
                      <DraggableSignature 
                        key={sig.localId}
                        item={sig}
                        containerRef={pageContainerRef}
                        isSelected={selectedSignatureId === sig.localId}
                        onSelect={() => setSelectedSignatureId(sig.localId)}
                        onUpdate={updateSignature}
                        onDelete={deleteSignature}
                      />
                    ))
                  }
                </div>
             </div>

             {/* Right: Sidebar Controls */}
             <div className="w-full md:w-72 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4">
                
                {/* Add Signature Button */}
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl font-bold flex flex-col items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <div className="p-2 bg-blue-500 text-white rounded-full"><Plus size={24} /></div>
                  Create Signature
                </button>

                <div className="text-xs text-slate-400 text-center">
                   Drag signatures to position. <br/> Use handles to resize.
                </div>
                
                <div className="flex-1 overflow-y-auto">
                   <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-sm">Placed Signatures</h3>
                   {placedSignatures.length === 0 ? (
                     <p className="text-sm text-slate-500 italic">No signatures added yet.</p>
                   ) : (
                     <div className="space-y-2">
                       {placedSignatures.map((sig, i) => (
                         <div 
                           key={sig.localId} 
                           onClick={() => { setCurrentPageIndex(sig.pageIndex); setSelectedSignatureId(sig.localId); }}
                           className={`p-2 rounded-lg border text-sm flex items-center gap-3 cursor-pointer ${selectedSignatureId === sig.localId ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                         >
                           <img src={sig.dataUrl} className="w-8 h-8 object-contain bg-white rounded border border-slate-200" alt="" />
                           <div className="flex-1">
                             <div className="font-medium">Signature {i + 1}</div>
                             <div className="text-xs text-slate-500">Page {sig.pageIndex + 1}</div>
                           </div>
                           <button onClick={(e) => { e.stopPropagation(); deleteSignature(sig.localId); }} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-lg p-2 mt-auto">
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

      <SignatureModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleCreateSignature}
      />
    </div>
  );
};