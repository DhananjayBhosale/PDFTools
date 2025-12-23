import React, { useState, useEffect } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import { compressPDFAdaptive, calculateTargetSize, analyzePDF, CompressionLevel, getAdaptiveConfig, AdaptiveConfig } from '../../services/pdfService';
import { Layers, ArrowRight, Loader2, CheckCircle2, TrendingDown, AlertTriangle, ShieldAlert, Zap, EyeOff, ThumbsUp, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import { ReadabilityPreview } from './ReadabilityPreview';

export const CompressPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  
  // Results
  const [result, setResult] = useState<{
    size: number;
    reduction: number;
    dpi: number;
    strategy: string;
    warningType?: 'soft' | 'hard';
  } | null>(null);

  // Preview / Safety State
  const [showPreview, setShowPreview] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<AdaptiveConfig | null>(null);

  // Analysis State
  const [analysis, setAnalysis] = useState<{ isTextHeavy: boolean; done: boolean }>({ isTextHeavy: false, done: false });
  const [targetEstimate, setTargetEstimate] = useState<number>(0);

  // 1. Analyze file when selected
  useEffect(() => {
    if (file) {
      setResult(null);
      setShowPreview(false);
      analyzePDF(file.file).then(res => {
        setAnalysis({ isTextHeavy: res.isTextHeavy, done: true });
      });
    } else {
      setAnalysis({ isTextHeavy: false, done: false });
    }
  }, [file]);

  // 2. Update Target Estimate
  useEffect(() => {
    if (file && analysis.done) {
      const target = calculateTargetSize(file.size, level, analysis.isTextHeavy);
      setTargetEstimate(target);
    }
  }, [file, level, analysis]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const f = files[0];
    if (f.type !== 'application/pdf') return;

    setFile({
      id: uuidv4(),
      file: f,
      name: f.name,
      size: f.size,
      pageCount: 0 
    });
  };

  const getCurrentConfig = () => getAdaptiveConfig(level, analysis.isTextHeavy);

  const triggerPreview = () => {
    if (!file) return;
    setPreviewConfig(getCurrentConfig());
    setShowPreview(true);
  };

  const initiateCompression = () => {
    const config = getCurrentConfig();
    // Safety check: Trigger preview if unsafe (DPI < 100) or Extreme mode
    if (config.projectedDPI < 100 || level === 'extreme') {
      setPreviewConfig(config);
      setShowPreview(true);
    } else {
      executeCompression(false);
    }
  };

  const executeCompression = async (overrideSafety = false, customConfig?: AdaptiveConfig) => {
    if (!file) return;
    
    setStatus({ isProcessing: true, progress: 5, message: 'Analyzing structure...' });
    
    try {
      const resultObj = await compressPDFAdaptive(
        file.file, 
        level, 
        (p) => setStatus(prev => ({ ...prev, progress: p, message: p < 50 ? 'Pass 1: Compressing...' : 'Pass 2: Optimizing...' })),
        overrideSafety,
        customConfig // NEW: Pass custom config if confirmed from preview
      );
      
      // If blocked by service (double safety), shouldn't happen if we handled it in preview, but fallback:
      if (resultObj.status === 'blocked') {
         setStatus({ isProcessing: false, progress: 0, message: '' });
         triggerPreview(); // Re-open preview if blocked
         return;
      }

      setStatus({ isProcessing: true, progress: 100, message: 'Finalizing...' });
      
      const finalSize = resultObj.meta.compressedSize;
      const isUnchanged = finalSize >= file.size;
      const effectiveDPI = resultObj.meta.projectedDPI;
      
      let warningType: 'soft' | 'hard' | undefined = undefined;
      if (effectiveDPI < 90) warningType = 'hard';
      else if (effectiveDPI < 100) warningType = 'soft';

      setResult({
        size: finalSize,
        reduction: isUnchanged ? 0 : Math.round(((file.size - finalSize) / file.size) * 100),
        dpi: effectiveDPI,
        strategy: resultObj.meta.strategyUsed,
        warningType
      });

      if (!isUnchanged && resultObj.data.length > 0) {
        const blob = new Blob([resultObj.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed-${level}-${file.name}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Compression failed.' });
    }
  };

  const formatSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
  const isSkipped = result && result.size >= (file?.size || 0);
  const currentDPI = analysis.done ? getAdaptiveConfig(level, analysis.isTextHeavy).projectedDPI : 0;

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 relative">
      <div className="mb-8">
         <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">← Back to Dashboard</Link>
         <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">Compress PDF</h1>
         <p className="text-slate-500 dark:text-slate-400">Adaptive compression. Smart quality preservation.</p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
             <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to compress" />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8"
          >
            {/* Result View */}
            {result && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                className={`mb-8 border rounded-xl p-6 ${
                  isSkipped 
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}
              >
                <div className={`flex items-center gap-3 mb-4 font-bold text-lg ${isSkipped ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                  {isSkipped ? <ShieldAlert /> : <CheckCircle2 />} 
                  {isSkipped ? 'No Reduction Possible' : 'Compression Successful'}
                </div>
                
                {isSkipped ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    File is already optimized. Original kept.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="text-slate-500 uppercase text-xs font-bold tracking-wider mb-1">Original</div>
                        <div className="font-mono text-slate-700 dark:text-slate-300 line-through">{formatSize(file.size)}</div>
                      </div>
                      <div className="flex flex-col items-center px-4">
                        <ArrowRight className="text-slate-400" />
                        <span className="text-green-600 font-bold text-xs bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full mt-1">
                          -{result.reduction}%
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-green-600 dark:text-green-400 uppercase text-xs font-bold tracking-wider mb-1">Compressed</div>
                        <div className="font-mono text-xl font-bold text-green-700 dark:text-green-400">{formatSize(result.size)}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-black/20 p-2 rounded-lg">
                        <Zap size={12} className="text-amber-500" />
                        <span><strong>{result.dpi} DPI</strong> ({result.strategy})</span>
                      </div>
                      {result.warningType === 'soft' && (
                        <div className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
                          <AlertTriangle size={12} />
                          <span>Soft text</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* File Info */}
            {!result && (
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                      <Layers size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{file.name}</h3>
                      <div className="text-sm text-slate-500 flex items-center gap-2">
                        {analysis.done ? (
                           <span>{analysis.isTextHeavy ? 'Text-heavy' : 'Image-rich'} • {formatSize(file.size)}</span>
                        ) : (
                           <span className="animate-pulse">Analyzing...</span>
                        )}
                      </div>
                    </div>
                 </div>
                 <button onClick={() => setFile(null)} className="text-sm text-rose-500 hover:text-rose-600 font-medium">Remove</button>
              </div>
            )}

            {/* Target Estimation */}
            {!result && (
              <div className="mb-8">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Target Size</span>
                  <div className="flex items-center gap-2">
                     <TrendingDown size={16} className="text-indigo-500" />
                     <span className="text-2xl font-bold text-slate-900 dark:text-white">~{formatSize(targetEstimate)}</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
                   <motion.div 
                    className="h-full bg-indigo-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${Math.min(100, (targetEstimate / file.size) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 50 }}
                  />
                </div>
              </div>
            )}

            {/* Compression Levels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { id: 'extreme', label: 'Extreme', desc: 'Max Reduction', sub: 'Low DPI' },
                { id: 'recommended', label: 'Recommended', desc: 'Balanced', sub: 'Standard DPI' },
                { id: 'less', label: 'High Quality', desc: 'Minimal Reduction', sub: 'High DPI' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLevel(opt.id as CompressionLevel)}
                  disabled={status.isProcessing || result !== null}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden
                    ${level === opt.id 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }
                  `}
                >
                  <div className={`font-bold ${level === opt.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{opt.desc}</div>
                  {level === opt.id && (
                    <motion.div layoutId="active-indicator" className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
               {status.isProcessing && (
                 <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                   <motion.div 
                     className="h-full bg-indigo-500"
                     initial={{ width: 0 }}
                     animate={{ width: `${status.progress}%` }}
                     transition={{ ease: "linear" }}
                   />
                 </div>
               )}
               
               {!result ? (
                 <div className="flex flex-col gap-3">
                   {/* Main Compress Button */}
                   <button
                    onClick={initiateCompression}
                    disabled={status.isProcessing || !analysis.done}
                    className="w-full px-8 py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 group"
                  >
                    {status.isProcessing ? (
                      <><Loader2 className="animate-spin" /> <span>{status.message}</span></>
                    ) : (
                      <><Layers size={20} className="group-hover:scale-110 transition-transform" /> <span>Compress PDF</span></>
                    )}
                  </button>
                  
                  {/* Manual Preview Button */}
                  {analysis.done && !status.isProcessing && (
                     <button
                       onClick={triggerPreview}
                       className="w-full py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 transition-colors"
                     >
                       <Eye size={16} /> Preview & Tune Quality ({currentDPI} DPI)
                     </button>
                  )}
                 </div>
               ) : (
                 <button 
                   onClick={() => { setFile(null); setResult(null); setAnalysis({done:false, isTextHeavy:false}); }}
                   className="w-full px-8 py-4 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                 >
                   Compress Another File
                 </button>
               )}
            </div>
          </motion.div>
        )}

        {/* Readability Preview Modal */}
        {showPreview && file && previewConfig && (
          <ReadabilityPreview
            file={file.file}
            config={previewConfig}
            isTextHeavy={analysis.isTextHeavy}
            onClose={() => setShowPreview(false)}
            onConfirm={(finalConfig) => { setShowPreview(false); executeCompression(true, finalConfig); }}
            onImprove={() => { 
              setLevel('recommended'); 
              setShowPreview(false); 
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
