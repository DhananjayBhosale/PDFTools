import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  rgb,
  degrees,
  StandardFonts,
} from 'pdf-lib';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import type { PDFMetadata } from '../types';
import type { PdfFormFieldValue } from './pdfBrowser';
import { loadPDFDocument, loadProtectedPDFDocument, renderPageAsImage } from './pdfBrowser';
import { readFileAsArrayBuffer, revokeObjectUrl } from './pdfShared';

const pageCountCache = new WeakMap<File, Promise<number>>();

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
  layout: { fit: 'contain' | 'cover' | 'fill'; margin: number } = { fit: 'contain', margin: 0 },
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    let image;

    try {
      if (file.type === 'image/jpeg') image = await pdfDoc.embedJpg(arrayBuffer);
      else if (file.type === 'image/png') image = await pdfDoc.embedPng(arrayBuffer);
      else continue;
    } catch {
      continue;
    }

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const { width, height } = image.scale(1);
    const availableWidth = pageWidth - layout.margin * 2;
    const availableHeight = pageHeight - layout.margin * 2;
    const scale = Math.min(availableWidth / width, availableHeight / height);
    const displayWidth = width * scale;
    const displayHeight = height * scale;

    page.drawImage(image, {
      x: (pageWidth - displayWidth) / 2,
      y: (pageHeight - displayHeight) / 2,
      width: displayWidth,
      height: displayHeight,
    });
  }

  return pdfDoc.save();
};

export interface PDFPageLayout {
  width: number;
  height: number;
  elements: PDFImageElement[];
}

export interface PDFImageElement {
  file: File;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const createPDFFromLayout = async (pages: PDFPageLayout[]): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  const imageCache = new WeakMap<File, Promise<any>>();

  const loadEmbeddedImage = async (file: File) => {
    const cached = imageCache.get(file);
    if (cached) return cached;

    const promise = (async () => {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      if (file.type === 'image/jpeg') return pdfDoc.embedJpg(arrayBuffer);
      if (file.type === 'image/png') return pdfDoc.embedPng(arrayBuffer);
      throw new Error(`Unsupported image type: ${file.type}`);
    })();

    imageCache.set(file, promise);
    return promise;
  };

  for (const layout of pages) {
    const page = pdfDoc.addPage([
      layout.width > 0 ? layout.width : 595.28,
      layout.height > 0 ? layout.height : 841.89,
    ]);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    for (const element of layout.elements) {
      try {
        const image = await loadEmbeddedImage(element.file);
        const pdfX = element.x * pageWidth;
        const pdfY = pageHeight - element.y * pageHeight;
        const pdfW = element.width * pageWidth;
        const pdfH = element.height * pageHeight;

        page.drawImage(image, {
          x: pdfX,
          y: pdfY - pdfH,
          width: pdfW,
          height: pdfH,
        });
      } catch (error) {
        console.error('Failed to embed image', error);
      }
    }
  }

  return pdfDoc.save();
};

export const splitPDF = async (file: File): Promise<Blob> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const zip = new JSZip();

  for (let i = 0; i < pdfDoc.getPageCount(); i += 1) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(page);
    zip.file(`${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`, await newPdf.save());
  }

  return zip.generateAsync({ type: 'blob' });
};

export const splitPDFByPagesPerFile = async (
  file: File,
  pagesPerFile: number,
  selectedPageIndices: number[] = [],
): Promise<Blob> => {
  const sanitizedPagesPerFile = Math.max(1, Math.floor(pagesPerFile || 1));
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const zip = new JSZip();
  const totalPages = pdfDoc.getPageCount();
  const normalizedSelection = selectedPageIndices
    .filter((index) => Number.isInteger(index) && index >= 0 && index < totalPages)
    .sort((a, b) => a - b);
  const exportIndices = normalizedSelection.length > 0
    ? Array.from(new Set(normalizedSelection))
    : Array.from({ length: totalPages }, (_, index) => index);

  for (let startIndex = 0; startIndex < exportIndices.length; startIndex += sanitizedPagesPerFile) {
    const chunk = exportIndices.slice(startIndex, startIndex + sanitizedPagesPerFile);
    const firstPage = chunk[0] + 1;
    const lastPage = chunk[chunk.length - 1] + 1;
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, chunk);
    copiedPages.forEach((page) => newPdf.addPage(page));
    const partNumber = Math.floor(startIndex / sanitizedPagesPerFile) + 1;
    zip.file(
      `${file.name.replace('.pdf', '')}_part_${partNumber}_pages_${firstPage}-${lastPage}.pdf`,
      await newPdf.save(),
    );
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
  pdfDoc.getPages().forEach((page) => {
    const currentRotation = page.getRotation();
    page.setRotation(degrees(currentRotation.angle + rotation));
  });
  return pdfDoc.save();
};

export const rotateSpecificPages = async (file: File, rotations: { pageIndex: number; rotation: number }[]): Promise<Uint8Array> => {
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
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error('Password is required.');
  }

  const pdfDoc = await loadPDFDocument(file);
  if (pdfDoc.numPages <= 0) {
    throw new Error('PDF has no pages.');
  }

  const firstPage = await pdfDoc.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const firstOrientation = firstViewport.width > firstViewport.height ? 'landscape' : 'portrait';

  const protectedDoc = new jsPDF({
    orientation: firstOrientation,
    unit: 'pt',
    format: [firstViewport.width, firstViewport.height],
    putOnlyUsedFonts: true,
    compress: true,
    encryption: {
      userPassword: normalizedPassword,
      ownerPassword: normalizedPassword,
      userPermissions: ['print'],
    } as any,
  });

  for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex += 1) {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const { objectUrl } = await renderPageAsImage(pdfDoc, pageIndex, {
      format: 'image/jpeg',
      quality: 0.92,
      scale: 1.8,
    });

    try {
      if (pageIndex > 0) {
        const orientation = viewport.width > viewport.height ? 'landscape' : 'portrait';
        protectedDoc.addPage([viewport.width, viewport.height], orientation);
      }

      protectedDoc.addImage(
        objectUrl,
        'JPEG',
        0,
        0,
        viewport.width,
        viewport.height,
        undefined,
        'FAST',
      );
    } finally {
      revokeObjectUrl(objectUrl);
    }
  }

  return new Uint8Array(protectedDoc.output('arraybuffer'));
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
  const cached = pageCountCache.get(file);
  if (cached) return cached;

  const next = (async () => {
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      return pdfDoc.getPageCount();
    } catch (error) {
      console.error('Error counting pages', error);
      return 0;
    }
  })();

  pageCountCache.set(file, next);
  return next;
};

export const flattenPDF = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  pdfDoc.getForm().flatten();
  return pdfDoc.save();
};

export const repairPDF = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true } as any);
  return pdfDoc.save({ useObjectStreams: false });
};

export const removePDFMetadata = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true } as any);
  const cleanedDate = new Date(0);

  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');
  pdfDoc.setCreationDate(cleanedDate);
  pdfDoc.setModificationDate(cleanedDate);

  const catalog = pdfDoc.catalog;
  catalog.delete(PDFName.of('Metadata'));
  catalog.delete(PDFName.of('ViewerPreferences'));
  catalog.delete(PDFName.of('OpenAction'));
  catalog.delete(PDFName.of('AA'));

  return pdfDoc.save();
};

export const removePDFAnnotations = async (file: File): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true } as any);

  for (const page of pdfDoc.getPages()) {
    page.node.delete(PDFName.of('Annots'));
    page.node.delete(PDFName.of('AA'));
  }

  return pdfDoc.save();
};

export const sanitizePDF = async (file: File): Promise<Uint8Array> => {
  const metadataCleaned = await removePDFMetadata(file);
  const intermediate = new File([new Blob([metadataCleaned], { type: 'application/pdf' })], file.name, {
    type: 'application/pdf',
  });
  return removePDFAnnotations(intermediate);
};

export interface CropBoxOptions {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const normalizeCropMargin = (value: number) => Math.max(0, Math.min(40, Number.isFinite(value) ? value : 0));

export const cropPDFMargins = async (file: File, options: CropBoxOptions): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const margins = {
    top: normalizeCropMargin(options.top),
    right: normalizeCropMargin(options.right),
    bottom: normalizeCropMargin(options.bottom),
    left: normalizeCropMargin(options.left),
  };

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const left = width * (margins.left / 100);
    const bottom = height * (margins.bottom / 100);
    const right = width * (margins.right / 100);
    const top = height * (margins.top / 100);
    const cropWidth = Math.max(36, width - left - right);
    const cropHeight = Math.max(36, height - top - bottom);

    page.setCropBox(left, bottom, cropWidth, cropHeight);
  }

  return pdfDoc.save();
};

export interface HeaderFooterOptions {
  headerText: string;
  footerText: string;
  fontSize: number;
  includePageNumbers: boolean;
}

const interpolateHeaderFooterText = (value: string, pageNumber: number, totalPages: number) =>
  value.replaceAll('{n}', String(pageNumber)).replaceAll('{total}', String(totalPages));

export const addHeaderFooterToPDF = async (file: File, options: HeaderFooterOptions): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const fontSize = Math.max(8, Math.min(48, Number.isFinite(options.fontSize) ? options.fontSize : 10));
  const totalPages = pages.length;

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const { width, height } = page.getSize();
    const header = interpolateHeaderFooterText(options.headerText.trim(), pageNumber, totalPages);
    const footerBase = options.footerText.trim();
    const footer = interpolateHeaderFooterText(
      options.includePageNumbers && !footerBase ? 'Page {n} of {total}' : footerBase,
      pageNumber,
      totalPages,
    );

    if (header) {
      const headerWidth = font.widthOfTextAtSize(header, fontSize);
      page.drawText(header, {
        x: Math.max(24, (width - headerWidth) / 2),
        y: height - fontSize - 18,
        size: fontSize,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
    }

    if (footer) {
      const footerWidth = font.widthOfTextAtSize(footer, fontSize);
      page.drawText(footer, {
        x: Math.max(24, (width - footerWidth) / 2),
        y: 18,
        size: fontSize,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
    }
  });

  return pdfDoc.save();
};

const isPageBlank = async (pdfDoc: any, pageIndex: number, threshold: number) => {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 0.18 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas context failed');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let nonWhite = 0;
  const maxDelta = 28;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 20) continue;
    const delta = 255 - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]);
    if (delta > maxDelta) {
      nonWhite += 1;
    }
  }

  return nonWhite / Math.max(1, pixels.length / 4) <= threshold;
};

export const removeBlankPagesFromPDF = async (
  file: File,
  options?: { threshold?: number; onProgress?: (current: number, total: number) => void },
): Promise<{ bytes: Uint8Array; removedPages: number[] }> => {
  const sourceBuffer = await readFileAsArrayBuffer(file);
  const sourcePdf = await PDFDocument.load(sourceBuffer);
  const renderedPdf = await loadPDFDocument(file);
  const totalPages = sourcePdf.getPageCount();
  const threshold = Math.max(0.0001, Math.min(0.02, options?.threshold ?? 0.002));
  const keptIndices: number[] = [];
  const removedPages: number[] = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    options?.onProgress?.(pageIndex + 1, totalPages);
    const blank = await isPageBlank(renderedPdf, pageIndex, threshold);
    if (blank) {
      removedPages.push(pageIndex + 1);
    } else {
      keptIndices.push(pageIndex);
    }
  }

  if (keptIndices.length === 0) {
    throw new Error('All pages look blank. No output was created.');
  }

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, keptIndices);
  copiedPages.forEach((page) => outputPdf.addPage(page));

  return {
    bytes: await outputPdf.save(),
    removedPages,
  };
};

export const unlockPDF = async (file: File, password: string): Promise<Uint8Array> => {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    throw new Error('Password is required.');
  }

  const pdfDoc = await loadProtectedPDFDocument(file, normalizedPassword);
  if (pdfDoc.numPages <= 0) {
    throw new Error('PDF has no pages.');
  }

  const firstPage = await pdfDoc.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  const firstOrientation = firstViewport.width > firstViewport.height ? 'landscape' : 'portrait';

  const unlockedDoc = new jsPDF({
    orientation: firstOrientation,
    unit: 'pt',
    format: [firstViewport.width, firstViewport.height],
    putOnlyUsedFonts: true,
    compress: true,
  });

  try {
    for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex += 1) {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1 });
      const { objectUrl } = await renderPageAsImage(pdfDoc, pageIndex, {
        format: 'image/jpeg',
        quality: 0.92,
        scale: 1.8,
      });

      try {
        if (pageIndex > 0) {
          const orientation = viewport.width > viewport.height ? 'landscape' : 'portrait';
          unlockedDoc.addPage([viewport.width, viewport.height], orientation);
        }

        unlockedDoc.addImage(
          objectUrl,
          'JPEG',
          0,
          0,
          viewport.width,
          viewport.height,
          undefined,
          'FAST',
        );
      } finally {
        revokeObjectUrl(objectUrl);
      }
    }
  } finally {
    if (typeof pdfDoc?.destroy === 'function') {
      await pdfDoc.destroy();
    }
  }

  return new Uint8Array(unlockedDoc.output('arraybuffer'));
};

export interface EditorElement {
  id: string;
  type: 'text' | 'image';
  pageIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  content: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

export const savePDFWithAnnotations = async (
  file: File,
  elements: EditorElement[],
  formValues: Record<string, PdfFormFieldValue> = {},
): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  const fonts = {
    Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    TimesRoman: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    Courier: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  const hexToRgb = (hex: string) => {
    const normalized = hex.trim().replace('#', '');
    const full = normalized.length === 3
      ? normalized.split('').map((char) => `${char}${char}`).join('')
      : normalized;

    if (!/^[0-9a-fA-F]{6}$/.test(full)) {
      return rgb(0, 0, 0);
    }

    return rgb(
      parseInt(full.slice(0, 2), 16) / 255,
      parseInt(full.slice(2, 4), 16) / 255,
      parseInt(full.slice(4, 6), 16) / 255,
    );
  };

  const form = pdfDoc.getForm();
  const fieldsByName = new Map(form.getFields().map((field) => [field.getName(), field]));

  for (const [fieldName, value] of Object.entries(formValues)) {
    const field = fieldsByName.get(fieldName);
    if (!field) continue;

    try {
      if (field instanceof PDFTextField) {
        field.setText(typeof value === 'string' ? value : '');
        continue;
      }

      if (field instanceof PDFCheckBox) {
        value ? field.check() : field.uncheck();
        continue;
      }

      if (field instanceof PDFRadioGroup) {
        if (typeof value === 'string' && value) field.select(value);
        else field.clear();
        continue;
      }

      if (field instanceof PDFDropdown) {
        if (Array.isArray(value)) {
          if (value.length > 0) field.select(field.isMultiselect() ? value : value[0]);
          else field.clear();
        } else if (typeof value === 'string' && value) {
          field.select(value);
        } else {
          field.clear();
        }
        continue;
      }

      if (field instanceof PDFOptionList) {
        if (Array.isArray(value)) {
          if (value.length > 0) field.select(value);
          else field.clear();
        } else if (typeof value === 'string' && value) {
          field.select(value);
        } else {
          field.clear();
        }
      }
    } catch (error) {
      console.warn(`Failed to set form field "${fieldName}"`, error);
    }
  }

  form.updateFieldAppearances(fonts.Helvetica);

  for (const element of elements) {
    if (element.pageIndex < 0 || element.pageIndex >= pages.length) continue;
    const page = pages[element.pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const pdfX = element.x * pageWidth;
    const pdfY = pageHeight - element.y * pageHeight;

    if (element.type === 'image') {
      try {
        const image = element.content.startsWith('data:image/png')
          ? await pdfDoc.embedPng(element.content)
          : await pdfDoc.embedJpg(element.content);
        const width = (element.width || 0.2) * pageWidth;
        const height = (element.height || 0.2) * pageHeight;

        page.drawImage(image, {
          x: pdfX,
          y: pdfY - height,
          width,
          height,
          rotate: degrees(element.rotation || 0),
        });
      } catch (error) {
        console.warn('Failed to embed image', error);
      }
      continue;
    }

    const font = fonts[element.fontFamily as keyof typeof fonts] || fonts.Helvetica;
    const size = element.fontSize || 12;
    const lines = element.content.split('\n');
    const lineHeight = size * 1.2;
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: pdfX,
        y: pdfY - size - index * lineHeight,
        size,
        font,
        color: element.color ? hexToRgb(element.color) : rgb(0, 0, 0),
        rotate: degrees(element.rotation || 0),
      });
    });
  }

  return pdfDoc.save();
};

export interface SignaturePlacement {
  pageIndex: number;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  aspectRatio: number;
}

export const applySignaturesToPDF = async (file: File, signatures: SignaturePlacement[]) => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  for (const signature of signatures) {
    if (signature.pageIndex < 0 || signature.pageIndex >= pdfDoc.getPageCount()) continue;

    const image = signature.dataUrl.startsWith('data:image/png')
      ? await pdfDoc.embedPng(signature.dataUrl)
      : await pdfDoc.embedJpg(signature.dataUrl);

    const page = pdfDoc.getPage(signature.pageIndex);
    const { width, height } = page.getSize();
    const targetW = width * signature.width;
    const targetH = targetW / signature.aspectRatio;

    page.drawImage(image, {
      x: width * signature.x,
      y: height - height * signature.y - targetH,
      width: targetW,
      height: targetH,
    });
  }

  return pdfDoc.save();
};

const parseHexColor = (hex: string) => {
  const normalized = hex.trim().replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return rgb(0, 0, 0);
  }
  return rgb(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  );
};

export interface WatermarkOptions {
  text: string;
  size: number;
  opacity: number;
  rotation: number;
  color: string;
  xPercent?: number;
  yPercent?: number;
}

export const addWatermarkToPDF = async (file: File, options: WatermarkOptions): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const text = options.text.trim();
  const fontSize = Math.max(8, Math.min(160, Number.isFinite(options.size) ? options.size : 48));
  const opacity = Math.max(0.05, Math.min(1, Number.isFinite(options.opacity) ? options.opacity : 0.3));
  const rotation = Number.isFinite(options.rotation) ? options.rotation : -45;
  const color = parseHexColor(options.color);
  const xPercent = Math.max(2, Math.min(98, Number.isFinite(options.xPercent) ? Number(options.xPercent) : 50));
  const yPercent = Math.max(2, Math.min(98, Number.isFinite(options.yPercent) ? Number(options.yPercent) : 50));

  if (!text) {
    return pdfDoc.save();
  }

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const desiredX = (width * (xPercent / 100)) - textWidth / 2;
    const desiredY = (height * (1 - yPercent / 100)) - fontSize / 2;
    const x = Math.max(8, Math.min(width - textWidth - 8, desiredX));
    const y = Math.max(8, Math.min(height - fontSize - 8, desiredY));

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color,
      opacity,
      rotate: degrees(rotation),
    });
  }

  return pdfDoc.save();
};

export interface PageNumberOptions {
  format: string;
  fontSize: number;
  xPercent: number;
  yPercent: number;
  startPage: number;
  endPage: number;
}

const buildPageNumberLabel = (format: string, pageNumber: number, totalPages: number) => {
  const trimmed = format.trim();
  if (!trimmed) {
    return `Page ${pageNumber}`;
  }
  if (trimmed.includes('{n}') || trimmed.includes('{total}')) {
    return trimmed.replaceAll('{n}', String(pageNumber)).replaceAll('{total}', String(totalPages));
  }
  if (/\d+/.test(trimmed)) {
    return trimmed.replace(/\d+/, String(pageNumber));
  }
  return `${trimmed} ${pageNumber}`;
};

export const addPageNumbersToPDF = async (file: File, options: PageNumberOptions): Promise<Uint8Array> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const fontSize = Math.max(8, Math.min(72, Number.isFinite(options.fontSize) ? options.fontSize : 10));
  const normalizedX = Math.max(0.02, Math.min(0.98, Number.isFinite(options.xPercent) ? options.xPercent : 0.5));
  const normalizedY = Math.max(0.02, Math.min(0.98, Number.isFinite(options.yPercent) ? options.yPercent : 0.05));
  const startPage = Math.max(1, Math.min(totalPages, Math.floor(options.startPage || 1)));
  const endPage = Math.max(startPage, Math.min(totalPages, Math.floor(options.endPage || totalPages)));

  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (pageNumber < startPage || pageNumber > endPage) return;
    const label = buildPageNumberLabel(options.format, pageNumber, totalPages);
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const x = (width * normalizedX) - textWidth / 2;
    const y = height * normalizedY;
    page.drawText(label, {
      x: Math.max(8, Math.min(width - textWidth - 8, x)),
      y: Math.max(8, Math.min(height - fontSize - 8, y)),
      size: fontSize,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  return pdfDoc.save();
};
