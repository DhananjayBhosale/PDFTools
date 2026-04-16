import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Loader2 } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { FileUpload } from '../UI/FileUpload';
import { SelectablePagePreview, type SelectableTextLine } from '../UI/SelectablePagePreview';
import { PDFFile, ProcessingStatus } from '../../types';
import { getPageSelectableTextLines, loadPDFDocument, renderPageAsImage } from '../../services/pdfBrowser';
import { revokeObjectUrl } from '../../services/pdfShared';

type ExtractionMode = 'text-layer' | 'ocr';

interface PreviewAsset {
  url: string;
  width: number;
  height: number;
}

interface OCRPageResult {
  pageNumber: number;
  text: string;
  previewUrl: string | null;
  previewWidth: number;
  previewHeight: number;
  selectionLines: SelectableTextLine[];
}

interface OCRResultMeta {
  processedPages: number;
  totalPages: number;
}

const PAGE_PREVIEW_CONFIG = {
  format: 'image/jpeg' as const,
  quality: 0.82,
  scale: 0.95,
};

const OCR_RENDER_CONFIG = {
  format: 'image/png' as const,
  quality: 0.95,
  scale: 2.0,
};

const revokePageResults = (results: OCRPageResult[]) => {
  results.forEach((result) => {
    if (result.previewUrl) revokeObjectUrl(result.previewUrl);
  });
};

const formatPageTextBlock = (page: OCRPageResult) => `--- Page ${page.pageNumber} ---\n${page.text}`;

const createSelectableLine = (
  id: string,
  text: string,
  left: number,
  top: number,
  width: number,
  height: number,
): SelectableTextLine => ({
  id,
  text,
  left,
  top,
  width: Math.max(1, width),
  height: Math.max(1, height),
  fontSize: Math.max(12, height * 0.82),
});

const buildPdfSelectionLines = (
  pageNumber: number,
  textLines: Array<{ text: string; left: number; top: number; width: number; height: number }>,
) =>
  textLines.map((line, index) =>
    createSelectableLine(
      `pdf-page-${pageNumber}-line-${index}`,
      line.text,
      line.left,
      line.top,
      line.width,
      line.height,
    ),
  );

const buildOcrSelectionLines = (
  pageNumber: number,
  ocrData: any,
  sourceWidth: number,
  sourceHeight: number,
): SelectableTextLine[] => {
  if (sourceWidth <= 0 || sourceHeight <= 0) return [];

  const entries = Array.isArray(ocrData?.lines) && ocrData.lines.length > 0
    ? ocrData.lines.map((line: any, index: number) => ({
        id: `ocr-page-${pageNumber}-line-${index}`,
        text: typeof line?.text === 'string' ? line.text.trim() : '',
        bbox: line?.bbox,
      }))
    : Array.isArray(ocrData?.words) && ocrData.words.length > 0
      ? ocrData.words.map((word: any, index: number) => ({
          id: `ocr-page-${pageNumber}-word-${index}`,
          text: typeof word?.text === 'string' ? word.text.trim() : '',
          bbox: word?.bbox,
        }))
      : [];

  return entries
    .filter((entry) =>
      entry.text &&
      entry.bbox &&
      Number.isFinite(entry.bbox.x0) &&
      Number.isFinite(entry.bbox.y0) &&
      Number.isFinite(entry.bbox.x1) &&
      Number.isFinite(entry.bbox.y1),
    )
    .map((entry) =>
      createSelectableLine(
        entry.id,
        entry.text,
        entry.bbox.x0,
        entry.bbox.y0,
        entry.bbox.x1 - entry.bbox.x0,
        entry.bbox.y1 - entry.bbox.y0,
      ),
    );
};

export const OCRPDF: React.FC = () => {
  const [file, setFile] = useState<PDFFile | null>(null);
  const [pageResults, setPageResults] = useState<OCRPageResult[]>([]);
  const [resultMeta, setResultMeta] = useState<OCRResultMeta | null>(null);
  const [pageFilter, setPageFilter] = useState('all');
  const [mode, setMode] = useState<ExtractionMode>('text-layer');
  const [ocrMaxPages, setOcrMaxPages] = useState('5');
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, progress: 0, message: '' });
  const pageResultsRef = useRef<OCRPageResult[]>([]);

  useEffect(() => {
    return () => {
      revokePageResults(pageResultsRef.current);
    };
  }, []);

  const replacePageResults = (nextResults: OCRPageResult[]) => {
    revokePageResults(pageResultsRef.current);
    pageResultsRef.current = nextResults;
    setPageResults(nextResults);
  };

  const clearExtraction = () => {
    replacePageResults([]);
    setResultMeta(null);
    setPageFilter('all');
    setFile(null);
    setStatus({ isProcessing: false, progress: 0, message: '' });
  };

  const createPagePreview = async (pdfDoc: any, pageIndex: number): Promise<PreviewAsset | null> => {
    try {
      const rendered = await renderPageAsImage(pdfDoc, pageIndex, PAGE_PREVIEW_CONFIG);
      return {
        url: rendered.objectUrl,
        width: rendered.width,
        height: rendered.height,
      };
    } catch (error) {
      console.error('Preview generation failed', error);
      return null;
    }
  };

  const extractTextLayer = async (inputFile: File) => {
    const pdfDoc = await loadPDFDocument(inputFile);
    const totalPages = pdfDoc.numPages || 0;
    const nextResults: OCRPageResult[] = [];

    try {
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        setStatus({
          isProcessing: true,
          progress: Math.max(8, Math.round(((pageIndex + 1) / totalPages) * 100)),
          message: `Reading page ${pageIndex + 1} of ${totalPages}...`,
        });

        const [preview, textLines] = await Promise.all([
          createPagePreview(pdfDoc, pageIndex),
          getPageSelectableTextLines(pdfDoc, pageIndex, PAGE_PREVIEW_CONFIG.scale),
        ]);

        const selectionLines = buildPdfSelectionLines(pageIndex + 1, textLines);
        const pageText = selectionLines.map((line) => line.text).join('\n') || 'No selectable text found on this page.';

        nextResults.push({
          pageNumber: pageIndex + 1,
          text: pageText,
          previewUrl: preview?.url ?? null,
          previewWidth: preview?.width ?? 0,
          previewHeight: preview?.height ?? 0,
          selectionLines,
        });
      }
    } catch (error) {
      revokePageResults(nextResults);
      throw error;
    }

    replacePageResults(nextResults);
    setResultMeta({ processedPages: totalPages, totalPages });
  };

  const extractWithOCR = async (inputFile: File) => {
    const pdfDoc = await loadPDFDocument(inputFile);
    const totalPages = pdfDoc.numPages || 0;
    const limit = Math.max(1, Math.min(totalPages, Number(ocrMaxPages) || 1));
    const worker = await createWorker('eng');
    const nextResults: OCRPageResult[] = [];

    try {
      for (let pageIndex = 0; pageIndex < limit; pageIndex += 1) {
        setStatus({
          isProcessing: true,
          progress: Math.max(8, Math.round(((pageIndex + 1) / limit) * 100)),
          message: `Running OCR on page ${pageIndex + 1} of ${limit}...`,
        });

        const rendered = await renderPageAsImage(pdfDoc, pageIndex, OCR_RENDER_CONFIG);

        try {
          const result = await worker.recognize(rendered.objectUrl);
          const selectionLines = buildOcrSelectionLines(pageIndex + 1, result.data, rendered.width, rendered.height);
          const pageText = result.data.text?.trim() || selectionLines.map((line) => line.text).join('\n') || 'No readable text detected on this page.';

          nextResults.push({
            pageNumber: pageIndex + 1,
            text: pageText,
            previewUrl: rendered.objectUrl,
            previewWidth: rendered.width,
            previewHeight: rendered.height,
            selectionLines,
          });
        } catch (error) {
          revokeObjectUrl(rendered.objectUrl);
          throw error;
        }
      }
    } catch (error) {
      revokePageResults(nextResults);
      throw error;
    } finally {
      await worker.terminate();
    }

    replacePageResults(nextResults);
    setResultMeta({ processedPages: limit, totalPages });
  };

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0 || files[0].type !== 'application/pdf') return;
    const selected = files[0];

    replacePageResults([]);
    setResultMeta(null);
    setPageFilter('all');
    setFile({ id: uuidv4(), file: selected, name: selected.name, size: selected.size });
    setStatus({ isProcessing: true, progress: 5, message: mode === 'ocr' ? 'Preparing OCR engine...' : 'Reading text layer...' });

    try {
      if (mode === 'ocr') {
        await extractWithOCR(selected);
      } else {
        await extractTextLayer(selected);
      }

      setStatus({ isProcessing: false, progress: 100, message: 'Done' });
    } catch (error) {
      console.error(error);
      replacePageResults([]);
      setResultMeta(null);
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Extraction failed' });
    }
  };

  const copyTextToClipboard = async (content: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setStatus({ isProcessing: false, progress: 100, message: successMessage });
    } catch {
      setStatus({ isProcessing: false, progress: 0, message: '', error: 'Clipboard copy failed' });
    }
  };

  const visiblePageResults = useMemo(() => {
    if (pageFilter === 'all') return pageResults;
    return pageResults.filter((page) => String(page.pageNumber) === pageFilter);
  }, [pageFilter, pageResults]);

  const combinedText = useMemo(
    () => pageResults.map((page) => formatPageTextBlock(page)).join('\n\n'),
    [pageResults],
  );

  const processedSummary = resultMeta
    ? resultMeta.processedPages < resultMeta.totalPages
      ? `Showing ${resultMeta.processedPages} of ${resultMeta.totalPages} pages. Increase the OCR page limit to process more.`
      : `Showing ${resultMeta.processedPages} page${resultMeta.processedPages === 1 ? '' : 's'}.`
    : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200">
          ← Back to Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Text Extractor</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Extract text from selectable text layers or run OCR for scanned/image-based PDFs.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Extraction Mode</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMode('text-layer')}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === 'text-layer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Text Layer (Fast)
                </button>
                <button
                  onClick={() => setMode('ocr')}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === 'ocr'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  OCR (Scans)
                </button>
              </div>

              {mode === 'ocr' && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Max pages to OCR</label>
                  <input
                    value={ocrMaxPages}
                    onChange={(event) => setOcrMaxPages(event.target.value.replace(/[^\d]/g, ''))}
                    inputMode="numeric"
                    className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              )}
            </div>

            <FileUpload
              onFilesSelected={handleFilesSelected}
              accept=".pdf"
              label={mode === 'ocr' ? 'Drop PDF to run OCR' : 'Drop PDF to extract text layer'}
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={clearExtraction}
                className="flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-slate-100"
              >
                <ArrowLeft size={16} /> Extract another
              </button>
              <div className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Mode: {mode === 'ocr' ? 'OCR' : 'Text Layer'}
              </div>
            </div>

            {status.isProcessing ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="mb-4 animate-spin" size={32} />
                <p>{status.message || 'Extracting text...'}</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Results</div>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {processedSummary || 'No extracted pages yet.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {pageResults.length > 1 && (
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <span>Jump to page</span>
                          <select
                            value={pageFilter}
                            onChange={(event) => setPageFilter(event.target.value)}
                            className="bg-transparent font-medium outline-none"
                          >
                            <option value="all">All pages</option>
                            {pageResults.map((page) => (
                              <option key={page.pageNumber} value={String(page.pageNumber)}>
                                Page {page.pageNumber}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <button
                        onClick={() => copyTextToClipboard(combinedText, 'Copied all extracted text')}
                        disabled={pageResults.length === 0}
                        className="flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy size={16} /> Copy All
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  {visiblePageResults.map((page) => (
                    <motion.article
                      key={page.pageNumber}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
                    >
                      <SelectablePagePreview
                        imageUrl={page.previewUrl}
                        pageNumber={page.pageNumber}
                        previewWidth={page.previewWidth}
                        previewHeight={page.previewHeight}
                        lines={page.selectionLines}
                      />

                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Page {page.pageNumber}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Select text directly on the preview or use the extracted text block below.
                            </p>
                          </div>

                          <button
                            onClick={() => copyTextToClipboard(formatPageTextBlock(page), `Copied page ${page.pageNumber} text`)}
                            className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Copy size={15} /> Copy page
                          </button>
                        </div>

                        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                          {page.text}
                        </pre>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </>
            )}

            {(status.error || status.message === 'Copied all extracted text' || status.message.startsWith('Copied page')) && (
              <div
                className={`fixed bottom-3 right-3 rounded-lg px-3 py-2 text-sm shadow-lg ${
                  status.error ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                }`}
              >
                {status.error || status.message}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
