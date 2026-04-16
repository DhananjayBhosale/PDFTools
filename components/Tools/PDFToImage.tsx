import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from '../UI/FileUpload';
import { PDFFile, ProcessingStatus } from '../../types';
import {
  extractEmbeddedImagesFromPDF,
  loadPDFDocument,
  renderPageAsImage,
  type EmbeddedPdfImageAsset,
  type ImageExportConfig,
} from '../../services/pdfBrowser';
import { downloadBlob, revokeObjectUrls } from '../../services/pdfShared';
import { Download, FileImage, ImageIcon, Loader2, Settings2, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'react-router-dom';
import JSZip from 'jszip';
import { ZoomControls } from '../UI/ZoomControls';
import { ChefSlider } from '../UI/ChefSlider';
import { useZoom } from '../../hooks/useZoom';
import { SEOHead } from '../SEO/SEOHead';

type ExportMode = 'pages' | 'embedded-images';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const getBaseName = (filename: string) => filename.replace(/\.pdf$/i, '');

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });

  const [config, setConfig] = useState<ImageExportConfig>({ format: 'image/jpeg', quality: 0.8, scale: 2 });
  const [preview, setPreview] = useState<{ objectUrl: string; blob: Blob; width: number; height: number; sizeBytes: number } | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isScanningImages, setIsScanningImages] = useState(false);
  const [embeddedImages, setEmbeddedImages] = useState<EmbeddedPdfImageAsset[]>([]);
  const [selectedEmbeddedIds, setSelectedEmbeddedIds] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState<ExportMode>('pages');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const embeddedImagesRef = useRef<EmbeddedPdfImageAsset[]>([]);
  const scanRunIdRef = useRef(0);

  const { zoom, zoomIn, zoomOut, resetZoom } = useZoom(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const replaceEmbeddedImages = useCallback((nextImages: EmbeddedPdfImageAsset[]) => {
    revokeObjectUrls(embeddedImagesRef.current.map((image) => image.objectUrl));
    embeddedImagesRef.current = nextImages;
    setEmbeddedImages(nextImages);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      revokeObjectUrls(embeddedImagesRef.current.map((image) => image.objectUrl));
      if (pdfDoc?.destroy) {
        void pdfDoc.destroy();
      }
    };
  }, [pdfDoc]);

  const scanEmbeddedImages = useCallback(async (doc: any) => {
    const runId = ++scanRunIdRef.current;
    setIsScanningImages(true);

    try {
      const images = await extractEmbeddedImagesFromPDF(doc);
      if (runId !== scanRunIdRef.current) {
        revokeObjectUrls(images.map((image) => image.objectUrl));
        return;
      }

      replaceEmbeddedImages(images);
      setSelectedEmbeddedIds(images.map((image) => image.id));
      if (images.length === 0 && exportMode === 'embedded-images') {
        setExportMode('pages');
      }
    } catch (error) {
      console.error(error);
      if (runId === scanRunIdRef.current) {
        replaceEmbeddedImages([]);
        setSelectedEmbeddedIds([]);
      }
    } finally {
      if (runId === scanRunIdRef.current) {
        setIsScanningImages(false);
      }
    }
  }, [exportMode, replaceEmbeddedImages]);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    if (selectedFile.type !== 'application/pdf') return;

    try {
      const doc = await loadPDFDocument(selectedFile);
      setFile({
        id: uuidv4(),
        file: selectedFile,
        name: selectedFile.name,
        size: selectedFile.size,
        pageCount: doc.numPages,
      });
      setPdfDoc(doc);
      setExportMode('pages');
      replaceEmbeddedImages([]);
      setSelectedEmbeddedIds([]);
      void scanEmbeddedImages(doc);
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Failed to load PDF' });
    }
  };

  const updatePreview = useCallback(async () => {
    if (!pdfDoc) return;
    setIsGeneratingPreview(true);
    try {
      const result = await renderPageAsImage(pdfDoc, 0, config);
      setPreview((previous) => {
        if (previous?.objectUrl && previous.objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previous.objectUrl);
        }
        previewUrlRef.current = result.objectUrl;
        return result;
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [config, pdfDoc]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(updatePreview, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [updatePreview]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX - pan.x;
    const startY = event.clientY - pan.y;

    const onMove = (moveEvent: PointerEvent) => {
      setPan({ x: moveEvent.clientX - startX, y: moveEvent.clientY - startY });
    };
    const onUp = (upEvent: PointerEvent) => {
      event.currentTarget.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    if (zoom === 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const handlePageExport = async () => {
    if (!pdfDoc || !file) return;
    setStatus({ isProcessing: true, progress: 0, message: 'Starting export...' });

    try {
      const zip = new JSZip();
      const numPages = pdfDoc.numPages;
      const extension = config.format === 'image/png' ? 'png' : config.format === 'image/webp' ? 'webp' : 'jpg';

      for (let pageIndex = 0; pageIndex < numPages; pageIndex += 1) {
        setStatus({
          isProcessing: true,
          progress: (pageIndex / numPages) * 100,
          message: `Rendering page ${pageIndex + 1}/${numPages}...`,
        });
        const { blob } = await renderPageAsImage(pdfDoc, pageIndex, config);
        zip.file(`Page-${pageIndex + 1}.${extension}`, await blob.arrayBuffer());
      }

      setStatus({ isProcessing: true, progress: 100, message: 'Zipping...' });
      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `${getBaseName(file.name)}-images.zip`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Export failed' });
    }
  };

  const selectedEmbeddedImages = useMemo(
    () => embeddedImages.filter((image) => selectedEmbeddedIds.includes(image.id)),
    [embeddedImages, selectedEmbeddedIds],
  );

  const downloadEmbeddedImages = async (images: EmbeddedPdfImageAsset[]) => {
    if (!file || images.length === 0) return;

    const baseName = getBaseName(file.name);
    if (images.length === 1) {
      const image = images[0];
      downloadBlob(image.blob, `${baseName}-embedded-image-pages-${image.pageNumbers.join('-')}.png`, 'image/png');
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
      return;
    }

    setStatus({ isProcessing: true, progress: 10, message: 'Preparing embedded images...' });

    try {
      const zip = new JSZip();
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        setStatus({
          isProcessing: true,
          progress: ((index + 1) / images.length) * 100,
          message: `Packing image ${index + 1}/${images.length}...`,
        });
        zip.file(
          `embedded-image-${String(index + 1).padStart(2, '0')}-pages-${image.pageNumbers.join('-')}.png`,
          await image.blob.arrayBuffer(),
        );
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `${baseName}-embedded-images.zip`);
      setStatus({ isProcessing: false, progress: 100, message: 'Done!' });
    } catch (error) {
      console.error(error);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Embedded image export failed' });
    }
  };

  const handleEmbeddedExport = async () => {
    await downloadEmbeddedImages(selectedEmbeddedImages);
  };

  const handleStartOver = () => {
    scanRunIdRef.current += 1;
    setIsScanningImages(false);
    setSelectedEmbeddedIds([]);
    setExportMode('pages');
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    replaceEmbeddedImages([]);
    if (pdfDoc?.destroy) {
      void pdfDoc.destroy();
    }
    setFile(null);
    setPdfDoc(null);
    setPreview(null);
    setStatus({ isProcessing: false, progress: 0, message: '' });
  };

  const hasDetectedEmbeddedImages = embeddedImages.length > 0;
  const hasImageModeOption = isScanningImages || hasDetectedEmbeddedImages;

  const toggleEmbeddedSelection = (imageId: string) => {
    setSelectedEmbeddedIds((previous) =>
      previous.includes(imageId)
        ? previous.filter((id) => id !== imageId)
        : [...previous, imageId],
    );
  };

  const handlePrimaryAction = () => {
    if (exportMode === 'embedded-images') {
      void handleEmbeddedExport();
      return;
    }
    void handlePageExport();
  };

  const primaryActionLabel = exportMode === 'embedded-images'
    ? `Download Selected${selectedEmbeddedImages.length > 0 ? ` (${selectedEmbeddedImages.length})` : ''}`
    : `Convert ${pdfDoc?.numPages ?? 0} Pages`;

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <SEOHead
        title="PDF to JPG Converter - Export Pages to Images | PDF Chef"
        description="Convert PDF pages to high-quality JPG or PNG images. Extract embedded images locally. Secure and fast."
      />

      <div className="z-30 flex min-h-16 flex-shrink-0 flex-col items-start justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:px-6 sm:py-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
            <Undo2 size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-none text-slate-900 dark:text-white">PDF to Image</h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {exportMode === 'embedded-images' ? 'Extract Embedded Images' : 'Export Pages'}
            </p>
          </div>
        </div>

        {file && (
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
            {hasDetectedEmbeddedImages && (
              <div className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 sm:block">
                {embeddedImages.length} images detected
              </div>
            )}
            <button
              onClick={handleStartOver}
              className="rounded-lg px-3 py-2 text-xs font-bold text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30 sm:px-4 sm:text-sm"
            >
              Start Over
            </button>
            <button
              onClick={handlePrimaryAction}
              disabled={
                status.isProcessing ||
                (exportMode === 'embedded-images' ? selectedEmbeddedImages.length === 0 : !preview)
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:opacity-50 sm:px-6 sm:text-sm"
            >
              {status.isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              <span>{primaryActionLabel}</span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl">
              <FileUpload onFilesSelected={handleFilesSelected} accept=".pdf" label="Drop PDF to convert to images" />
            </motion.div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4 md:flex-row">
            <div className="custom-scrollbar flex h-full w-full flex-shrink-0 flex-col gap-3 overflow-y-auto md:w-80 md:max-w-80 sm:gap-4">
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                  <Settings2 size={18} className="text-blue-500" /> Export Settings
                </div>

                {hasImageModeOption && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setExportMode('pages')}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          exportMode === 'pages'
                            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      >
                        Pages
                      </button>
                      <button
                        onClick={() => hasDetectedEmbeddedImages && setExportMode('embedded-images')}
                        disabled={!hasDetectedEmbeddedImages}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          exportMode === 'embedded-images'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {isScanningImages ? 'Scanning…' : `Images${hasDetectedEmbeddedImages ? ` (${embeddedImages.length})` : ''}`}
                      </button>
                    </div>
                  </div>
                )}

                {exportMode === 'pages' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Format</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['image/jpeg', 'image/png', 'image/webp'].map((format) => (
                          <button
                            key={format}
                            onClick={() => setConfig({ ...config, format: format as ImageExportConfig['format'] })}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                              config.format === format
                                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                                : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                            }`}
                          >
                            {format.split('/')[1].toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {config.format !== 'image/png' && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quality</label>
                          <span className="text-xs font-mono text-slate-400">{Math.round(config.quality * 100)}%</span>
                        </div>
                        <ChefSlider
                          min={0.1}
                          max={1}
                          step={0.01}
                          value={config.quality}
                          onChange={(next) => setConfig({ ...config, quality: next })}
                          ariaLabel="Image quality"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Resolution</label>
                        <span className="text-xs font-mono text-slate-400">{Math.round(config.scale * 72)} DPI</span>
                      </div>
                      <ChefSlider
                        min={1}
                        max={4}
                        step={0.05}
                        value={config.scale}
                        onChange={(next) => setConfig({ ...config, scale: next })}
                        ariaLabel="Image resolution"
                      />
                    </div>

                    <button
                      onClick={handlePageExport}
                      disabled={status.isProcessing || !preview}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {status.isProcessing ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                      <span>Convert {pdfDoc?.numPages} Pages</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                      <div className="font-bold">Embedded image extraction</div>
                      <p>Exports image objects found inside the PDF as lossless PNG files, without rasterizing full pages.</p>
                    </div>

                    {hasDetectedEmbeddedImages ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span>Selection</span>
                            <span>{selectedEmbeddedImages.length} / {embeddedImages.length}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedEmbeddedIds(embeddedImages.map((image) => image.id))}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Select all
                            </button>
                            <button
                              onClick={() => setSelectedEmbeddedIds([])}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={handleEmbeddedExport}
                          disabled={status.isProcessing || selectedEmbeddedImages.length === 0}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {status.isProcessing ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                          <span>Download Selected</span>
                        </button>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {isScanningImages ? 'Scanning this PDF for embedded images…' : 'No embedded raster images were detected in this PDF.'}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {exportMode === 'pages' ? (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="absolute right-2 top-2 z-20 sm:right-4 sm:top-4">
                  <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} />
                </div>

                <div
                  className={`relative flex flex-1 items-center justify-center overflow-hidden ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  onPointerDown={handlePointerDown}
                >
                  {isGeneratingPreview && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm dark:bg-black/50">
                      <Loader2 className="animate-spin text-blue-500" size={40} />
                    </div>
                  )}
                  {preview ? (
                    <div
                      className="relative will-change-transform"
                      style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                    >
                      <img
                        src={preview.objectUrl}
                        alt="Preview"
                        className="max-h-[68dvh] max-w-full select-none object-contain shadow-2xl md:max-h-[80vh]"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <FileImage size={48} className="mb-2 opacity-50" />
                      <p>Generating preview...</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  Zoom in to inspect details. {zoom > 1 && 'Drag to pan.'}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <ImageIcon size={18} className="text-emerald-500" />
                    Embedded Images
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Review the image assets detected in the PDF and download the ones you want as lossless PNG.
                  </p>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                  {isScanningImages ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500">
                      <Loader2 className="mb-4 animate-spin" size={32} />
                      <p>Scanning PDF for embedded images…</p>
                    </div>
                  ) : embeddedImages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500">
                      <ImageIcon size={40} className="mb-3 opacity-50" />
                      <p>No embedded raster images were detected.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {embeddedImages.map((image, index) => {
                        const isSelected = selectedEmbeddedIds.includes(image.id);
                        return (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() => toggleEmbeddedSelection(image.id)}
                            className={`overflow-hidden rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                                : 'border-slate-200 hover:border-emerald-300 dark:border-slate-700 dark:hover:border-emerald-700'
                            }`}
                          >
                            <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 p-4 dark:bg-slate-950/60">
                              <img src={image.objectUrl} alt={`Embedded image ${index + 1}`} className="max-h-full max-w-full object-contain" />
                            </div>

                            <div className="space-y-3 bg-white p-4 dark:bg-slate-900">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-bold text-slate-900 dark:text-white">Image {index + 1}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Pages {image.pageNumbers.join(', ')}
                                  </div>
                                </div>
                                <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                                  isSelected
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {isSelected ? 'Selected' : 'Tap to select'}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                                  <div className="font-semibold text-slate-700 dark:text-slate-200">{image.width} × {image.height}</div>
                                  <div>pixels</div>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/80">
                                  <div className="font-semibold text-slate-700 dark:text-slate-200">{formatBytes(image.byteSize)}</div>
                                  <div>lossless PNG</div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void downloadEmbeddedImages([image]);
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <Download size={16} /> Download image
                              </button>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
