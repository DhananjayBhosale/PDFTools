import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import {
  Archive,
  Crop,
  Download,
  FileCheck,
  FileImage,
  Heading,
  Loader2,
  ScanSearch,
  ShieldOff,
  StickyNote,
} from 'lucide-react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import {
  addHeaderFooterToPDF,
  cropPDFMargins,
  removeBlankPagesFromPDF,
  removePDFAnnotations,
  removePDFMetadata,
  sanitizePDF,
} from '../../services/pdfDocument';
import { extractEmbeddedImagesFromPDF, loadPDFDocument, type EmbeddedPdfImageAsset } from '../../services/pdfBrowser';
import { downloadBlob } from '../../services/pdfShared';

type ToolTone = 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';

const toneClasses: Record<ToolTone, { icon: string; button: string }> = {
  cyan: {
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    button: 'bg-cyan-600 hover:bg-cyan-700',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    button: 'bg-emerald-600 hover:bg-emerald-700',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    button: 'bg-amber-600 hover:bg-amber-700',
  },
  rose: {
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    button: 'bg-rose-600 hover:bg-rose-700',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    button: 'bg-violet-600 hover:bg-violet-700',
  },
};

interface ToolShellProps {
  title: string;
  description: string;
  uploadLabel: string;
  icon: React.ReactNode;
  tone: ToolTone;
  file: PDFFile | null;
  status: ProcessingStatus;
  onFilesSelected: (files: File[]) => void;
  onReset: () => void;
  actionLabel: string;
  onAction: () => void;
  children?: React.ReactNode;
  selectedContent?: React.ReactNode;
}

const ToolShell: React.FC<ToolShellProps> = ({
  title,
  description,
  uploadLabel,
  icon,
  tone,
  file,
  status,
  onFilesSelected,
  onReset,
  actionLabel,
  onAction,
  children,
  selectedContent,
}) => {
  const toneClass = toneClasses[tone];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <div className="mt-3 flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${toneClass.icon}`}>
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <FileUpload onFilesSelected={onFilesSelected} accept=".pdf,application/pdf" label={uploadLabel} />
          </motion.div>
        ) : (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass.icon}`}>
                <FileCheck size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">{file.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB selected</p>
              </div>
              <button onClick={onReset} className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Choose another
              </button>
            </div>

            {children && <div className="mt-6">{children}</div>}
            {selectedContent}

            <button
              onClick={onAction}
              disabled={status.isProcessing}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-lg font-bold text-white transition-colors disabled:opacity-50 ${toneClass.button}`}
            >
              {status.isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
              {status.isProcessing ? status.message || 'Processing...' : actionLabel}
            </button>

            {status.error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {status.error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const toPdfFile = (files: File[]) => {
  const selected = files.find((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (!selected) return null;
  return { id: uuidv4(), file: selected, name: selected.name, size: selected.size };
};

interface SimpleTransformToolProps {
  title: string;
  description: string;
  uploadLabel: string;
  icon: React.ReactNode;
  tone: ToolTone;
  actionLabel: string;
  outputPrefix: string;
  transform: (file: File) => Promise<Uint8Array>;
}

const SimpleTransformTool: React.FC<SimpleTransformToolProps> = ({
  title,
  description,
  uploadLabel,
  icon,
  tone,
  actionLabel,
  outputPrefix,
  transform,
}) => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const handleFilesSelected = (files: File[]) => {
    const next = toPdfFile(files);
    if (next) setFile(next);
  };

  const handleTransform = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 20, message: 'Processing PDF...' });
    try {
      const bytes = await transform(file.file);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${outputPrefix}-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Unable to process this PDF.' });
    }
  };

  return (
    <ToolShell
      title={title}
      description={description}
      uploadLabel={uploadLabel}
      icon={icon}
      tone={tone}
      file={file}
      status={status}
      onFilesSelected={handleFilesSelected}
      onReset={() => setFile(null)}
      actionLabel={actionLabel}
      onAction={handleTransform}
    />
  );
};

export const RemoveMetadataPDF: React.FC = () => (
  <SimpleTransformTool
    title="Remove Metadata"
    description="Strip author, title, dates, viewer preferences, and document metadata locally."
    uploadLabel="Drop PDF to remove metadata"
    icon={<ShieldOff size={28} />}
    tone="emerald"
    actionLabel="Remove metadata"
    outputPrefix="metadata-cleaned"
    transform={removePDFMetadata}
  />
);

export const RemoveAnnotationsPDF: React.FC = () => (
  <SimpleTransformTool
    title="Remove Annotations"
    description="Remove comments, markup annotations, and page-level actions from the PDF."
    uploadLabel="Drop PDF to remove annotations"
    icon={<StickyNote size={28} />}
    tone="rose"
    actionLabel="Remove annotations"
    outputPrefix="annotations-removed"
    transform={removePDFAnnotations}
  />
);

export const SanitizePDF: React.FC = () => (
  <SimpleTransformTool
    title="Sanitize PDF"
    description="Clean metadata and annotations in one privacy-focused pass."
    uploadLabel="Drop PDF to sanitize"
    icon={<ShieldOff size={28} />}
    tone="violet"
    actionLabel="Sanitize PDF"
    outputPrefix="sanitized"
    transform={sanitizePDF}
  />
);

export const CropPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [margins, setMargins] = useState({ top: 5, right: 5, bottom: 5, left: 5 });

  const setMargin = (key: keyof typeof margins, value: string) => {
    setMargins((current) => ({ ...current, [key]: Math.max(0, Math.min(40, Number(value) || 0)) }));
  };

  const handleCrop = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 20, message: 'Applying crop box...' });
    try {
      const bytes = await cropPDFMargins(file.file, margins);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `cropped-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Unable to crop this PDF.' });
    }
  };

  return (
    <ToolShell
      title="Crop PDF"
      description="Trim page margins by setting a new crop box without uploading the file."
      uploadLabel="Drop PDF to crop"
      icon={<Crop size={28} />}
      tone="cyan"
      file={file}
      status={status}
      onFilesSelected={(files) => {
        const next = toPdfFile(files);
        if (next) setFile(next);
      }}
      onReset={() => setFile(null)}
      actionLabel="Crop PDF"
      onAction={handleCrop}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((key) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{key}</span>
            <input
              type="number"
              min={0}
              max={40}
              value={margins[key]}
              onChange={(event) => setMargin(key, event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <span className="mt-1 block text-xs text-slate-400">% of page</span>
          </label>
        ))}
      </div>
    </ToolShell>
  );
};

export const HeaderFooterPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('Page {n} of {total}');
  const [fontSize, setFontSize] = useState(10);
  const [includePageNumbers, setIncludePageNumbers] = useState(true);

  const handleApply = async () => {
    if (!file) return;
    setStatus({ isProcessing: true, progress: 20, message: 'Adding header and footer...' });
    try {
      const bytes = await addHeaderFooterToPDF(file.file, { headerText, footerText, fontSize, includePageNumbers });
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `header-footer-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Unable to add header or footer.' });
    }
  };

  return (
    <ToolShell
      title="Header & Footer"
      description="Add reusable header and footer text. Use {n} and {total} for page numbers."
      uploadLabel="Drop PDF for header/footer"
      icon={<Heading size={28} />}
      tone="blue"
      file={file}
      status={status}
      onFilesSelected={(files) => {
        const next = toPdfFile(files);
        if (next) setFile(next);
      }}
      onReset={() => setFile(null)}
      actionLabel="Add header/footer"
      onAction={handleApply}
    >
      <div className="grid gap-4">
        <label>
          <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">Header text</span>
          <input
            value={headerText}
            onChange={(event) => setHeaderText(event.target.value)}
            placeholder="Optional header"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">Footer text</span>
          <input
            value={footerText}
            onChange={(event) => setFooterText(event.target.value)}
            placeholder="Page {n} of {total}"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
          <label>
            <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">Font size</span>
            <input
              type="number"
              min={8}
              max={48}
              value={fontSize}
              onChange={(event) => setFontSize(Math.max(8, Math.min(48, Number(event.target.value) || 10)))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includePageNumbers}
              onChange={(event) => setIncludePageNumbers(event.target.checked)}
              className="h-4 w-4"
            />
            Use page numbers if footer is blank
          </label>
        </div>
      </div>
    </ToolShell>
  );
};

export const RemoveBlankPagesPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [removedPages, setRemovedPages] = useState<number[]>([]);

  const handleRemove = async () => {
    if (!file) return;
    setRemovedPages([]);
    setStatus({ isProcessing: true, progress: 5, message: 'Scanning pages...' });
    try {
      const result = await removeBlankPagesFromPDF(file.file, {
        onProgress: (current, total) => {
          setStatus({ isProcessing: true, progress: Math.round((current / total) * 90), message: `Scanning page ${current} of ${total}` });
        },
      });
      setRemovedPages(result.removedPages);
      downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `blank-pages-removed-${file.name}`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Unable to remove blank pages.' });
    }
  };

  return (
    <ToolShell
      title="Remove Blank Pages"
      description="Detect mostly empty pages and export a cleaned copy."
      uploadLabel="Drop PDF to remove blank pages"
      icon={<ScanSearch size={28} />}
      tone="amber"
      file={file}
      status={status}
      onFilesSelected={(files) => {
        const next = toPdfFile(files);
        if (next) setFile(next);
      }}
      onReset={() => {
        setFile(null);
        setRemovedPages([]);
      }}
      actionLabel="Remove blank pages"
      onAction={handleRemove}
      selectedContent={
        removedPages.length > 0 ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            Removed pages: {removedPages.join(', ')}
          </p>
        ) : null
      }
    />
  );
};

export const ExtractImagesPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [images, setImages] = useState<EmbeddedPdfImageAsset[]>([]);

  useEffect(() => {
    return () => images.forEach((image) => URL.revokeObjectURL(image.objectUrl));
  }, [images]);

  const scanImages = async (selected: PDFFile) => {
    setStatus({ isProcessing: true, progress: 10, message: 'Scanning embedded images...' });
    try {
      const pdfDoc = await loadPDFDocument(selected.file);
      const extracted = await extractEmbeddedImagesFromPDF(pdfDoc, {
        onProgress: (current, total) => {
          setStatus({ isProcessing: true, progress: Math.round((current / total) * 90), message: `Scanning page ${current} of ${total}` });
        },
      });
      setImages(extracted);
      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Unable to extract images from this PDF.' });
    }
  };

  const handleFilesSelected = (files: File[]) => {
    const next = toPdfFile(files);
    if (!next) return;
    images.forEach((image) => URL.revokeObjectURL(image.objectUrl));
    setImages([]);
    setFile(next);
    void scanImages(next);
  };

  const downloadAll = async () => {
    if (!file || images.length === 0) return;
    const zip = new JSZip();
    images.forEach((image, index) => {
      zip.file(`image-${String(index + 1).padStart(2, '0')}-pages-${image.pageNumbers.join('-')}.png`, image.blob);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `extracted-images-${file.name.replace(/\.pdf$/i, '')}.zip`, 'application/zip');
  };

  return (
    <ToolShell
      title="Extract Images"
      description="Find embedded PDF images and download them as PNG files."
      uploadLabel="Drop PDF to extract images"
      icon={<FileImage size={28} />}
      tone="cyan"
      file={file}
      status={status}
      onFilesSelected={handleFilesSelected}
      onReset={() => {
        images.forEach((image) => URL.revokeObjectURL(image.objectUrl));
        setImages([]);
        setFile(null);
      }}
      actionLabel={images.length > 0 ? 'Download all images' : 'Scan images'}
      onAction={images.length > 0 ? downloadAll : () => file && scanImages(file)}
    >
      {images.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
            <Archive size={16} />
            {images.length} image{images.length === 1 ? '' : 's'} found
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.slice(0, 9).map((image, index) => (
              <a
                key={image.id}
                href={image.objectUrl}
                download={`image-${index + 1}.png`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
              >
                <img src={image.objectUrl} alt={`Extracted image ${index + 1}`} className="h-32 w-full object-contain p-2" />
                <div className="border-t border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800">
                  Pages {image.pageNumbers.join(', ')}
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </ToolShell>
  );
};
