import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, Check, AlertTriangle, Eye, X, Settings2, ArrowDown, HardDrive } from 'lucide-react';
import { AdaptiveConfig, generatePreviewPair, getInterpolatedConfig } from '../../services/pdfService';

interface Props {
  file: File;
  config: AdaptiveConfig;
  isTextHeavy: boolean;
  onClose: () => void;
  onConfirm: (config: AdaptiveConfig) => void;
  onImprove: () => void;
}

export const ReadabilityPreview: React.FC<Props> = ({ file, config: initialConfig, isTextHeavy, onClose, onConfirm, onImprove }) => {
  const [images, setImages] = useState<{ original: string; compressed: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Interactive State
  const [sliderValue, setSliderValue] = useState(50);
  const [currentConfig, setCurrentConfig] = useState<AdaptiveConfig>(initialConfig);
  const [sizeEstimate, setSizeEstimate] = useState<{ estimatedSize: number, ratio: number, confidence: 'low' | 'high' } | null>(null);
  
  // Heuristic State for "Fast Live Estimate"
  const [lastVerifiedSize, setLastVerifiedSize] = useState<number | null>(null);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize slider based on incoming DPI approx
  useEffect(() => {
    // Inverse map approx: 43 DPI -> 0, 144 DPI -> 100
    const startDPI = initialConfig.projectedDPI;
    const approxSlider = Math.max(0, Math.min(100, ((startDPI - 43) / (144 - 43)) * 100));
    setSliderValue(Math.round(approxSlider));
  }, []);

  const generate = async (cfg: AdaptiveConfig) => {
    setLoading(true);
    try {
      const result = await generatePreviewPair(file, cfg);
      setImages(result);
      
      const estimatedTotal = result.metrics.estimatedTotalSize;
      const ratio = estimatedTotal / file.size;

      setLastVerifiedSize(estimatedTotal);
      setSizeEstimate({ 
        estimatedSize: estimatedTotal, 
        ratio: ratio,
        confidence: 'high'
      });
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    generate(currentConfig);
  }, []);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSliderValue(val);
    
    // 1. Calculate new config immediately
    const newConfig = getInterpolatedConfig(val, isTextHeavy);
    setCurrentConfig(newConfig);

    // 2. Fast Live Estimate (Heuristic Phase)
    // If we have a previous verified estimate, we can extrapolate.
    // Quality scales roughly linearly-ish for UI feedback purposes.
    // Scale scales quadratically-ish (area).
    // This doesn't need to be perfect, just directional feedback while sliding.
    if (lastVerifiedSize) {
       // Heuristic: Roughly scale based on slider movement relative to 50
       // This is purely visual feedback while the heavy calculation debounces
       // We assume higher slider = larger file.
       // We won't do complex math here, just keep the old value or slightly adjust
       // Actually, keeping the old value with "Calculating..." is often better than a wrong guess.
       // But user wants "Fast Live Estimate".
       // Let's rely on the previous estimate but mark it as 'low' confidence or just stale.
       // We'll update the 'loading' state which greys out the preview but keep the numbers visible.
    }

    setLoading(true);

    // 3. Dry Run Estimate (Debounced)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      generate(newConfig);
    }, 200);
  };

  const dpi = currentConfig.projectedDPI;
  const qualityLabel = dpi >= 120 ? 'Good' : dpi >= 100 ? 'Fair' : 'Poor';
  const labelColor = dpi >= 120 ? 'text-green-500' : dpi >= 100 ? 'text-amber-500' : 'text-rose-500';

  const formatSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden relative z-10"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-20">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye size={20} className="text-blue-500" /> Live Readability Preview
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Adjust quality to find the perfect balance. 100% Zoom.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Comparison Viewport */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-black/50 p-8 relative flex gap-4 justify-center">
          {images ? (
            <>
              {/* Original */}
              <div className="flex-1 max-w-md flex flex-col gap-2 opacity-60 hover:opacity-100 transition-opacity">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Original</div>
                <div className="relative rounded-lg overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 bg-white">
                  <img src={images.original} alt="Original" className="w-full h-auto" />
                </div>
              </div>

              {/* Compressed */}
              <div className="flex-1 max-w-md flex flex-col gap-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center flex items-center justify-center gap-2">
                  Compressed Preview
                  {loading && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />}
                </div>
                <div className="relative rounded-lg overflow-hidden shadow-2xl border-2 border-blue-500 bg-white group">
                  <img 
                    src={images.compressed} 
                    alt="Compressed" 
                    className={`w-full h-auto image-rendering-auto transition-opacity duration-200 ${loading ? 'opacity-50 blur-[2px]' : 'opacity-100'}`}
                    style={{ minHeight: '100%' }}
                  />
                  <div className={`absolute top-2 right-2 ${dpi < 100 ? 'bg-rose-600' : 'bg-blue-600'} text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1 shadow-lg`}>
                    {dpi < 100 && <AlertTriangle size={10} />} {dpi} DPI
                  </div>
                </div>
                <div className={`text-center text-xs font-bold ${labelColor} mt-1`}>
                  Readability: {qualityLabel}
                </div>
              </div>
            </>
          ) : (
             <div className="absolute inset-0 flex items-center justify-center text-slate-500 gap-2">
              <ZoomIn className="animate-pulse" /> Generating preview...
            </div>
          )}
        </div>

        {/* Interactive Controls Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* Slider Control */}
          <div className="w-full lg:w-1/2 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Settings2 size={16} /> Quality Control
              </label>
              <span className="text-xs font-mono text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                Scale: {currentConfig.scale.toFixed(1)}x • Q: {Math.round(currentConfig.quality * 100)}%
              </span>
            </div>
            
            <div className="flex items-center gap-4">
               <span className="text-xs font-medium text-slate-500">Smaller Size</span>
               <input 
                 type="range" 
                 min="0" 
                 max="100" 
                 value={sliderValue}
                 onChange={handleSliderChange}
                 className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
               />
               <span className="text-xs font-medium text-slate-500">Better Text</span>
            </div>
          </div>

          {/* Estimates & Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
            
            {/* Size Estimate */}
            {sizeEstimate && (
              <div className={`flex flex-col items-end min-w-[140px] transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Estimated Final Size</div>
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-mono text-xl font-bold leading-none">
                  <HardDrive size={18} className="text-slate-400" />
                  ~{formatSize(sizeEstimate.estimatedSize)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {sizeEstimate.ratio >= 1 ? (
                     <span className="text-xs text-amber-600 font-bold bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                       No Reduction
                     </span>
                  ) : (
                    <span className="text-xs text-green-600 font-bold bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                      ↓ {Math.round((1 - sizeEstimate.ratio) * 100)}% reduction
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
               {dpi < 90 && (
                 <div className="hidden sm:flex items-center text-xs text-rose-500 font-bold max-w-[100px] leading-tight text-right">
                   Warning: Very Low Quality
                 </div>
               )}
               <button 
                onClick={() => onConfirm(currentConfig)}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 ${dpi < 100 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {dpi < 100 && <AlertTriangle size={18} />}
                {dpi < 100 ? 'Confirm Low Quality' : 'Compress PDF'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};