import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Loader2,
  Move,
  PenLine,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { ChefSlider } from '../UI/ChefSlider';
import { ZoomControls } from '../UI/ZoomControls';
import { PDFFile, ProcessingStatus } from '../../types';
import { useZoom } from '../../hooks/useZoom';
import { loadPDFDocument } from '../../services/pdfBrowser';
import { applySignaturesToPDF } from '../../services/pdfDocument';
import { downloadBlob } from '../../services/pdfShared';

interface SignatureItem {
  localId: string;
  id: string;
  pageIndex: number;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  aspectRatio: number;
}

type EditMode = 'drag' | 'resize' | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampWidth = (value: number) => clamp(value, 0.1, 0.8);

const getPoint = (event: PointerEvent | React.PointerEvent) => ({ x: event.clientX, y: event.clientY });

const createTransparentSignature = async (dataUrl: string, threshold = 242) => {
  const image = new Image();
  image.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to process signature image.'));
    image.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const softness = 18;

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    if (brightness >= threshold) {
      pixels[index + 3] = 0;
      continue;
    }

    if (brightness > threshold - softness) {
      const distance = threshold - brightness;
      pixels[index + 3] = Math.round((distance / softness) * pixels[index + 3]);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

const SignatureOverlay: React.FC<{
  item: SignatureItem;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<SignatureItem>) => void;
  onDelete: (id: string) => void;
}> = ({ item, containerRef, isSelected, onSelect, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const modeRef = useRef<EditMode>(null);
  const originRef = useRef({
    clientX: 0,
    clientY: 0,
    x: item.x,
    y: item.y,
    width: item.width,
    aspectRatio: item.aspectRatio,
  });

  const startEdit = (event: React.PointerEvent, mode: Exclude<EditMode, null>) => {
    event.stopPropagation();
    onSelect();
    const point = getPoint(event);
    modeRef.current = mode;
    originRef.current = {
      clientX: point.x,
      clientY: point.y,
      x: item.x,
      y: item.y,
      width: item.width,
      aspectRatio: item.aspectRatio,
    };
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;

    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current || !modeRef.current) return;
      const point = getPoint(event);
      const dx = point.x - originRef.current.clientX;
      const dy = point.y - originRef.current.clientY;
      const rect = containerRef.current.getBoundingClientRect();

      if (modeRef.current === 'drag') {
        const nextX = clamp(originRef.current.x + dx / rect.width, 0, 1 - originRef.current.width);
        const nextY = clamp(
          originRef.current.y + dy / rect.height,
          0,
          1 - originRef.current.width / originRef.current.aspectRatio,
        );
        onUpdate(item.localId, { x: nextX, y: nextY });
      } else if (modeRef.current === 'resize') {
        const rawWidth = originRef.current.width + dx / rect.width;
        const maxWidthByX = 1 - originRef.current.x;
        const maxWidthByY = (1 - originRef.current.y) * originRef.current.aspectRatio;
        const maxWidth = Math.max(0.1, Math.min(0.9, maxWidthByX, maxWidthByY));
        const nextWidth = clampWidth(clamp(rawWidth, 0.1, maxWidth));
        onUpdate(item.localId, { width: nextWidth });
      }
    };

    const handleUp = () => {
      modeRef.current = null;
      setEditing(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [containerRef, editing, item.localId, onUpdate]);

  return (
    <div
      className={`absolute z-20 cursor-move ${isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 ring-blue-300'}`}
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        width: `${item.width * 100}%`,
        aspectRatio: item.aspectRatio,
      }}
      onPointerDown={(event) => startEdit(event, 'drag')}
      onClick={(event) => event.stopPropagation()}
    >
      <img src={item.dataUrl} alt="Signature" className="pointer-events-none h-full w-full object-contain" />
      {isSelected && (
        <>
          <button
            className="absolute -right-3 -top-3 rounded-full bg-rose-600 p-1 text-white"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.localId);
            }}
          >
            <X size={12} />
          </button>
          <button
            className="absolute -bottom-3 -right-3 rounded-full bg-blue-600 p-1.5 text-white shadow"
            onPointerDown={(event) => startEdit(event, 'resize')}
          >
            <Expand size={12} />
          </button>
        </>
      )}
    </div>
  );
};

const PDFPageCanvas: React.FC<{
  pdfDoc: any;
  pageIndex: number;
  zoom: number;
  signatures: SignatureItem[];
  selectedSignatureId: string | null;
  onSelectSignature: (id: string) => void;
  onUpdateSignature: (id: string, updates: Partial<SignatureItem>) => void;
  onDeleteSignature: (id: string) => void;
  onBackgroundClick: () => void;
}> = ({
  pdfDoc,
  pageIndex,
  zoom,
  signatures,
  selectedSignatureId,
  onSelectSignature,
  onUpdateSignature,
  onDeleteSignature,
  onBackgroundClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 850 });

  useEffect(() => {
    setRendered(false);
  }, [pageIndex]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '500px' },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const render = async () => {
      if (!visible || rendered || !canvasRef.current || !pdfDoc) return;
      const page = await pdfDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 2 });
      setDimensions({ width: viewport.width / 2, height: viewport.height / 2 });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      setRendered(true);
    };
    void render();
  }, [pageIndex, pdfDoc, rendered, visible]);

  return (
    <div
      className="relative mb-4 bg-white shadow-lg"
      style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}
    >
      <div
        ref={containerRef}
        className="relative origin-top-left bg-white"
        style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${zoom})` }}
        onClick={onBackgroundClick}
      >
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-500">
            <Loader2 className="animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {signatures.map((signature) => (
          <SignatureOverlay
            key={signature.localId}
            item={signature}
            containerRef={containerRef}
            isSelected={selectedSignatureId === signature.localId}
            onSelect={() => onSelectSignature(signature.localId)}
            onUpdate={onUpdateSignature}
            onDelete={onDeleteSignature}
          />
        ))}
      </div>
    </div>
  );
};

export const SignPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [uploadedSignatureSource, setUploadedSignatureSource] = useState('');
  const [uploadedSignature, setUploadedSignature] = useState('');
  const [transparentUpload, setTransparentUpload] = useState(true);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0);

  const pageCount = pdfDoc?.numPages || 0;
  const selectedSignature = signatures.find((signature) => signature.localId === selectedSignatureId) || null;
  const pageSignatures = useMemo(
    () => signatures.filter((signature) => signature.pageIndex === currentPageIndex),
    [currentPageIndex, signatures],
  );

  useEffect(() => {
    if (!selectedSignatureId) return;
    if (!signatures.some((signature) => signature.localId === selectedSignatureId)) {
      setSelectedSignatureId(null);
    }
  }, [selectedSignatureId, signatures]);

  useEffect(() => {
    return () => {
      if (pdfDoc?.destroy) void pdfDoc.destroy();
    };
  }, [pdfDoc]);

  useEffect(() => {
    let cancelled = false;

    if (!uploadedSignatureSource) {
      setUploadedSignature('');
      setIsPreparingUpload(false);
      return undefined;
    }

    if (!transparentUpload) {
      setUploadedSignature(uploadedSignatureSource);
      setIsPreparingUpload(false);
      return undefined;
    }

    setIsPreparingUpload(true);

    void createTransparentSignature(uploadedSignatureSource)
      .then((nextSignature) => {
        if (!cancelled) {
          setUploadedSignature(nextSignature);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setUploadedSignature(uploadedSignatureSource);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingUpload(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transparentUpload, uploadedSignatureSource]);

  const selectSignature = (id: string | null) => {
    setSelectedSignatureId(id);
    if (!id) return;
    const target = signatures.find((signature) => signature.localId === id);
    if (target) setCurrentPageIndex(target.pageIndex);
  };

  const updateSignature = (id: string, updates: Partial<SignatureItem>) => {
    setSignatures((previous) =>
      previous.map((signature) =>
        signature.localId === id
          ? {
              ...signature,
              ...updates,
              width: updates.width !== undefined ? clampWidth(updates.width) : signature.width,
            }
          : signature,
      ),
    );
  };

  const deleteSignature = (id: string) => {
    setSignatures((previous) => previous.filter((signature) => signature.localId !== id));
    if (selectedSignatureId === id) setSelectedSignatureId(null);
  };

  const jumpToPage = (nextIndex: number) => {
    if (!pageCount) return;
    setCurrentPageIndex(clamp(nextIndex, 0, pageCount - 1));
  };

  const updateSelectedSignaturePage = (nextIndex: number) => {
    if (!selectedSignature) return;
    const clampedIndex = clamp(nextIndex, 0, Math.max(0, pageCount - 1));
    updateSignature(selectedSignature.localId, { pageIndex: clampedIndex });
    setCurrentPageIndex(clampedIndex);
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) return;
    const selected = files[0];
    setFile({ id: uuidv4(), file: selected, name: selected.name, size: selected.size });
    setSignatures([]);
    setSelectedSignatureId(null);
    setCurrentPageIndex(0);

    try {
      const doc = await loadPDFDocument(selected);
      setPdfDoc(doc);
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to load PDF.' });
    }
  };

  const addSignature = (dataUrl: string) => {
    const nextSignature: SignatureItem = {
      localId: uuidv4(),
      id: uuidv4(),
      pageIndex: currentPageIndex,
      dataUrl,
      x: 0.35,
      y: 0.45,
      width: 0.28,
      aspectRatio: 2,
    };

    const image = new Image();
    image.onload = () => {
      nextSignature.aspectRatio = image.width / Math.max(1, image.height);
      setSignatures((previous) => [...previous, nextSignature]);
      setSelectedSignatureId(nextSignature.localId);
    };
    image.src = dataUrl;
  };

  const handleSave = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Applying signatures...' });
    try {
      const bytes = await applySignaturesToPDF(file.file, signatures);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `signed-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to export signed PDF.' });
    }
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    context.lineWidth = 2.6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#111827';
    setHasDrawnSignature(false);
  };

  useEffect(() => {
    if (!showModal) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const initializeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const targetHeight = window.innerWidth < 640 ? 180 : 220;
      canvas.style.width = '100%';
      canvas.style.height = `${targetHeight}px`;

      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.floor(rect.width));
      const cssHeight = Math.max(1, Math.floor(rect.height));

      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);
      clearSignatureCanvas();
    };

    const raf = window.requestAnimationFrame(initializeCanvas);
    window.addEventListener('resize', initializeCanvas);
    setSignatureMode('draw');
    setTransparentUpload(true);
    setUploadedSignatureSource('');
    setUploadedSignature('');

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', initializeCanvas);
    };
  }, [showModal]);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onDrawStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (signatureMode !== 'draw') return;
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);
    if (!context || !point) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const onDrawMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || signatureMode !== 'draw') return;
    event.preventDefault();
    const context = signatureCanvasRef.current?.getContext('2d');
    const point = getCanvasPoint(event);
    if (!context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawnSignature(true);
  };

  const onDrawEnd = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (event && signatureCanvasRef.current?.hasPointerCapture(event.pointerId)) {
      signatureCanvasRef.current.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  };

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setUploadedSignatureSource(reader.result);
    };
    reader.readAsDataURL(selected);
  };

  const applySignatureFromModal = () => {
    const drawn = signatureCanvasRef.current?.toDataURL('image/png') || '';
    const selected = signatureMode === 'upload' ? uploadedSignature : hasDrawnSignature ? drawn : '';
    if (!selected) return;
    addSignature(selected);
    setShowModal(false);
  };

  return (
    <div className="mx-auto flex h-[100dvh] min-h-[100dvh] w-full max-w-7xl flex-col px-4 py-4 sm:py-6">
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            ← Back
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Sign PDF</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create stamp, place precisely, export.</p>
        </div>
        {file && (
          <div className="flex w-full sm:w-auto gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-950 shadow-sm shadow-emerald-200/70 transition-colors hover:border-emerald-300 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-none dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100 dark:shadow-black/20 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/25"
            >
              <Plus size={18} /> Add signature
            </button>
            <button
              onClick={handleSave}
              disabled={status.isProcessing || signatures.length === 0}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {status.isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Export
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl">
            <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to add a signature" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{file.name}</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => jumpToPage(currentPageIndex - 1)}
                    disabled={currentPageIndex <= 0}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Page {currentPageIndex + 1} / {Math.max(1, pageCount)}
                  </div>
                  <button
                    onClick={() => jumpToPage(currentPageIndex + 1)}
                    disabled={!pageCount || currentPageIndex >= pageCount - 1}
                    className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-auto p-3 sm:p-6">
                {pdfDoc ? (
                  <div className="flex flex-col items-center">
                    <PDFPageCanvas
                      key={currentPageIndex}
                      pdfDoc={pdfDoc}
                      pageIndex={currentPageIndex}
                      zoom={zoom}
                      signatures={pageSignatures}
                      selectedSignatureId={selectedSignatureId}
                      onSelectSignature={selectSignature}
                      onUpdateSignature={updateSignature}
                      onDeleteSignature={deleteSignature}
                      onBackgroundClick={() => selectSignature(null)}
                    />
                    <div className="h-16" />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <Loader2 className="mr-2 animate-spin" /> Loading pages...
                  </div>
                )}
              </div>

              <div className="absolute bottom-6 right-6 z-30">
                <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
              </div>
            </div>

            <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Signature Stamps</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Select a stamp to edit page and size.</div>
              </div>

              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
                {signatures.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                    Add your first signature stamp to begin.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {signatures.map((signature, index) => (
                      <button
                        key={signature.localId}
                        onClick={() => selectSignature(signature.localId)}
                        className={`w-full rounded-xl border px-3 py-2 text-left ${
                          selectedSignatureId === signature.localId
                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">Stamp {index + 1}</div>
                          <div className="text-xs opacity-70">Page {signature.pageIndex + 1}</div>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs opacity-75">
                          <Move size={12} /> Move • <Expand size={12} /> Resize
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedSignature && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Selected Stamp</div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Page</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateSelectedSignaturePage(selectedSignature.pageIndex - 1)}
                          disabled={selectedSignature.pageIndex <= 0}
                          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <select
                          value={selectedSignature.pageIndex}
                          onChange={(event) => updateSelectedSignaturePage(Number(event.target.value))}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {Array.from({ length: Math.max(1, pageCount) }, (_, index) => (
                            <option key={index} value={index}>
                              Page {index + 1}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateSelectedSignaturePage(selectedSignature.pageIndex + 1)}
                          disabled={!pageCount || selectedSignature.pageIndex >= pageCount - 1}
                          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Size ({Number((selectedSignature.width * 100).toFixed(2))}% width)
                      </label>
                      <ChefSlider
                        min={10}
                        max={80}
                        step={0.25}
                        value={Number((selectedSignature.width * 100).toFixed(2))}
                        onChange={(next) => updateSignature(selectedSignature.localId, { width: next / 100 })}
                        ariaLabel="Signature width"
                      />
                    </div>

                    <button
                      onClick={() => deleteSignature(selectedSignature.localId)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                      <Trash2 size={14} /> Remove stamp
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Position and size in preview are preserved in export.
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[96vw] max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <PenLine size={18} /> Create Signature Stamp
            </h3>

            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setSignatureMode('draw')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  signatureMode === 'draw'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Draw
              </button>
              <button
                onClick={() => setSignatureMode('upload')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  signatureMode === 'upload'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Upload
              </button>
            </div>

            {signatureMode === 'draw' ? (
              <div className="mb-4">
                <canvas
                  ref={signatureCanvasRef}
                  onPointerDown={onDrawStart}
                  onPointerMove={onDrawMove}
                  onPointerUp={onDrawEnd}
                  onPointerLeave={onDrawEnd}
                  onPointerCancel={onDrawEnd}
                  className="h-[220px] w-full touch-none rounded-xl border border-slate-300 bg-white dark:border-slate-700"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={clearSignatureCanvas}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                <label className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 hover:border-blue-400 dark:border-slate-700 dark:text-slate-300">
                  Choose signature image
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                  <span className="font-medium">Transparent background</span>
                  <input
                    type="checkbox"
                    checked={transparentUpload}
                    onChange={(event) => setTransparentUpload(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Best for signature photos on white paper.
                </div>
                {uploadedSignature && (
                  <div
                    className="flex min-h-32 items-center justify-center rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    style={{
                      backgroundColor: '#f8fafc',
                      backgroundImage:
                        'linear-gradient(45deg, rgba(148,163,184,0.14) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,0.14) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,0.14) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,0.14) 75%)',
                      backgroundSize: '18px 18px',
                      backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0px',
                    }}
                  >
                    <img src={uploadedSignature} alt="Uploaded signature" className="max-h-28 object-contain" />
                  </div>
                )}
                {isPreparingUpload && (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="animate-spin" size={14} />
                    Preparing transparent preview...
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500">
                Cancel
              </button>
              <button
                onClick={applySignatureFromModal}
                disabled={signatureMode === 'upload' ? !uploadedSignature || isPreparingUpload : !hasDrawnSignature}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Stamp
              </button>
            </div>
          </div>
        </div>
      )}

      {status.error && <div className="fixed bottom-3 right-3 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white">{status.error}</div>}
    </div>
  );
};
