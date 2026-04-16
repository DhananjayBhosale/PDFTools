import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Eye,
  X,
  Settings2,
  HardDrive,
  RotateCcw,
  Plus,
  Minus,
  Move,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ChefSlider } from '../UI/ChefSlider';
import { type AdaptiveConfig, generatePreviewPair, getInterpolatedConfig } from '../../services/pdfBrowser';

interface Props {
  file: File;
  config: AdaptiveConfig;
  isTextHeavy: boolean;
  onClose: () => void;
  onConfirm: (config: AdaptiveConfig) => void;
}

export const ReadabilityPreview: React.FC<Props> = ({ file, config: initialConfig, isTextHeavy, onClose, onConfirm }) => {
  const [images, setImages] = useState<{ original: string; compressed: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [sliderValue, setSliderValue] = useState(50);
  const [currentConfig, setCurrentConfig] = useState<AdaptiveConfig>(initialConfig);
  const [sizeEstimate, setSizeEstimate] = useState<{ estimatedSize: number; ratio: number } | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0, cw: 0, ch: 0 });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const dragStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  const clampPanToBounds = useCallback(
    (nextPan: { x: number; y: number }, targetZoom = zoom) => {
      const scaledW = bounds.w * targetZoom;
      const scaledH = bounds.h * targetZoom;
      const maxPanX = Math.max(0, (scaledW - bounds.cw) / 2);
      const maxPanY = Math.max(0, (scaledH - bounds.ch) / 2);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextPan.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextPan.y)),
      };
    },
    [bounds, zoom],
  );

  const generate = useCallback(
    async (cfg: AdaptiveConfig, requestedPageIndex: number) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);

      try {
        const result = await generatePreviewPair(file, cfg, { pageIndex: requestedPageIndex });
        if (requestId !== requestIdRef.current) return;

        setImages({ original: result.original, compressed: result.compressed });
        setPageCount(result.pageCount);
        setPageIndex(result.pageIndex);
        setSizeEstimate({
          estimatedSize: result.metrics.estimatedTotalSize,
          ratio: result.metrics.estimatedTotalSize / file.size,
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [file],
  );

  useEffect(() => {
    const startDPI = initialConfig.projectedDPI;
    const approxSlider = Math.max(0, Math.min(100, ((startDPI - 43) / (300 - 43)) * 100));
    const normalizedSlider = Number(approxSlider.toFixed(1));
    setSliderValue(normalizedSlider);
    setCurrentConfig(initialConfig);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    void generate(initialConfig, 0);
  }, [generate, initialConfig]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    [],
  );

  const updateBounds = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;

    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;
    if (!nw || !nh || !cw || !ch) return;

    const containerRatio = cw / ch;
    const imageRatio = nw / nh;

    const renderedW = imageRatio > containerRatio ? cw : ch * imageRatio;
    const renderedH = imageRatio > containerRatio ? cw / imageRatio : ch;

    setBounds({ w: renderedW, h: renderedH, cw, ch });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [updateBounds]);

  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
      return;
    }
    setPan((current) => clampPanToBounds(current));
  }, [bounds, clampPanToBounds, zoom]);

  const setZoomTo = useCallback(
    (nextZoom: number) => {
      setZoom((previousZoom) => {
        const clamped = Math.max(1, Math.min(10, Number(nextZoom.toFixed(2))));
        if (clamped === previousZoom) return previousZoom;

        setPan((currentPan) => (clamped <= 1 ? { x: 0, y: 0 } : clampPanToBounds(currentPan, clamped)));
        return clamped;
      });
    },
    [clampPanToBounds],
  );

  const setZoomByDelta = useCallback(
    (delta: number) => {
      setZoom((previousZoom) => {
        const clamped = Math.max(1, Math.min(10, Number((previousZoom + delta).toFixed(2))));
        if (clamped === previousZoom) return previousZoom;

        setPan((currentPan) => (clamped <= 1 ? { x: 0, y: 0 } : clampPanToBounds(currentPan, clamped)));
        return clamped;
      });
    },
    [clampPanToBounds],
  );

  const handleWheelZoom = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!images) return;

      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.2 : -0.2;
      setZoomByDelta(delta);
    },
    [images, setZoomByDelta],
  );

  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    if (!isPanning) return;

    const onMove = (event: PointerEvent) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;

      const dx = event.clientX - dragStart.clientX;
      const dy = event.clientY - dragStart.clientY;
      setPan(
        clampPanToBounds({
          x: dragStart.panX + dx,
          y: dragStart.panY + dy,
        }),
      );
    };

    const onUp = () => {
      setIsPanning(false);
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [clampPanToBounds, isPanning]);

  const requestPage = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, nextIndex));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    void generate(currentConfig, clamped);
  };

  const applyQualitySlider = (value: number, immediate = false) => {
    const normalized = Math.max(0, Math.min(100, value));
    setSliderValue(normalized);
    const nextConfig = getInterpolatedConfig(normalized, isTextHeavy);
    setCurrentConfig(nextConfig);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (immediate) {
      void generate(nextConfig, pageIndex);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void generate(nextConfig, pageIndex);
    }, 180);
  };

  const dpi = currentConfig.projectedDPI;
  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 flex h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Eye size={20} className="text-blue-500" /> Readability Check
            </h3>
            <p className="text-sm text-slate-400">Side-by-side preview with synced zoom and pan.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => requestPage(pageIndex - 1)}
              disabled={loading || pageIndex <= 0}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">
              Page {pageIndex + 1} / {pageCount}
            </div>
            <button
              onClick={() => requestPage(pageIndex + 1)}
              disabled={loading || pageIndex >= pageCount - 1}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>

            <div className="mx-1 h-6 w-px bg-slate-700" />

            <button
              onClick={() => setZoomByDelta(-0.25)}
              disabled={zoom <= 1}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
              aria-label="Zoom out"
            >
              <Minus size={16} />
            </button>
            <span className="w-12 text-center font-mono text-sm font-bold text-white">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoomByDelta(0.25)}
              disabled={zoom >= 10}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 disabled:opacity-30"
              aria-label="Zoom in"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => {
                setZoomTo(1);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800"
              aria-label="Reset zoom"
            >
              <RotateCcw size={16} />
            </button>

            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col divide-y divide-slate-800 overflow-hidden bg-black/60 md:flex-row md:divide-x md:divide-y-0">
          <div
            ref={containerRef}
            className={`relative flex flex-1 items-center justify-center overflow-hidden bg-slate-100/5 ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            onPointerDown={startPan}
            onWheel={handleWheelZoom}
            style={{ touchAction: zoom > 1 ? 'none' : 'auto' }}
          >
            {images ? (
              <>
                <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs font-bold text-white">
                  Original
                </div>
                <img
                  ref={imageRef}
                  src={images.original}
                  alt="Original"
                  onLoad={updateBounds}
                  className="h-auto max-h-full w-auto max-w-full select-none object-contain shadow-2xl will-change-transform"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 160ms ease-out',
                  }}
                  draggable={false}
                />
              </>
            ) : (
              <div className="text-sm text-slate-500">Loading preview...</div>
            )}
          </div>

          <div
            className={`relative flex flex-1 items-center justify-center overflow-hidden bg-slate-100/5 ${
              zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
            }`}
            onPointerDown={startPan}
            onWheel={handleWheelZoom}
            style={{ touchAction: zoom > 1 ? 'none' : 'auto' }}
          >
            {images ? (
              <>
                <div className="pointer-events-none absolute left-4 top-4 z-10 flex gap-2">
                  <div className="rounded-full bg-blue-600/90 px-3 py-1 text-xs font-bold text-white shadow-lg">Compressed</div>
                  <div
                    className={`rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white shadow-lg ${
                      dpi < 100 ? 'bg-rose-500/85' : 'bg-black/65'
                    }`}
                  >
                    {dpi} DPI
                  </div>
                </div>
                {zoom > 1 && isPanning && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white">
                      <Move size={14} /> Synced panning
                    </div>
                  </div>
                )}
                <img
                  src={images.compressed}
                  alt="Compressed"
                  className={`h-auto max-h-full w-auto max-w-full select-none object-contain shadow-2xl ${
                    loading ? 'opacity-60 blur-[1px]' : 'opacity-100'
                  } will-change-transform`}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 160ms ease-out',
                  }}
                  draggable={false}
                />
              </>
            ) : (
              <div className="text-sm text-slate-500">Loading preview...</div>
            )}
          </div>
        </div>

        <div className="z-20 flex flex-col gap-5 border-t border-slate-800 bg-slate-900 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:w-[52%]">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <Settings2 size={16} /> Compression quality
              </label>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
                Scale {currentConfig.scale.toFixed(2)}x • Q {Math.round(currentConfig.quality * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">Low</span>
              <ChefSlider
                min={0}
                max={100}
                step={0.1}
                value={sliderValue}
                onChange={applyQualitySlider}
                ariaLabel="Compression quality"
                className="flex-1"
              />
              <span className="text-xs font-medium text-slate-500">High</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'Low', value: 10 },
                { label: 'Balanced', value: 50 },
                { label: 'High', value: 85 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyQualitySlider(preset.value, true)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    Math.abs(sliderValue - preset.value) <= 5
                      ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
            {sizeEstimate && (
              <div className={`min-w-[150px] text-right ${loading ? 'opacity-60' : 'opacity-100'}`}>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Estimated size</div>
                <div className="flex items-center justify-end gap-2 font-mono text-xl font-bold text-white">
                  <HardDrive size={18} className="text-slate-500" />~{formatSize(sizeEstimate.estimatedSize)}
                </div>
                <div
                  className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-xs font-bold ${
                    sizeEstimate.ratio >= 1 ? 'bg-amber-900/30 text-amber-400' : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {sizeEstimate.ratio >= 1 ? 'No reduction' : `-${Math.round((1 - sizeEstimate.ratio) * 100)}%`}
                </div>
              </div>
            )}

            <button
              onClick={() => onConfirm(currentConfig)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold text-white shadow-lg shadow-blue-900/20 transition sm:w-auto ${
                dpi < 100 ? 'bg-rose-600 hover:bg-rose-500' : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              {dpi < 100 && <AlertTriangle size={18} />}
              {dpi < 100 ? 'Use anyway' : 'Apply compression'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
