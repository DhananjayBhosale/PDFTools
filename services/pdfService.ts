
import { PDFDocument, rgb, degrees, StandardFonts, PDFFont } from 'pdf-lib';
import JSZip from 'jszip';
import { PDFMetadata } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// Fix for ESM import of pdfjs-dist
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configure Worker
if (typeof window !== 'undefined') {
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
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

const getSafeBuffer = (buffer: ArrayBuffer): Uint8Array => {
  return new Uint8Array(buffer).slice(0);
};

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
  const maxPages = Math.min(numPages, 50);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    previews.push(canvas.toDataURL('image/jpeg', 0.8));
  }
  return previews;
};

// --- PDF to Image Rendering ---

export interface ImageExportConfig {
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number; // 0 to 1
  scale: number; // 1 = 72dpi, 2 = 144dpi, etc.
}

export const renderPageAsImage = async (
  pdfDoc: any, 
  pageIndex: number, 
  config: ImageExportConfig
): Promise<{ dataUrl: string; width: number; height: number; sizeBytes: number }> => {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: config.scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');
  
  // White background for transparency handling in JPEGs
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  await page.render({ canvasContext: ctx, viewport }).promise;
  
  const dataUrl = canvas.toDataURL(config.format, config.quality);
  
  // Estimate size (Base64 length * 0.75)
  const head = `data:${config.format};base64,`;
  const sizeBytes = Math.round((dataUrl.length - head.length) * 0.75);

  return { dataUrl, width: canvas.width, height: canvas.height, sizeBytes };
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

export const createPDFFromImages = async (
  files: File[], 
  layout: { fit: 'contain' | 'cover' | 'fill', margin: number } = { fit: 'contain', margin: 0 }
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  
  for (const file of files) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    let image;
    
    try {
      if (file.type === 'image/jpeg') {
        image = await pdfDoc.embedJpg(arrayBuffer);
      } else if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(arrayBuffer);
      } else {
        continue;
      }
    } catch (e) {
      console.warn(`Skipping invalid image: ${file.name}`);
      continue;
    }

    // A4 Dimensions (Points)
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    
    const { width, height } = image.scale(1);
    const availableWidth = pageWidth - (layout.margin * 2);
    const availableHeight = pageHeight - (layout.margin * 2);

    // Calculate dimensions based on layout preference
    // Defaulting to "fit within A4" logic for simple reordering flow
    const scale = Math.min(availableWidth / width, availableHeight / height);
    const displayWidth = width * scale;
    const displayHeight = height * scale;

    const x = (pageWidth - displayWidth) / 2;
    const y = (pageHeight - displayHeight) / 2;

    page.drawImage(image, {
      x,
      y,
      width: displayWidth,
      height: displayHeight
    });
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

export const flattenPDF = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const form = pdfDoc.getForm();
  form.flatten();
  return pdfDoc.save();
};

export const unlockPDF = async (file: File, password: string): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
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

// --- NEW ANNOTATION / OVERLAY EDITING LOGIC ---

export interface EditorElement {
  id: string;
  type: 'text' | 'image';
  pageIndex: number;
  x: number; // Percentage 0-1 relative to page width
  y: number; // Percentage 0-1 relative to page height
  width?: number; // Percentage 0-1
  height?: number; // Percentage 0-1
  rotation?: number; // Degrees
  content: string; // Text string or DataURL
  // Text specific styles
  fontSize?: number; // pt (approx) - We might need to map this carefully
  color?: string; // Hex
  fontFamily?: string;
}

export const savePDFWithAnnotations = async (file: File, elements: EditorElement[]): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  // Load Standard Fonts
  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  for (const el of elements) {
    if (el.pageIndex < 0 || el.pageIndex >= pages.length) continue;
    const page = pages[el.pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Coordinate Conversion (UI % -> PDF Points)
    // PDF origin is Bottom-Left. UI origin is Top-Left.
    const pdfX = el.x * pageWidth;
    const pdfY = pageHeight - (el.y * pageHeight); // Invert Y

    if (el.type === 'image') {
       try {
         let image;
         if (el.content.startsWith('data:image/png')) image = await pdfDoc.embedPng(el.content);
         else image = await pdfDoc.embedJpg(el.content);

         const w = (el.width || 0.2) * pageWidth;
         const h = (el.height || 0.2) * pageHeight;
         
         // pdfY is the top-left of the image in UI terms, but drawImage takes bottom-left usually?
         // No, pdf-lib drawImage x/y is the bottom-left corner of the image.
         // In UI, (x,y) is Top-Left. 
         // So if UI Y is 0.2 (20% down), PDF Y is 80% up.
         // If we draw at 80% up, the image extends UP from there? No, standard is it extends up and right.
         // So we need to subtract height from pdfY to get the bottom-left corner.
         
         page.drawImage(image, {
           x: pdfX,
           y: pdfY - h, // Shift down by height to position top-left at pdfY
           width: w,
           height: h,
           rotate: degrees(el.rotation || 0),
         });
       } catch (e) {
         console.warn("Failed to embed image", e);
       }
    } else if (el.type === 'text') {
       const font = fonts[el.fontFamily as keyof typeof fonts] || fonts.Helvetica;
       const size = el.fontSize || 12;
       
       // Handle multiline
       const lines = el.content.split('\n');
       const lineHeight = size * 1.2;
       
       // Draw each line
       lines.forEach((line, i) => {
         page.drawText(line, {
           x: pdfX,
           y: pdfY - (size) - (i * lineHeight), // Adjust for baseline roughly
           size: size,
           font: font,
           color: el.color ? hexToRgb(el.color) : rgb(0, 0, 0),
           rotate: degrees(el.rotation || 0),
         });
       });
    }
  }

  return pdfDoc.save();
};

// --- COMPRESSION SERVICE ---

export type CompressionLevel = 'extreme' | 'recommended' | 'less';

export interface AdaptiveConfig {
  scale: number;
  quality: number;
  projectedDPI: number;
}

export const getAdaptiveConfig = (level: CompressionLevel, isTextHeavy: boolean): AdaptiveConfig => {
  if (level === 'extreme') {
    return {
      scale: isTextHeavy ? 1.0 : 0.6, 
      quality: 0.5,
      projectedDPI: isTextHeavy ? 72 : 43
    };
  } else if (level === 'less') {
    return {
      scale: 2.0,
      quality: 0.9,
      projectedDPI: 144
    };
  } else {
    // Recommended
    return {
      scale: isTextHeavy ? 1.5 : 1.0,
      quality: 0.7,
      projectedDPI: isTextHeavy ? 108 : 72
    };
  }
};

export const getInterpolatedConfig = (sliderValue: number, isTextHeavy: boolean): AdaptiveConfig => {
  const minScale = 0.5;
  const maxScale = 2.5;
  const scale = minScale + (sliderValue / 100) * (maxScale - minScale);
  const quality = 0.3 + (sliderValue / 100) * 0.7;
  return {
    scale,
    quality,
    projectedDPI: Math.round(scale * 72)
  };
};

export const calculateTargetSize = (originalSize: number, level: CompressionLevel, isTextHeavy: boolean): number => {
  const factors = {
    extreme: isTextHeavy ? 0.4 : 0.2,
    recommended: isTextHeavy ? 0.7 : 0.5,
    less: 0.9
  };
  return Math.round(originalSize * factors[level]);
};

export const generatePreviewPair = async (file: File, config: AdaptiveConfig): Promise<{ original: string; compressed: string; metrics: { estimatedTotalSize: number } }> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  
  const viewportOrig = page.getViewport({ scale: 2.0 });
  const canvasOrig = document.createElement('canvas');
  canvasOrig.width = viewportOrig.width;
  canvasOrig.height = viewportOrig.height;
  const ctxOrig = canvasOrig.getContext('2d');
  if(ctxOrig) {
      ctxOrig.fillStyle = '#ffffff';
      ctxOrig.fillRect(0,0, canvasOrig.width, canvasOrig.height);
      await page.render({ canvasContext: ctxOrig, viewport: viewportOrig }).promise;
  }
  const originalUrl = canvasOrig.toDataURL('image/png');

  const viewportComp = page.getViewport({ scale: config.scale });
  const canvasComp = document.createElement('canvas');
  canvasComp.width = viewportComp.width;
  canvasComp.height = viewportComp.height;
  const ctxComp = canvasComp.getContext('2d');
  if(ctxComp) {
      ctxComp.fillStyle = '#ffffff';
      ctxComp.fillRect(0,0, canvasComp.width, canvasComp.height);
      await page.render({ canvasContext: ctxComp, viewport: viewportComp }).promise;
  }
  
  const compressedUrl = canvasComp.toDataURL('image/jpeg', config.quality);
  const pageSizeBytes = (compressedUrl.length - 22) * 0.75; 
  const estimatedTotalSize = pageSizeBytes * pdf.numPages;

  return {
    original: originalUrl,
    compressed: compressedUrl,
    metrics: { estimatedTotalSize }
  };
};

export const compressPDFAdaptive = async (
  file: File, 
  level: CompressionLevel, 
  onProgress: (p: number) => void,
  overrideSafety: boolean = false,
  customConfig?: AdaptiveConfig
): Promise<{ status: 'success' | 'blocked'; data: Uint8Array; meta: { compressedSize: number; projectedDPI: number; strategyUsed: string } }> => {
  
  const analysis = await analyzePDF(file);
  const config = customConfig || getAdaptiveConfig(level, analysis.isTextHeavy);

  if (!overrideSafety && config.projectedDPI < 70 && analysis.isTextHeavy) {
     if (level === 'extreme') return { status: 'blocked', data: new Uint8Array(0), meta: { compressedSize: 0, projectedDPI: 0, strategyUsed: '' } };
  }

  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjs.getDocument(getSafeBuffer(arrayBuffer));
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const newPdfDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: config.scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) continue;
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const imgDataUrl = canvas.toDataURL('image/jpeg', config.quality);
    const embeddedImage = await newPdfDoc.embedJpg(imgDataUrl);
    const originalViewport = page.getViewport({ scale: 1.0 });
    
    const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: originalViewport.width,
      height: originalViewport.height,
    });
    
    onProgress(Math.round((i / numPages) * 90));
  }

  const pdfBytes = await newPdfDoc.save();
  onProgress(100);

  return {
    status: 'success',
    data: pdfBytes,
    meta: {
      compressedSize: pdfBytes.byteLength,
      projectedDPI: config.projectedDPI,
      strategyUsed: `Rasterization (Scale ${config.scale.toFixed(1)}, Q${config.quality.toFixed(1)})`
    }
  };
};

// --- SIGNATURE SUPPORT ---
export interface SignaturePlacement {
  id: string;
  pageIndex: number;
  dataUrl: string; 
  x: number; 
  y: number; 
  width: number; 
  aspectRatio: number; 
}

export const applySignaturesToPDF = async (file: File, signatures: SignaturePlacement[]): Promise<Uint8Array> => {
  const elements: EditorElement[] = signatures.map(s => ({
    id: s.id,
    type: 'image',
    pageIndex: s.pageIndex,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.width / s.aspectRatio,
    content: s.dataUrl
  }));
  return savePDFWithAnnotations(file, elements);
};
