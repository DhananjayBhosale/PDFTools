import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { PDFDocument } from 'pdf-lib';
import { canvasToBlob, getSafeBuffer, readFileAsArrayBuffer } from './pdfShared';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

const fileBufferCache = new WeakMap<File, Promise<ArrayBuffer>>();
const pdfDocumentCache = new WeakMap<File, Promise<any>>();

const getFileBuffer = (file: File) => {
  const cached = fileBufferCache.get(file);
  if (cached) return cached;

  const next = readFileAsArrayBuffer(file).catch((error) => {
    fileBufferCache.delete(file);
    throw error;
  });

  fileBufferCache.set(file, next);
  return next;
};

const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const mapWithConcurrency = async <T>(
  total: number,
  concurrency: number,
  mapper: (index: number) => Promise<T>,
) => {
  const results = new Array<T>(total);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= total) {
        return;
      }

      results[currentIndex] = await mapper(currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

const renderPageToBlob = async (
  page: any,
  scale: number,
  format: ImageExportConfig['format'] | 'image/jpeg',
  quality: number,
) => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context failed');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;
  const blob = await canvasToBlob(canvas, format, quality);

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  };
};

export const loadPDFDocument = async (file: File) => {
  const cached = pdfDocumentCache.get(file);
  if (cached) return cached;

  const next = (async () => {
    const arrayBuffer = await getFileBuffer(file);
    const doc = await pdfjs.getDocument(getSafeBuffer(arrayBuffer)).promise;

    if (typeof doc?.destroy === 'function') {
      const originalDestroy = doc.destroy.bind(doc);
      doc.destroy = async (...args: unknown[]) => {
        pdfDocumentCache.delete(file);
        return originalDestroy(...args);
      };
    }

    return doc;
  })().catch((error) => {
    pdfDocumentCache.delete(file);
    throw error;
  });

  pdfDocumentCache.set(file, next);
  return next;
};

export const loadProtectedPDFDocument = async (file: File, password: string) => {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error('Password is required');
  }

  const arrayBuffer = await getFileBuffer(file);
  return pdfjs.getDocument({
    data: getSafeBuffer(arrayBuffer),
    password: normalizedPassword,
  }).promise;
};

export const analyzePDF = async (file: File): Promise<{ isTextHeavy: boolean; pageCount: number }> => {
  try {
    const pdf = await loadPDFDocument(file);
    const numPages = pdf.numPages;
    const maxPagesToCheck = Math.min(numPages, 3);
    let totalTextItems = 0;

    for (let i = 1; i <= maxPagesToCheck; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      totalTextItems += textContent.items.length;
    }

    const avgTextItems = totalTextItems / maxPagesToCheck;
    return {
      isTextHeavy: avgTextItems > 20,
      pageCount: numPages,
    };
  } catch (error) {
    console.error('Analysis failed', error);
    return { isTextHeavy: false, pageCount: 0 };
  }
};

export const getPdfPagePreviews = async (
  file: File,
  options?: { limit?: number; scale?: number },
): Promise<string[]> => {
  const pdf = await loadPDFDocument(file);
  const pageLimit = options?.limit ? Math.min(pdf.numPages, options.limit) : pdf.numPages;
  const scale = options?.scale ?? 0.3;
  const previews: string[] = [];

  for (let index = 0; index < pageLimit; index += 1) {
    const page = await pdf.getPage(index + 1);
    const { blob } = await renderPageToBlob(page, scale, 'image/jpeg', 0.7);
    previews.push(URL.createObjectURL(blob));

    if ((index + 1) % 4 === 0) {
      await nextFrame();
    }
  }

  return previews;
};

export interface ImageExportConfig {
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number;
  scale: number;
}

export interface EmbeddedPdfImageAsset {
  id: string;
  objectUrl: string;
  blob: Blob;
  width: number;
  height: number;
  byteSize: number;
  pageNumbers: number[];
  source: 'xobject' | 'inline';
}

export interface PageSelectableTextLine {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const groupPositionedTextItems = (
  items: Array<{
    text: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
    height: number;
    centerY: number;
  }>,
): PageSelectableTextLine[] => {
  const lines: Array<{
    items: Array<{
      text: string;
      left: number;
      top: number;
      right: number;
      bottom: number;
      height: number;
      centerY: number;
    }>;
    centerY: number;
    height: number;
  }> = [];

  items.forEach((item) => {
    const currentLine = lines[lines.length - 1];
    const threshold = currentLine ? Math.max(currentLine.height, item.height) * 0.6 : 0;

    if (!currentLine || Math.abs(item.centerY - currentLine.centerY) > threshold) {
      lines.push({
        items: [item],
        centerY: item.centerY,
        height: item.height,
      });
      return;
    }

    currentLine.items.push(item);
    currentLine.centerY = (currentLine.centerY * (currentLine.items.length - 1) + item.centerY) / currentLine.items.length;
    currentLine.height = Math.max(currentLine.height, item.height);
  });

  return lines
    .map((line) => {
      const orderedItems = [...line.items].sort((a, b) => a.left - b.left);
      const left = Math.min(...orderedItems.map((item) => item.left));
      const top = Math.min(...orderedItems.map((item) => item.top));
      const right = Math.max(...orderedItems.map((item) => item.right));
      const bottom = Math.max(...orderedItems.map((item) => item.bottom));

      let text = '';
      let lastRight = orderedItems[0]?.left ?? 0;

      orderedItems.forEach((item) => {
        const gap = item.left - lastRight;
        if (text && gap > Math.max(item.height * 0.25, 3)) {
          text += ' ';
        }
        text += item.text;
        lastRight = Math.max(lastRight, item.right);
      });

      return {
        text: text.replace(/\s+/g, ' ').trim(),
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      };
    })
    .filter((line) => line.text);
};

export const getPageSelectableTextLines = async (
  pdfDoc: any,
  pageIndex: number,
  scale = 1,
): Promise<PageSelectableTextLine[]> => {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();

  const positionedItems = textContent.items
    .map((item: any) => {
      const text = typeof item.str === 'string' ? item.str.replace(/\s+/g, ' ').trim() : '';
      if (!text) return null;

      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.max(1, Math.hypot(tx[2], tx[3]) || (item.height || 0) * scale || 12);
      const width = Math.max(1, (item.width || 0) * scale);
      const left = tx[4];
      const top = tx[5] - fontHeight;

      return {
        text,
        left,
        top,
        right: left + width,
        bottom: top + fontHeight,
        height: fontHeight,
        centerY: top + fontHeight / 2,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const verticalDelta = a.top - b.top;
      if (Math.abs(verticalDelta) <= Math.max(a.height, b.height) * 0.5) {
        return a.left - b.left;
      }
      return verticalDelta;
    });

  return groupPositionedTextItems(positionedItems);
};

export const renderPageAsImage = async (
  pdfDoc: any,
  pageIndex: number,
  config: ImageExportConfig,
): Promise<{ objectUrl: string; blob: Blob; width: number; height: number; sizeBytes: number }> => {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const { blob, width, height } = await renderPageToBlob(page, config.scale, config.format, config.quality);
  const objectUrl = URL.createObjectURL(blob);

  return {
    objectUrl,
    blob,
    width,
    height,
    sizeBytes: blob.size,
  };
};

const hashUint8 = (bytes: Uint8Array) => {
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const waitForPdfObject = (pool: any, objectId: string) =>
  new Promise<any>((resolve, reject) => {
    try {
      if (pool.has(objectId)) {
        resolve(pool.get(objectId));
        return;
      }
      pool.get(objectId, resolve);
    } catch (error) {
      reject(error);
    }
  });

const toRgbaPixels = (image: any) => {
  const width = image.width || 0;
  const height = image.height || 0;
  const data = image.data;
  if (!width || !height || !(data instanceof Uint8Array)) {
    throw new Error('Unsupported embedded image payload');
  }

  if (image.kind === pdfjs.ImageKind.RGBA_32BPP) {
    return new Uint8ClampedArray(data);
  }

  if (image.kind === pdfjs.ImageKind.RGB_24BPP) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let src = 0, dest = 0; src < data.length; src += 3, dest += 4) {
      rgba[dest] = data[src];
      rgba[dest + 1] = data[src + 1];
      rgba[dest + 2] = data[src + 2];
      rgba[dest + 3] = 255;
    }
    return rgba;
  }

  if (image.kind === pdfjs.ImageKind.GRAYSCALE_1BPP) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    const stride = Math.ceil(width / 8);
    let dest = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = data[y * stride + (x >> 3)];
        const bit = (byte >> (7 - (x & 7))) & 1;
        const value = bit ? 0 : 255;
        rgba[dest] = value;
        rgba[dest + 1] = value;
        rgba[dest + 2] = value;
        rgba[dest + 3] = 255;
        dest += 4;
      }
    }
    return rgba;
  }

  throw new Error(`Unsupported embedded image kind: ${String(image.kind)}`);
};

const exportEmbeddedImageAsPng = async (image: any) => {
  if (image?.bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context failed');
    }
    context.drawImage(image.bitmap, 0, 0);
    const blob = await canvasToBlob(canvas, 'image/png');
    return { blob, width: canvas.width, height: canvas.height };
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context failed');
  }

  const rgba = toRgbaPixels(image);
  const imageData = context.createImageData(canvas.width, canvas.height);
  imageData.data.set(rgba);
  context.putImageData(imageData, 0, 0);
  const blob = await canvasToBlob(canvas, 'image/png');

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  };
};

export const extractEmbeddedImagesFromPDF = async (
  pdfDoc: any,
  options?: { onProgress?: (currentPage: number, totalPages: number) => void },
): Promise<EmbeddedPdfImageAsset[]> => {
  const imagesByHash = new Map<string, EmbeddedPdfImageAsset>();
  const totalPages = pdfDoc.numPages || 0;

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    options?.onProgress?.(pageIndex + 1, totalPages);

    const page = await pdfDoc.getPage(pageIndex + 1);
    const operatorList = await page.getOperatorList();
    const pageImageRefs = new Set<string>();

    for (let opIndex = 0; opIndex < operatorList.fnArray.length; opIndex += 1) {
      const fn = operatorList.fnArray[opIndex];
      const args = operatorList.argsArray[opIndex];

      if (
        fn !== pdfjs.OPS.paintImageXObject &&
        fn !== pdfjs.OPS.paintImageXObjectRepeat &&
        fn !== pdfjs.OPS.paintInlineImageXObject &&
        fn !== pdfjs.OPS.paintInlineImageXObjectGroup
      ) {
        continue;
      }

      const source = fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintImageXObjectRepeat ? 'xobject' : 'inline';
      const refKey = source === 'xobject' ? String(args[0]) : `inline-${pageIndex}-${opIndex}`;

      if (pageImageRefs.has(refKey)) {
        continue;
      }
      pageImageRefs.add(refKey);

      let imageObject: any = null;
      try {
        if (source === 'xobject') {
          const objectId = String(args[0]);
          const pool = objectId.startsWith('g_') ? page.commonObjs : page.objs;
          imageObject = await waitForPdfObject(pool, objectId);
        } else {
          imageObject = args[0];
        }
      } catch (error) {
        console.error('Failed to resolve embedded image', error);
        continue;
      }

      if (!imageObject?.width || !imageObject?.height) {
        continue;
      }

      try {
        const { blob, width, height } = await exportEmbeddedImageAsPng(imageObject);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const imageHash = `${width}x${height}-${hashUint8(bytes)}`;
        const existing = imagesByHash.get(imageHash);

        if (existing) {
          if (!existing.pageNumbers.includes(pageIndex + 1)) {
            existing.pageNumbers.push(pageIndex + 1);
            existing.pageNumbers.sort((a, b) => a - b);
          }
          continue;
        }

        const objectUrl = URL.createObjectURL(blob);
        imagesByHash.set(imageHash, {
          id: imageHash,
          objectUrl,
          blob,
          width,
          height,
          byteSize: blob.size,
          pageNumbers: [pageIndex + 1],
          source,
        });
      } catch (error) {
        console.error('Failed to export embedded image', error);
      }
    }

    if ((pageIndex + 1) % 2 === 0) {
      await nextFrame();
    }
  }

  return Array.from(imagesByHash.values()).sort((left, right) => {
    const pageDelta = (left.pageNumbers[0] || 0) - (right.pageNumbers[0] || 0);
    if (pageDelta !== 0) return pageDelta;
    return right.byteSize - left.byteSize;
  });
};

export const extractTextFromPDF = async (file: File): Promise<string> => {
  const pdf = await loadPDFDocument(file);
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
};

export const getFirstPageTextSignature = async (file: File, maxChars = 500): Promise<string> => {
  const pdf = await loadPDFDocument(file);
  if (pdf.numPages <= 0) return '';
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items
    .map((item: any) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxChars);
};

export const getPageTextSignatures = async (
  file: File,
  options?: { maxPages?: number; maxCharsPerPage?: number },
): Promise<string[]> => {
  const pdf = await loadPDFDocument(file);
  const maxChars = options?.maxCharsPerPage ?? 500;
  const totalPages = options?.maxPages
    ? Math.min(pdf.numPages, Math.max(1, options.maxPages))
    : pdf.numPages;
  const signatures: string[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
    signatures.push(text);
  }

  return signatures;
};

export type CompressionLevel = 'extreme' | 'recommended' | 'less';

export interface AdaptiveConfig {
  scale: number;
  quality: number;
  projectedDPI: number;
}

export const getAdaptiveConfig = (level: CompressionLevel, isTextHeavy: boolean): AdaptiveConfig => {
  const dpiMap = {
    extreme: 72,
    recommended: 144,
    less: 200,
  };

  const targetDPI = isTextHeavy ? Math.max(dpiMap[level], 96) : dpiMap[level];
  const scale = Math.min(1.0, targetDPI / 144);
  const baseQuality = level === 'extreme' ? 0.5 : level === 'recommended' ? 0.75 : 0.9;
  const quality = isTextHeavy ? Math.min(0.95, baseQuality + 0.08) : baseQuality;

  return {
    scale,
    quality,
    projectedDPI: targetDPI,
  };
};

export const getInterpolatedConfig = (sliderValue: number, isTextHeavy: boolean): AdaptiveConfig => {
  const minDPI = isTextHeavy ? 96 : 72;
  const maxDPI = 300;
  const dpi = minDPI + (sliderValue / 100) * (maxDPI - minDPI);

  return {
    scale: Math.min(1.0, dpi / 144),
    quality: 0.5 + (sliderValue / 200),
    projectedDPI: Math.round(dpi),
  };
};

export const calculateTargetSize = (originalSize: number, level: CompressionLevel, isTextHeavy: boolean): number => {
  const baseRatio = level === 'extreme' ? 0.3 : level === 'recommended' ? 0.6 : 0.9;
  const ratio = isTextHeavy ? Math.min(0.95, baseRatio + 0.12) : baseRatio;
  return Math.round(originalSize * ratio);
};

export const generatePreviewPair = async (
  file: File,
  config: AdaptiveConfig,
  options?: { pageIndex?: number },
) => {
  const pdf = await loadPDFDocument(file);
  const pageCount = Math.max(1, pdf.numPages || 1);
  const requestedPageIndex = Number.isFinite(options?.pageIndex)
    ? Math.floor(options?.pageIndex || 0)
    : 0;
  const pageIndex = Math.max(0, Math.min(pageCount - 1, requestedPageIndex));
  const page = await pdf.getPage(pageIndex + 1);

  const originalImage = await (async () => {
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Preview render failed');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  })();

  const compressedImage = await (async () => {
    const viewport = page.getViewport({ scale: config.scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Preview render failed');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', config.quality);
  })();

  const estimatedTotalSize = Math.round(file.size * (compressedImage.length / originalImage.length));

  return {
    original: originalImage,
    compressed: compressedImage,
    metrics: { estimatedTotalSize },
    pageCount,
    pageIndex,
  };
};

export const compressPDFAdaptive = async (
  file: File,
  level: CompressionLevel,
  onProgress: (p: number) => void,
  overrideSafety = false,
  customConfig?: AdaptiveConfig,
  flatten = true,
  isTextHeavy = false,
) => {
  const config = customConfig || getAdaptiveConfig(level, isTextHeavy);

  if (!overrideSafety && config.projectedDPI < 72 && flatten) {
    return {
      data: new Uint8Array(0),
      meta: {
        compressedSize: 0,
        projectedDPI: config.projectedDPI,
        strategyUsed: 'Blocked (Low DPI)',
      },
      status: 'blocked' as const,
    };
  }

  const arrayBuffer = await readFileAsArrayBuffer(file);

  if (!flatten) {
    onProgress(50);
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const saved = await pdfDoc.save({ useObjectStreams: false });
    onProgress(100);
    return {
      data: saved,
      meta: {
        compressedSize: saved.byteLength,
        projectedDPI: 300,
        strategyUsed: 'Basic Optimization (No Flattening)',
      },
      status: 'success' as const,
    };
  }

  const pdf = await loadPDFDocument(file);
  const numPages = pdf.numPages;
  const newPdf = await PDFDocument.create();
  let completedPages = 0;

  const renderedPages = await mapWithConcurrency(numPages, 2, async (index) => {
    const page = await pdf.getPage(index + 1);
    const originalViewport = page.getViewport({ scale: 1.0 });
    const { blob } = await renderPageToBlob(page, config.scale * 1.5, 'image/jpeg', config.quality);
    completedPages += 1;
    onProgress((completedPages / numPages) * 90);

    return {
      imageBytes: await blob.arrayBuffer(),
      width: originalViewport.width,
      height: originalViewport.height,
    };
  });

  for (const renderedPage of renderedPages) {
    const embed = await newPdf.embedJpg(renderedPage.imageBytes);
    const outputPage = newPdf.addPage([renderedPage.width, renderedPage.height]);
    outputPage.drawImage(embed, {
      x: 0,
      y: 0,
      width: renderedPage.width,
      height: renderedPage.height,
    });
  }

  const saved = await newPdf.save();
  return {
    data: saved,
    meta: {
      compressedSize: saved.byteLength,
      projectedDPI: config.projectedDPI,
      strategyUsed: 'Adaptive Rasterization',
    },
    status: 'success' as const,
  };
};
