import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, UploadCloud } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useOpenedPdf } from '../../hooks/useOpenedPdf';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  label?: string;
}

const getAcceptLabel = (accept: string) => {
  const normalized = accept.toLowerCase();

  if (normalized.includes('image/*')) return 'Images';
  if (normalized.includes('application/pdf') || normalized.includes('.pdf')) return 'PDF';

  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.replace(/^\./, '').replace('*', 'all'));

  return parts.length ? parts.join(' / ') : 'Files';
};

const MetaPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
    {children}
  </span>
);

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept,
  multiple = false,
  label = 'Drop your PDF here',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [didAutoUseOpenedPdf, setDidAutoUseOpenedPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const { openedPdf } = useOpenedPdf();

  const acceptLabel = useMemo(() => getAcceptLabel(accept), [accept]);
  const acceptsPdf = accept.toLowerCase().includes('.pdf') || accept.toLowerCase().includes('application/pdf');
  const routeState = location.state as { useOpenedPdf?: boolean; openedPdfId?: string } | null;
  const canUseOpenedPdf = Boolean(openedPdf && acceptsPdf && !multiple);

  useEffect(() => {
    if (!canUseOpenedPdf || !routeState?.useOpenedPdf || didAutoUseOpenedPdf || !openedPdf) return;

    setDidAutoUseOpenedPdf(true);
    onFilesSelected([openedPdf.file]);
  }, [canUseOpenedPdf, didAutoUseOpenedPdf, onFilesSelected, openedPdf, routeState?.useOpenedPdf]);

  const triggerPicker = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerPicker();
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={handleKeyDown}
      onClick={triggerPicker}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className={[
        'group relative w-full overflow-hidden rounded-3xl border transition-all duration-300 outline-none',
        'border-solid shadow-[0_18px_44px_rgba(15,23,42,0.05)]',
        isDragging
          ? 'border-cyan-400 bg-cyan-50/75 dark:border-cyan-400 dark:bg-cyan-500/10'
          : 'border-slate-200 bg-white/90 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-cyan-500/50',
      ].join(' ')}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
      />

      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/70 via-transparent to-slate-100/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-900/30 dark:to-slate-800/20" />

      <div className="relative p-5 sm:p-6">
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center rounded-lg bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            Drop Zone
          </span>
        </div>

        <div
          className={[
            'rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors sm:px-8 sm:py-10',
            isDragging
              ? 'border-cyan-400 bg-cyan-50/70 dark:border-cyan-400 dark:bg-cyan-500/10'
              : 'border-slate-300 bg-slate-50/65 dark:border-slate-700 dark:bg-slate-900/40',
          ].join(' ')}
        >
          <motion.div
            animate={reduceMotion ? undefined : isDragging ? { scale: [1, 1.06, 1] } : { y: [0, -2, 0] }}
            transition={reduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-blue-500 shadow-md dark:bg-slate-900"
          >
            <UploadCloud size={30} />
          </motion.div>

          <h3 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{label}</h3>
          <p className="mt-2 text-base font-medium text-slate-500 dark:text-slate-400">Keyboard and drag supported</p>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              triggerPicker();
            }}
            className="mt-7 inline-flex items-center rounded-2xl bg-orange-500 px-8 py-3 text-lg font-bold text-white shadow-[0_10px_22px_rgba(249,115,22,0.35)] transition-colors hover:bg-orange-600"
          >
            Browse files
          </button>

          {canUseOpenedPdf && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (openedPdf) onFilesSelected([openedPdf.file]);
              }}
              className="ml-2 mt-7 inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-3 text-lg font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200"
            >
              <FileText size={18} />
              Use current PDF
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <MetaPill>{acceptLabel}</MetaPill>
            <MetaPill>{multiple ? 'Multiple files' : 'Single file'}</MetaPill>
            <MetaPill>Local processing</MetaPill>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
