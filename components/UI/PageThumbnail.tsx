import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, RotateCw } from 'lucide-react';

interface PageThumbnailProps {
  pageIndex: number;
  imageUrl?: string;
  loadPreview?: () => Promise<string>;
  isSelected: boolean;
  onToggle: () => void;
  rotation?: number; // Visual rotation in degrees
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  pageIndex,
  imageUrl,
  loadPreview,
  isSelected,
  onToggle,
  rotation = 0
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentUrlRef = useRef<string | null>(imageUrl ?? null);
  const ownsUrlRef = useRef(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(imageUrl ?? null);
  const [isVisible, setIsVisible] = useState(!loadPreview);
  const [isLoading, setIsLoading] = useState(Boolean(loadPreview && !imageUrl));
  const [loadError, setLoadError] = useState<string | null>(null);
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isSideways = normalizedRotation === 90 || normalizedRotation === 270;

  useEffect(() => {
    if (!loadPreview) return;

    const element = rootRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loadPreview]);

  useEffect(() => {
    if (!imageUrl) return;
    if (
      ownsUrlRef.current &&
      currentUrlRef.current &&
      currentUrlRef.current.startsWith('blob:') &&
      currentUrlRef.current !== imageUrl
    ) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
    currentUrlRef.current = imageUrl;
    ownsUrlRef.current = false;
    setResolvedUrl(imageUrl);
    setIsLoading(false);
    setLoadError(null);
  }, [imageUrl]);

  useEffect(() => {
    if (!loadPreview || !isVisible || resolvedUrl) return;

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const nextUrl = await loadPreview();
        if (cancelled) {
          if (nextUrl.startsWith('blob:')) URL.revokeObjectURL(nextUrl);
          return;
        }
        if (
          ownsUrlRef.current &&
          currentUrlRef.current &&
          currentUrlRef.current.startsWith('blob:') &&
          currentUrlRef.current !== nextUrl
        ) {
          URL.revokeObjectURL(currentUrlRef.current);
        }
        currentUrlRef.current = nextUrl;
        ownsUrlRef.current = true;
        setResolvedUrl(nextUrl);
        setLoadError(null);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError('Preview failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isVisible, loadPreview, resolvedUrl]);

  useEffect(() => {
    return () => {
      if (ownsUrlRef.current && currentUrlRef.current && currentUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
    };
  }, []);

  const displayUrl = resolvedUrl ?? imageUrl ?? null;

  return (
    <motion.div
      ref={rootRef}
      layout
      whileHover={{ y: -4 }}
      onClick={onToggle}
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' 
          : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
        }
      `}
    >
      {/* Page Image */}
      <div className="bg-slate-100 dark:bg-slate-800 aspect-[3/4] relative overflow-hidden">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={`Page ${pageIndex + 1}`}
            className="w-full h-full object-contain p-2 transition-transform duration-300 ease-out"
            style={{
              transform: `rotate(${rotation}deg) scale(${isSideways ? 0.72 : 1})`,
              transformOrigin: 'center center',
              willChange: 'transform',
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <div className="h-16 w-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 animate-pulse" />
          </div>
        )}
        
        {/* Selection Overlay (Active) */}
        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center pointer-events-none">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }}
              className="bg-blue-500 text-white p-2 rounded-full shadow-lg"
            >
              <Check size={20} strokeWidth={3} />
            </motion.div>
          </div>
        )}

        {/* Hover Overlay (Inactive) */}
        {!isSelected && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors" />
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-white/40 dark:bg-black/30 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-500">{loadError}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className={`
        px-3 py-2 text-xs font-bold flex items-center justify-between
        ${isSelected 
          ? 'bg-blue-500 text-white' 
          : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'
        }
      `}>
        <span>Page {pageIndex + 1}</span>
        {rotation !== 0 && (
          <span className="flex items-center gap-1 opacity-80">
            <RotateCw size={10} /> {rotation}°
          </span>
        )}
      </div>
    </motion.div>
  );
};
