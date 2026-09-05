
import React, { useState, useEffect, useMemo } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import {
  calculateTargetSize,
  type CompressionLevel,
  getAdaptiveConfig,
  type AdaptiveConfig,
} from '../../services/pdfCompressionConfig';
import { downloadBlob } from '../../services/pdfShared';
import { Layers, ArrowRight, Loader2, CheckCircle2, TrendingDown, AlertTriangle, ShieldAlert, Zap, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { SEOHead } from '../SEO/SEOHead';
import { FAQ, FAQItem } from '../UI/FAQ';
import { StatusToast } from '../UI/StatusToast';
import { Switch } from '../UI/Primitives';
import { recordSavings } from '../../services/workspace';

const ReadabilityPreview = React.lazy(() => import('./ReadabilityPreview').then((module) => ({
  default: module.ReadabilityPreview,
})));

const faqItems: FAQItem[] = [
  {
    question: "Does compressing reduce quality?",
    answer: "The default keeps pages and selectable text intact. If you explicitly turn pages into images, preview Low, Medium, or High quality before saving."
  },
  {
    question: "Are my files uploaded to a server?",
    answer: "No. PDF Chef is a client-side tool. Compression happens entirely in your browser. Your files are not uploaded to a server for processing."
  },
  {
    question: "Why is the reduction 0%?",
    answer: "If your PDF is already highly optimized, further compression might degrade quality without saving space. In this case, we keep the original file."
  },
  {
    question: "Can I compress text-heavy PDFs?",
    answer: "Text-heavy PDFs usually shrink less. Stronger page-image compression is available as an explicit option, but searchable text, links, forms, and accessibility can be lost."
  }
];

export const CompressPDF: React.FC = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  
  // Results
  const [results, setResults] = useState<Array<{
    id: string;
    name: string;
    originalSize: number;
    size: number;
    reduction: number;
    dpi: number;
    strategy: string;
    rasterized: boolean;
    skipped: boolean;
    warningType?: 'soft' | 'hard';
  }>>([]);

  // Preview / Safety State
  const [showPreview, setShowPreview] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<AdaptiveConfig | null>(null);

  // Analysis State
  const [analysis, setAnalysis] = useState<{
    byId: Record<string, boolean>;
    pageCountById: Record<string, number>;
    isTextHeavy: boolean;
    done: boolean;
  }>({ byId: {}, pageCountById: {}, isTextHeavy: false, done: false });
  const [targetEstimate, setTargetEstimate] = useState<number>(0);
  const [flatten, setFlatten] = useState<boolean>(false);
  const [showRasterizeConfirm, setShowRasterizeConfirm] = useState(false);
  const previewFiles = useMemo(
    () => files.map((selectedFile) => ({ file: selectedFile.file, name: selectedFile.name })),
    [files],
  );

  // 1. Analyze files when selected
  useEffect(() => {
    let cancelled = false;

    if (files.length > 0) {
      setResults([]);
      setShowPreview(false);
      setAnalysis({ byId: {}, pageCountById: {}, isTextHeavy: false, done: false });

      void import('../../services/pdfBrowser')
        .then(({ analyzePDF }) => Promise.all(files.map(async (selectedFile) => {
          const result = await analyzePDF(selectedFile.file);
          return [selectedFile.id, result] as const;
        })))
        .then((entries) => {
          if (cancelled) return;

          const byId = Object.fromEntries(entries.map(([id, result]) => [id, result.isTextHeavy]));
          const pageCountById = Object.fromEntries(entries.map(([id, result]) => [id, result.pageCount]));
          setAnalysis({
            byId,
            pageCountById,
            isTextHeavy: entries.some(([, result]) => result.isTextHeavy),
            done: true,
          });
        })
        .catch(() => {
          if (cancelled) return;
          setAnalysis({ byId: {}, pageCountById: {}, isTextHeavy: false, done: true });
        });
    } else {
      setAnalysis({ byId: {}, pageCountById: {}, isTextHeavy: false, done: false });
    }

    return () => {
      cancelled = true;
    };
  }, [files]);

  // 2. Update Target Estimate
  useEffect(() => {
    if (flatten && files.length > 0 && analysis.done && files.every((file) => (analysis.pageCountById[file.id] || 0) > 0)) {
      const target = files.reduce((total, selectedFile) => {
        return total + calculateTargetSize(selectedFile.size, level, analysis.byId[selectedFile.id] ?? analysis.isTextHeavy);
      }, 0);
      setTargetEstimate(target);
    } else {
      setTargetEstimate(0);
    }
  }, [files, level, analysis, flatten]);

  const handleFilesSelected = async (files: File[]) => {
    const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const skippedCount = files.length - pdfFiles.length;

    if (pdfFiles.length === 0) {
      setUploadWarning(files.length === 1
        ? 'Only PDF files are supported. Choose a .pdf file.'
        : `${files.length} files were skipped because only PDF files are supported.`
      );
      return;
    }

    setUploadWarning(skippedCount > 0
      ? `${skippedCount} ${skippedCount === 1 ? 'file was' : 'files were'} skipped because only PDF files are supported.`
      : null
    );

    setStatus({ isProcessing: false, progress: 0, message: '' });
    setFlatten(false);
    setShowRasterizeConfirm(false);

    setFiles(pdfFiles.map((f) => ({
      id: uuidv4(),
      file: f,
      name: f.name,
      size: f.size,
      pageCount: 0 
    })));
  };

  const getCurrentConfig = () => getAdaptiveConfig(level, analysis.isTextHeavy);

  const triggerPreview = () => {
    if (files.length === 0) return;
    setPreviewConfig(getCurrentConfig());
    setShowPreview(true);
  };

  const initiateCompression = () => {
    const config = getCurrentConfig();
    // DPI only changes when pages are rasterized. A structure-preserving run does not need a
    // simulated visual preview because its text and page rendering remain intact.
    if (flatten && (config.projectedDPI < 100 || level === 'extreme')) {
      setPreviewConfig(config);
      setShowPreview(true);
    } else {
      executeCompression(false);
    }
  };

  const executeCompression = async (overrideSafety = false, customConfig?: AdaptiveConfig) => {
    if (files.length === 0) return;
    
    setStatus({ isProcessing: true, progress: 5, message: 'Analyzing structure...' });
    
    try {
      const { compressPDFAdaptive } = await import('../../services/pdfBrowser');
      const compressedResults = [];

      for (let index = 0; index < files.length; index += 1) {
        const selectedFile = files[index];
        const fileLabel = files.length > 1 ? `${index + 1}/${files.length}: ${selectedFile.name}` : selectedFile.name;
        const resultObj = await compressPDFAdaptive(
          selectedFile.file,
          level,
          (p) => {
            const batchProgress = ((index + p / 100) / files.length) * 100;
            setStatus(prev => ({
              ...prev,
              progress: Math.max(5, Math.round(batchProgress)),
              message: p < 50 ? `Compressing ${fileLabel}…` : `Optimizing ${fileLabel}…`,
            }));
          },
          overrideSafety,
          customConfig,
          flatten,
          analysis.byId[selectedFile.id] ?? analysis.isTextHeavy,
        );

        // If blocked by service (double safety), shouldn't happen if we handled it in preview, but fallback.
        if (resultObj.status === 'blocked') {
          setStatus({ isProcessing: false, progress: 0, message: '' });
          triggerPreview();
          return;
        }

        const finalSize = resultObj.meta.compressedSize;
        const isUnchanged = finalSize >= selectedFile.size;
        const effectiveDPI = resultObj.meta.projectedDPI;

        let warningType: 'soft' | 'hard' | undefined = undefined;
        if (effectiveDPI < 90) warningType = 'hard';
        else if (effectiveDPI < 100) warningType = 'soft';

        compressedResults.push({
          id: selectedFile.id,
          name: selectedFile.name,
          originalSize: selectedFile.size,
          size: isUnchanged ? selectedFile.size : finalSize,
          reduction: isUnchanged ? 0 : Math.round(((selectedFile.size - finalSize) / selectedFile.size) * 100),
          dpi: effectiveDPI,
          strategy: resultObj.meta.strategyUsed,
          rasterized: flatten,
          skipped: isUnchanged,
          warningType,
        });

        if (!isUnchanged && resultObj.data.length > 0) {
          recordSavings(selectedFile.size, resultObj.data.length);
          downloadBlob(new Blob([resultObj.data], { type: 'application/pdf' }), `compressed-${level}-${selectedFile.name}`);
        }
      }

      setStatus({ isProcessing: true, progress: 100, message: 'Finalizing...' });
      setResults(compressedResults);
      
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : '';
      const message = /password|encrypted/i.test(detail)
        ? 'This PDF is encrypted. Unlock it before compressing.'
        : 'Compression failed. Your originals were not changed. Try a different PDF or quality setting.';
      setStatus({ isProcessing: false, progress: 0, message: '', error: message });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };
  const totalOriginalSize = files.reduce((total, selectedFile) => total + selectedFile.size, 0);
  const totalCompressedSize = results.reduce((total, result) => total + result.size, 0);
  const totalReduction = totalOriginalSize > 0 && totalCompressedSize < totalOriginalSize
    ? Math.round(((totalOriginalSize - totalCompressedSize) / totalOriginalSize) * 100)
    : 0;
  const hasResults = results.length > 0;
  const isSkipped = hasResults && totalCompressedSize >= totalOriginalSize;
  const skippedResultCount = results.filter((result) => result.skipped).length;
  const analysisFailureCount = analysis.done
    ? files.filter((file) => (analysis.pageCountById[file.id] || 0) <= 0).length
    : 0;
  const currentDPI = analysis.done ? getAdaptiveConfig(level, analysis.isTextHeavy).projectedDPI : 0;
  const isLowDPI = currentDPI < 100;
  const fileCountLabel = files.length === 1 ? '1 PDF' : `${files.length} PDFs`;
  const estimateProgress = totalOriginalSize > 0
    ? Math.max(0, Math.min(100, (targetEstimate / totalOriginalSize) * 100))
    : 0;
  const processingProgress = Number.isFinite(status.progress)
    ? Math.max(0, Math.min(100, status.progress))
    : 0;

  return (
    <div className={`relative mx-auto w-full max-w-3xl px-4 py-4 sm:py-10 ${files.length === 0 ? 'chef-tool-landing-centered' : ''}`}>
      <SEOHead 
        title="Compress PDF - Reduce File Size Online | PDF Chef"
        description="Reduce PDF file size in your browser. Preserve document structure by default or preview an optional page-image copy."
      />
      <StatusToast status={status} />

      {/* The "Turn pages into images" switch states the trade-off where the
          decision is made; repeating it under the title said it twice. */}
      <div className="mb-3 sm:mb-6">
         <h1 className="text-3xl font-bold text-[var(--text-primary)]">Compress PDF</h1>
      </div>

      <AnimatePresence mode="wait">
        {files.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf,application/pdf" multiple label="Choose PDFs to compress" />
             {uploadWarning && (
               <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-field)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
                 <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
                 <span>{uploadWarning}</span>
               </div>
             )}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] p-3 sm:p-4"
          >
            {/* Result View */}
            {hasResults && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                className={`mb-3 rounded-[var(--radius-field)] border p-3 ${
                  isSkipped 
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}
              >
                <div className={`mb-2 flex items-center gap-2 text-base font-bold ${isSkipped ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {isSkipped ? <ShieldAlert /> : <CheckCircle2 />} 
                  {isSkipped ? 'No smaller copy produced' : 'Compression complete'}
                </div>
                
                {isSkipped ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    Compression did not make these PDFs smaller, so your originals were kept.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {skippedResultCount > 0 && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {skippedResultCount} {skippedResultCount === 1 ? 'original was' : 'originals were'} kept because the compressed copy was not smaller.
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Original</div>
                        <div className="font-mono text-[var(--text-body)] line-through">{formatSize(totalOriginalSize)}</div>
                      </div>
                      <div className="flex flex-col items-center px-4">
                        <ArrowRight aria-hidden className="text-[var(--text-tertiary)]" />
                        <span className="mt-1 rounded-full bg-[var(--status-success-quiet)] px-2 py-0.5 text-xs font-bold text-[var(--status-success-text)]">
                          -{totalReduction}%
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 dark:text-green-400 uppercase text-xs font-bold tracking-wider mb-1">Compressed</div>
                        <div className="font-mono text-xl font-bold text-green-700 dark:text-green-400">{formatSize(totalCompressedSize)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {results.map((result) => (
                        <div key={result.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/50 p-2 text-xs dark:bg-black/20">
                          <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-body)]">{result.name}</span>
                          <span className="font-mono text-[var(--text-tertiary)]">
                            {formatSize(result.originalSize)} → {formatSize(result.size)}
                          </span>
                          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <Zap size={12} className="text-amber-500" />
                            <span>{result.skipped
                              ? <strong>Original kept</strong>
                              : result.rasterized
                                ? <><strong>{result.dpi} DPI</strong> ({result.strategy})</>
                                : <><strong>Text preserved</strong> ({result.strategy})</>}
                            </span>
                          </div>
                          {result.warningType === 'soft' && (
                            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                              <AlertTriangle size={12} />
                              <span>Soft text</span>
                            </div>
                          )}
                          {result.warningType === 'hard' && (
                            <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-300">
                              <AlertTriangle size={12} />
                              <span>Low readability risk</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* File Info */}
            {!hasResults && (
              <div className="mb-3 border-b border-[var(--border-hairline)] pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                   <div className="flex min-w-0 grow basis-[12rem] items-center gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]">
                        <Layers aria-hidden size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{fileCountLabel} selected</h3>
                        <div className="type-caption flex items-center gap-2 text-[var(--text-tertiary)]">
                          {analysis.done ? (
                             <span>{analysis.isTextHeavy ? 'Includes text-heavy PDFs' : 'Image-rich PDFs'} • {formatSize(totalOriginalSize)}</span>
                          ) : (
                             <span className="animate-pulse">Analyzing...</span>
                          )}
                        </div>
                      </div>
                   </div>
                   <button
                    type="button"
                    onClick={() => { setFiles([]); setResults([]); setUploadWarning(null); }}
                    className="chef-target ml-auto shrink-0 rounded-[var(--radius-control)] border border-[var(--status-danger-text)] px-3 text-sm font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-quiet)]"
                  >
                    Clear
                  </button>
                </div>
                {files.length > 1 && (
                  <div className="chef-scroller mt-3 max-h-48 space-y-1 overflow-y-auto rounded-[var(--radius-field)] bg-[var(--surface-sunken)] p-2">
                    {files.map((selectedFile, index) => (
                      <div key={selectedFile.id} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm">
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-[var(--text-tertiary)]">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-body)]">{selectedFile.name}</span>
                        <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{formatSize(selectedFile.size)}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((file) => file.id !== selectedFile.id))}
                          className="chef-target inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-quiet)]"
                          aria-label={`Remove ${selectedFile.name}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadWarning && (
                  <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-field)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
                    <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
                    <span>{uploadWarning}</span>
                  </div>
                )}
                {analysisFailureCount > 0 && (
                  <div role="status" className="mt-3 flex items-start gap-2 rounded-[var(--radius-field)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
                    <AlertTriangle aria-hidden size={18} className="mt-0.5 shrink-0" />
                    <span>{analysisFailureCount === 1 ? 'One PDF' : `${analysisFailureCount} PDFs`} could not be inspected. It may be encrypted or unsupported, so no size estimate is shown. You can still try compression.</span>
                  </div>
                )}
              </div>
            )}

            {/* Target Estimation */}
            {!hasResults && (
              <div className="mb-3">
                <div className="mb-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-[var(--text-body)]">Estimated batch size</span>
                  <div className="flex min-w-0 items-center gap-2">
                     <TrendingDown aria-hidden size={18} className="text-[var(--accent-text)]" />
                     <span className="min-w-0 break-words text-xl font-bold text-[var(--text-primary)]">{!analysis.done ? 'Analyzing…' : !flatten ? 'Not predicted' : analysisFailureCount > 0 ? 'Unavailable' : `~${formatSize(targetEstimate)}`}</span>
                  </div>
                </div>
                <p className="type-caption mb-1.5 font-normal normal-case tracking-normal text-[var(--text-secondary)]">
                  {flatten
                    ? 'Estimate only. Preview visual quality before compressing.'
                    : 'Structure-preserving optimization has no reliable size estimate. Your original is kept if the result is not smaller.'}
                </p>
                {flatten && analysis.done && analysisFailureCount === 0 && <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                   <div
                    aria-hidden="true"
                    className="h-full bg-[var(--accent-rest)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
                    style={{ width: `${estimateProgress}%` }}
                   />
                </div>}
              </div>
            )}

            {/* Compression Levels */}
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-[var(--text-body)]">Quality</span>
              {!flatten && <span className="text-xs text-[var(--text-secondary)]">Used only when pages are turned into images</span>}
            </div>
            {/* A three-way choice reads as a strip. Each box used to carry a
                second line that only restated its own label. */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                { id: 'extreme', label: 'Low' },
                { id: 'recommended', label: 'Medium' },
                { id: 'less', label: 'High' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setLevel(opt.id as CompressionLevel)}
                  disabled={status.isProcessing || hasResults}
                  aria-pressed={level === opt.id}
                  className={`chef-pressable chef-hit-y h-10 rounded-[var(--radius-control)] border text-sm font-semibold transition-colors disabled:opacity-55 ${
                    level === opt.id
                      ? 'border-[var(--accent-rest)] bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]'
                      : 'border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--accent-rest)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {!hasResults && (
              <div className="mb-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-1">
                {/* Kept in full: rasterizing is the one lossy path in this tool. */}
                <Switch
                  label="Turn pages into images"
                  detail="May shrink text or vector PDFs, but selectable text, links, forms, signatures, and accessibility can be lost."
                  checked={flatten}
                  disabled={status.isProcessing}
                  onChange={(next) => {
                    if (next) setShowRasterizeConfirm(true);
                    else setFlatten(false);
                  }}
                />
                {showRasterizeConfirm && !flatten && (
                  <div role="alert" className="rounded-[var(--radius-field)] border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-100">
                    <p className="font-bold">Turn every page into an image?</p>
                    <p className="mt-1 text-sm">This is lossy. Searchable and copyable text, links, bookmarks, form fields, signatures, and accessibility can be lost. Your original files are not changed.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setShowRasterizeConfirm(false)} className="chef-hit-y chef-pressable min-h-11 rounded-[var(--radius-control)] border border-amber-300 px-4 text-sm font-semibold hover:bg-amber-100 dark:border-amber-500 dark:hover:bg-amber-900/40">Cancel</button>
                      <button type="button" onClick={() => { setFlatten(true); setShowRasterizeConfirm(false); }} className="chef-hit-y chef-pressable min-h-11 rounded-[var(--radius-control)] bg-amber-700 px-4 text-sm font-bold text-white hover:bg-amber-800">Turn pages into images</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
               {status.isProcessing && (
                 <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                   <div
                     aria-hidden="true"
                     className="h-full bg-[var(--accent-rest)] transition-[width] duration-200 ease-linear motion-reduce:transition-none"
                     style={{ width: `${processingProgress}%` }}
                   />
                 </div>
               )}
               
               {!hasResults ? (
                 <div className="flex flex-col gap-2">
                   {/* Preview & Tune Button - HIGHLIGHTED */}
                   {analysis.done && flatten && !status.isProcessing && (
                      <button
                        onClick={triggerPreview}
                        className={`
                          group relative flex w-full items-center justify-between overflow-hidden rounded-[var(--radius-control)] border px-3 py-2 text-left transition-all duration-200
                          ${isLowDPI
                            ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-400 hover:border-amber-400 dark:hover:border-amber-500'
                            : 'border-[var(--border-strong)] bg-[var(--surface-raised)] hover:border-[var(--accent-rest)]'
                          }
                        `}
                      >
                         <div className="relative z-10 flex items-center gap-2.5">
                            <div className={`
                               grid h-9 w-9 place-items-center rounded-[var(--radius-control)] transition-colors
                               ${isLowDPI
                                 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                 : 'bg-[var(--accent-quiet)] text-[var(--accent-on-quiet)]'
                               }
                            `}>
                               <Eye aria-hidden size={18} className={isLowDPI ? "animate-pulse" : ""} />
                            </div>
                            <div>
                               <div className={`text-sm font-bold ${isLowDPI ? 'text-amber-800 dark:text-amber-200' : 'text-[var(--text-primary)]'}`}>
                                  Preview quality
                                </div>
                               {/* Kept only in the state that warns: at a low DPI
                                   the output can be unreadable. */}
                               {isLowDPI && (
                                 <div className="type-caption font-medium text-amber-700 dark:text-amber-300">
                                    Quality looks low. Check before saving.
                                 </div>
                               )}
                            </div>
                         </div>

                         <div className="flex items-center gap-2">
                           <div className={`
                              rounded-md border px-2 py-1 font-mono text-xs font-bold
                              ${isLowDPI
                                 ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-500 text-amber-700 dark:text-amber-300'
                                 : 'border-[var(--border-hairline)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]'
                              }
                           `}>
                              {currentDPI} DPI
                           </div>
                           <ArrowRight aria-hidden size={18} className={`opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ${isLowDPI ? 'text-amber-500' : 'text-[var(--accent-text)]'}`} />
                         </div>
                      </button>
                   )}

                   {/* Main Compress Button */}
                   <button
                    onClick={initiateCompression}
                    disabled={status.isProcessing || !analysis.done}
                    className="chef-target chef-pressable group flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-rest)] px-4 text-sm font-bold text-[var(--text-on-accent)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-55"
                  >
                    {status.isProcessing ? (
                      <><Loader2 className="animate-spin" /> <span>{status.message}</span></>
                    ) : !analysis.done ? (
                      <><Loader2 className="animate-spin" /> <span>Analyzing PDFs…</span></>
                    ) : (
                      <><Layers aria-hidden size={18} className="transition-transform group-hover:scale-110" /> <span>Compress {fileCountLabel}</span></>
                    )}
                  </button>
                 </div>
               ) : (
                 <button 
                   onClick={() => { setFiles([]); setResults([]); setUploadWarning(null); setFlatten(false); setShowRasterizeConfirm(false); setAnalysis({byId: {}, pageCountById: {}, done:false, isTextHeavy:false}); }}
                   className="chef-target chef-pressable w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-rest)]"
                 >
                   Compress more files
                 </button>
               )}
            </div>
          </motion.div>
        )}

        {/* Readability Preview Modal */}
        {showPreview && files[0] && previewConfig && (
          <React.Suspense fallback={null}>
            <ReadabilityPreview
              file={files[0].file}
              files={previewFiles}
              config={previewConfig}
              isTextHeavy={analysis.byId[files[0].id] ?? analysis.isTextHeavy}
              onClose={() => setShowPreview(false)}
              onConfirm={(finalConfig) => { setShowPreview(false); executeCompression(true, finalConfig); }}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      <FAQ items={faqItems} />
    </div>
  );
};
