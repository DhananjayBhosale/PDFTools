import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, FileImage, Loader2, ScanLine, Trash2 } from 'lucide-react';
import { ProcessingStatus } from '../../types';
import { createPDFFromImages } from '../../services/pdfDocument';
import { downloadBlob } from '../../services/pdfShared';
import { StatusToast } from '../UI/StatusToast';

interface CapturedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export const MakePDF: React.FC = () => {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(
    () => images.reduce((sum, image) => sum + image.file.size, 0),
    [images],
  );

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.previewUrl.startsWith('blob:')) URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, [images]);

  const appendFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: uuidv4(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
    setImages((prev) => [...prev, ...next]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= images.length || toIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleBuildPdf = async () => {
    if (images.length === 0) return;
    setStatus({ isProcessing: true, progress: 10, message: 'Building scanned PDF...' });
    try {
      const bytes = await createPDFFromImages(images.map((item) => item.file));
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `scanned-${Date.now()}.pdf`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to build PDF' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Make PDF</h1>
        <p className="text-slate-500 dark:text-slate-400">Capture or import photos and export them as a PDF document.</p>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => appendFiles(event.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => appendFiles(event.target.files)}
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-all flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            <span>Scan from Camera</span>
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <FileImage size={18} />
            <span>Add from Gallery</span>
          </button>
          <div className="text-sm text-slate-500 sm:ml-auto">
            {images.length} page{images.length === 1 ? '' : 's'} • {(totalSize / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {images.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400"
          >
            <ScanLine className="mx-auto mb-3" size={34} />
            <p>Add one or more photos to start building your scanned PDF.</p>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pb-28">
            {images.map((image, index) => (
              <div key={image.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <img src={image.previewUrl} alt={`Scan ${index + 1}`} className="w-full sm:w-20 h-44 sm:h-24 object-cover rounded-md border border-slate-200 dark:border-slate-800" />
                <div className="flex-1 min-w-0 w-full">
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{image.file.name}</div>
                  <div className="text-xs text-slate-500">Page {index + 1} • {(image.file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => moveImage(index, index - 1)}
                    disabled={index === 0}
                    className="px-2 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                  >
                    Up
                  </button>
                  <button
                    onClick={() => moveImage(index, index + 1)}
                    disabled={index === images.length - 1}
                    className="px-2 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                  >
                    Down
                  </button>
                  <button
                    onClick={() => removeImage(image.id)}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    title="Remove image"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed left-0 right-0 flex justify-center pointer-events-none z-20" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleBuildPdf}
          disabled={status.isProcessing || images.length === 0}
          className="pointer-events-auto shadow-2xl px-6 sm:px-8 py-3 rounded-xl font-bold text-white bg-cyan-600 hover:bg-cyan-700 transition-all flex items-center gap-2 disabled:opacity-50 text-sm sm:text-base"
        >
          {status.isProcessing ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
          <span>Export Scanned PDF</span>
        </button>
      </div>
      <div className="h-24" />
      <StatusToast status={status} />
    </div>
  );
};
