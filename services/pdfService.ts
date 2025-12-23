import { PDFDocument, rgb, degrees, StandardFonts, PDFFont } from 'pdf-lib';
import JSZip from 'jszip';
import { PDFMetadata } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Fix for ESM import of pdfjs-dist which might be wrapped in default
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configure Worker
if (typeof window !== 'undefined') {
  // Ensure GlobalWorkerOptions exists before setting workerSrc
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Use cdnjs for the worker as it is more reliable for classic script loading via importScripts
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}

// Helper to read file as ArrayBuffer
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Helper to safely get Uint8Array from ArrayBuffer
// Slicing ensures we pass a copy if needed and avoid detachment issues with some browser implementations of workers
const getSafeBuffer = (buffer: ArrayBuffer): Uint8Array => {
  return new Uint8Array(buffer).slice(0);
};

// --- Expose PDF.js Document for UI ---
export const loadPDFDocument = async (file: File) => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  return pdfjs.getDocument(getSafeBuffer(arrayBuffer)).promise;
};

// --- Analysis & Utilities ---

export const analyzePDF = async (file: File): Promise<{ isTextHeavy: boolean; pageCount: number }> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const maxPagesToCheck = Math.min(numPages, 3);
    let totalTextItems = 0;

    for (let i = 1; i <= maxPagesToCheck; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      totalTextItems += textContent.items.length;
    }

    const avgTextItems = totalTextItems / maxPagesToCheck;
    return {
      isTextHeavy: avgTextItems > 20,
      pageCount: numPages
    };
  } catch (e) {
    console.error("Analysis failed", e);
    return { isTextHeavy: false, pageCount: 0 };
  }
};

export const getPdfPagePreviews = async (file: File): Promise<string[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const previews: string[] = [];
  const maxPages = Math.min(numPages, 50); // Cap at 50 for performance safety in previews

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 }); // Thumbnail scale
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Force opaque white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    previews.push(canvas.toDataURL('image/jpeg', 0.8));
  }
  return previews;
};

// --- Core PDF Functions ---

export const mergePDFs = async (files: File[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return mergedPdf.save();
};

export const createPDFFromImages = async (files: File[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    let image;
    if (file.type === 'image/jpeg') {
      image = await pdfDoc.embedJpg(arrayBuffer);
    } else if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(arrayBuffer);
    } else {
      continue;
    }
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return pdfDoc.save();
};

export const splitPDF = async (file: File): Promise<Blob> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const zip = new JSZip();
  const pageCount = pdfDoc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    zip.file(`${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`, pdfBytes);
  }
  return zip.generateAsync({ type: 'blob' });
};

export const extractPages = async (file: File, pageIndices: number[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  return newPdf.save();
};

export const rotatePDF = async (file: File, rotation: 90 | 180 | 270): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  pages.forEach(page => {
    const currentRotation = page.getRotation();
    page.setRotation(degrees(currentRotation.angle + rotation));
  });
  return pdfDoc.save();
};

export const rotateSpecificPages = async (file: File, rotations: { pageIndex: number, rotation: number }[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  rotations.forEach(({ pageIndex, rotation }) => {
    if (pageIndex >= 0 && pageIndex < pages.length) {
      const page = pages[pageIndex];
      const currentRotation = page.getRotation();
      page.setRotation(degrees(currentRotation.angle + rotation));
    }
  });
  return pdfDoc.save();
};

export const protectPDF = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  (pdfDoc as any).encrypt({
    userPassword: password,
    ownerPassword: password,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: false,
      documentAssembly: false,
    },
  });
  return pdfDoc.save();
};

export const getPDFMetadata = async (file: File): Promise<PDFMetadata> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  return {
    title: pdfDoc.getTitle(),
    author: pdfDoc.getAuthor(),
    subject: pdfDoc.getSubject(),
    keywords: pdfDoc.getKeywords(),
    creator: pdfDoc.getCreator(),
    producer: pdfDoc.getProducer(),
    creationDate: pdfDoc.getCreationDate(),
    modificationDate: pdfDoc.getModificationDate(),
  };
};

export const setPDFMetadata = async (file: File, metadata: PDFMetadata): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  if (metadata.title !== undefined) pdfDoc.setTitle(metadata.title);
  if (metadata.author !== undefined) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject !== undefined) pdfDoc.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) pdfDoc.setKeywords(metadata.keywords.split(' ')); 
  if (metadata.creator !== undefined) pdfDoc.setCreator(metadata.creator);
  if (metadata.producer !== undefined) pdfDoc.setProducer(metadata.producer);
  if (metadata.creationDate !== undefined) pdfDoc.setCreationDate(metadata.creationDate);
  if (metadata.modificationDate !== undefined) pdfDoc.setModificationDate(metadata.modificationDate);
  return pdfDoc.save();
};

export const getPDFPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (e) {
    console.error("Error counting pages", e);
    return 0;
  }
};

// --- NEW CAPABILITIES ---

export const flattenPDF = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();
  form.flatten();
  return pdfDoc.save();
};

export const unlockPDF = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  // Loading with password and saving without options removes encryption
  const pdfDoc = await PDFDocument.load(arrayBuffer, { password } as any);
  return pdfDoc.save();
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  return fullText;
};

export const addWatermarkToPage = async (
  file: File, 
  text: string, 
  pageIndex: number, 
  xPct: number, // 0-1 percentage of width
  yPct: number  // 0-1 percentage of height
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const page = pages[pageIndex];
  
  if (page) {
    const { width, height } = page.getSize();
    // Default font
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText(text, {
      x: width * xPct,
      y: height * (1 - yPct), // PDF y is from bottom
      size: 24,
      font: font,
      color: rgb(0.95, 0.1, 0.1),
    });
  }
  return pdfDoc.save();
};

// --- SIGNATURE SUPPORT ---

export interface SignaturePlacement {
  id: string;
  pageIndex: number;
  dataUrl: string; // PNG/JPEG base64
  x: number; // Percentage 0-1
  y: number; // Percentage 0-1
  width: number; // Percentage of page width 0-1
  aspectRatio: number; // width/height
}

export const applySignaturesToPDF = async (file: File, signatures: SignaturePlacement[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const sig of signatures) {
    if (sig.pageIndex < 0 || sig.pageIndex >= pages.length) continue;
    
    const page = pages[sig.pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Embed the image
    let image;
    // Simple check for mime type signature in base64
    if (sig.dataUrl.startsWith('data:image/png')) {
      image = await pdfDoc.embedPng(sig.dataUrl);
    } else {
      image = await pdfDoc.embedJpg(sig.dataUrl);
    }
    
    // Calculate final dimensions based on percentage
    const finalWidth = pageWidth * sig.width;
    const finalHeight = finalWidth / sig.aspectRatio;
    
    // Calculate coordinates
    // PDF coordinates start at bottom-left
    // UI input 'y' is typically top-down percentage
    const pdfX = pageWidth * sig.x;
    const pdfY = pageHeight - (pageHeight * sig.y) - finalHeight;

    page.drawImage(image, {
      x: pdfX,
      y: pdfY,
      width: finalWidth,
      height: finalHeight,
    });
  }

  return pdfDoc.save();
};

// --- EDITING LOGIC (Redact & Replace) ---

export interface TextEdit {
  pageIndex: number;
  originalText: string;
  newText: string;
  x: number; // PDF Points
  y: number; // PDF Points (bottom-left origin)
  width: number; // PDF Points
  height: number; // PDF Points
  fontSize: number;
  fontName: string;
  backgroundColor: [number, number, number]; // RGB 0-255
}

export const saveEditedPDF = async (file: File, edits: TextEdit[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Embed standard fonts
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  const getFont = (name: string): PDFFont => {
    const n = name.toLowerCase();
    if (n.includes('times') || n.includes('roman')) return fontTimes;
    if (n.includes('courier') || n.includes('mono')) return fontCourier;
    return fontHelvetica;
  };

  const pages = pdfDoc.getPages();

  for (const edit of edits) {
    if (edit.pageIndex < 0 || edit.pageIndex >= pages.length) continue;
    const page = pages[edit.pageIndex];
    const { height } = page.getSize();

    // 1. REDACT (Draw rectangle over old text)
    // Need to handle coordinate flip (PDF is bottom-up, UI provided top-down usually, but let's assume UI passed PDF coords or we convert there)
    // Our UI implementation will pass PDF coords directly to keep this pure.
    
    // Background color 0-255 -> 0-1
    const bgR = edit.backgroundColor[0] / 255;
    const bgG = edit.backgroundColor[1] / 255;
    const bgB = edit.backgroundColor[2] / 255;

    page.drawRectangle({
      x: edit.x,
      y: edit.y,
      width: edit.width,
      height: edit.height * 1.2, // Slightly larger to cover ascenders/descenders
      color: rgb(bgR, bgG, bgB),
    });

    // 2. REPLACE (Draw new text)
    if (edit.newText.trim() !== "") {
      const font = getFont(edit.fontName);
      // Center vertically in the box approx
      page.drawText(edit.newText, {
        x: edit.x,
        y: edit.y + (edit.height * 0.1), // Slight bump for baseline
        size: edit.fontSize,
        font: font,
        color: rgb(0, 0, 0), // Assuming black text for MVP, could sample color too
      });
    }
  }

  return pdfDoc.save();
};

// --- ADAPTIVE COMPRESSION LOGIC (Unchanged) ---
// ... (Previous compression code remains here, omitted for brevity as it was not requested to change but needs to exist)
// I will include the existing compression code to ensure the file is complete.

export type CompressionLevel = 'extreme' | 'recommended' | 'less';

export interface CompressionResult {
  data: Uint8Array;
  status: 'success' | 'blocked' | 'error';
  meta: {
    originalSize: number;
    compressedSize: number;
    effectiveScale: number;
    effectiveQuality: number;
    iterations: number;
    strategyUsed: string;
    projectedDPI: number;
  };
}

export interface AdaptiveConfig {
  scale: number;
  quality: number;
  projectedDPI: number;
}

export const getAdaptiveConfig = (level: CompressionLevel, isTextHeavy: boolean): AdaptiveConfig => {
  let scale = 1.0;
  let quality = 0.7;

  if (level === 'extreme') {
    scale = 0.8;
    quality = 0.4;
  } else if (level === 'recommended') {
    scale = 1.4;
    quality = 0.6;
  } else {
    scale = 2.0;
    quality = 0.8;
  }

  if (isTextHeavy) {
    scale *= 0.85; 
    quality -= 0.1;
  }

  return {
    scale: parseFloat(scale.toFixed(2)),
    quality: parseFloat(quality.toFixed(2)),
    projectedDPI: Math.round(scale * 72)
  };
};

export const getInterpolatedConfig = (value: number, isTextHeavy: boolean): AdaptiveConfig => {
  const minScale = 0.6;
  const maxScale = 2.0;
  const minQuality = 0.3;
  const maxQuality = 0.9;
  const t = value / 100;
  
  let scale = minScale + (maxScale - minScale) * t;
  let quality = minQuality + (maxQuality - minQuality) * t;

  if (isTextHeavy) {
    scale *= 0.9; 
  }

  return {
    scale: Number(scale.toFixed(2)),
    quality: Number(quality.toFixed(2)),
    projectedDPI: Math.round(scale * 72)
  };
};

export const calculateTargetSize = (originalSize: number, level: CompressionLevel, isTextHeavy: boolean): number => {
  let reductionTarget = 0;
  switch (level) {
    case 'extreme': reductionTarget = isTextHeavy ? 0.40 : 0.60; break;
    case 'recommended': reductionTarget = isTextHeavy ? 0.20 : 0.35; break;
    case 'less': reductionTarget = 0.15; break;
  }
  return Math.floor(originalSize * (1 - reductionTarget));
};

const performCompressionPass = async (pdf: any, numPages: number, scale: number, quality: number, onProgress?: (progress: number) => void): Promise<Uint8Array> => {
  const newPdf = await PDFDocument.create();
  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i / numPages);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context not available');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Force opaque white background for compression rendering
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
    const jpgImage = await newPdf.embedJpg(imgDataUrl);
    const originalViewport = page.getViewport({ scale: 1.0 });
    const newPage = newPdf.addPage([originalViewport.width, originalViewport.height]);
    newPage.drawImage(jpgImage, { x: 0, y: 0, width: originalViewport.width, height: originalViewport.height });
  }
  return newPdf.save();
};

export const compressPDFAdaptive = async (
  file: File, 
  level: CompressionLevel, 
  onProgress?: (percent: number) => void,
  ignoreSafety: boolean = false,
  customConfig?: AdaptiveConfig
): Promise<CompressionResult> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const analysis = await analyzePDF(file);
  
  let scale, quality, projectedDPI;
  
  if (customConfig) {
    scale = customConfig.scale;
    quality = customConfig.quality;
    projectedDPI = customConfig.projectedDPI;
  } else {
    const config = getAdaptiveConfig(level, analysis.isTextHeavy);
    scale = config.scale;
    quality = config.quality;
    projectedDPI = config.projectedDPI;
  }

  if (!ignoreSafety && projectedDPI < 90) {
    return {
      data: new Uint8Array(0),
      status: 'blocked',
      meta: {
        originalSize: file.size,
        compressedSize: 0,
        effectiveScale: scale,
        effectiveQuality: quality,
        iterations: 0,
        strategyUsed: 'Safety Block',
        projectedDPI: projectedDPI
      }
    };
  }

  const reportProgress = (base: number, range: number) => (p: number) => { if (onProgress) onProgress(Math.round(base + (p * range))); };
  
  let resultBytes = await performCompressionPass(pdf, numPages, scale, quality, reportProgress(0, 50));
  let strategy = 'First Pass';

  if (!customConfig && resultBytes.byteLength >= file.size) {
    const aggressiveScale = scale * 0.7;
    const aggressiveQuality = Math.max(0.3, quality - 0.2);
    
    if (!ignoreSafety && (aggressiveScale * 72) < 90) {
       strategy = 'Pass 2 Unsafe (Skipped)';
    } else {
      const pass2Bytes = await performCompressionPass(pdf, numPages, aggressiveScale, aggressiveQuality, reportProgress(50, 50));
      if (pass2Bytes.byteLength < file.size) {
        resultBytes = pass2Bytes;
        scale = aggressiveScale;
        quality = aggressiveQuality;
        strategy = 'Adaptive Fallback';
      } else {
        strategy = 'No Reduction Possible';
        resultBytes = new Uint8Array(arrayBuffer);
      }
    }
  } else if (!customConfig && level === 'extreme' && resultBytes.byteLength > file.size * 0.8) {
    const squeezeScale = scale * 0.8;
    if (ignoreSafety || (squeezeScale * 72) >= 90) {
      const pass2Bytes = await performCompressionPass(pdf, numPages, squeezeScale, quality, reportProgress(50, 50));
      if (pass2Bytes.byteLength < resultBytes.byteLength) {
         resultBytes = pass2Bytes;
         scale = squeezeScale;
         strategy = 'Adaptive Squeeze';
      }
    }
  }

  if (resultBytes.byteLength >= file.size) {
    return { 
      data: new Uint8Array(arrayBuffer), 
      status: 'success',
      meta: { 
        originalSize: file.size, 
        compressedSize: file.size, 
        effectiveScale: 0, 
        effectiveQuality: 0, 
        iterations: 2, 
        strategyUsed: 'Aborted (Safety Lock)',
        projectedDPI: Math.round(scale * 72)
      } 
    };
  }

  return { 
    data: resultBytes, 
    status: 'success',
    meta: { 
      originalSize: file.size, 
      compressedSize: resultBytes.byteLength, 
      effectiveScale: Number(scale.toFixed(2)), 
      effectiveQuality: Number(quality.toFixed(2)), 
      iterations: strategy.includes('Pass') ? 1 : 2, 
      strategyUsed: strategy,
      projectedDPI: Math.round(scale * 72)
    } 
  };
};

export const calculateProjectedFileSize = (
  page1DataUrl: string,
  pageCount: number,
  originalFileSize: number,
  isTextHeavy: boolean
): number => {
  const head = 'data:image/jpeg;base64,';
  const rawBytes = Math.floor((page1DataUrl.length - head.length) * 0.75);
  const totalImageSize = rawBytes * pageCount;
  const overhead = (2048 * pageCount) + 5120;
  const estimatedRasterSize = totalImageSize + overhead;
  
  if (estimatedRasterSize >= originalFileSize) {
    return originalFileSize;
  }
  return Math.min(Math.floor(estimatedRasterSize * 1.05), originalFileSize);
};

export const generatePreviewPair = async (file: File, config: AdaptiveConfig): Promise<{ 
  original: string; 
  compressed: string;
  metrics: { 
    originalBytes: number; 
    compressedBytes: number;
    estimatedTotalSize: number;
  };
}> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const page = await pdf.getPage(1);

  const originalScale = 1.5;
  const viewportOrig = page.getViewport({ scale: originalScale });
  const canvasOrig = document.createElement('canvas');
  const ctxOrig = canvasOrig.getContext('2d');
  if (!ctxOrig) throw new Error('Canvas context missing');
  canvasOrig.width = viewportOrig.width;
  canvasOrig.height = viewportOrig.height;
  
  // Force opaque white background for preview rendering
  ctxOrig.fillStyle = '#ffffff';
  ctxOrig.fillRect(0, 0, canvasOrig.width, canvasOrig.height);
  
  await page.render({ canvasContext: ctxOrig, viewport: viewportOrig }).promise;
  const originalData = canvasOrig.toDataURL('image/jpeg', 0.9);

  const viewportComp = page.getViewport({ scale: config.scale });
  const canvasComp = document.createElement('canvas');
  const ctxComp = canvasComp.getContext('2d');
  if (!ctxComp) throw new Error('Canvas context missing');
  canvasComp.width = viewportComp.width;
  canvasComp.height = viewportComp.height;
  
  // Force opaque white background for compressed rendering
  ctxComp.fillStyle = '#ffffff';
  ctxComp.fillRect(0, 0, canvasComp.width, canvasComp.height);

  await page.render({ canvasContext: ctxComp, viewport: viewportComp }).promise;
  
  const compressedData = canvasComp.toDataURL('image/jpeg', config.quality);

  const estimatedTotalSize = calculateProjectedFileSize(
    compressedData,
    numPages,
    file.size,
    false 
  );

  const originalBytes = Math.floor((originalData.length - 22) * 0.75); 
  const compressedBytes = Math.floor((compressedData.length - 22) * 0.75);

  return { 
    original: originalData, 
    compressed: compressedData,
    metrics: { originalBytes, compressedBytes, estimatedTotalSize }
  };
};