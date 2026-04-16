import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteMeta {
  title: string;
  description: string;
}

const defaultMeta: RouteMeta = {
  title: 'PDF Chef - Private PDF Tools',
  description: 'Private PDF tools that run in your browser. Merge, split, convert, edit, secure, and optimize PDFs locally.',
};

const routeMeta: Record<string, RouteMeta> = {
  '/': defaultMeta,
  '/compress': {
    title: 'Compress PDF - Reduce File Size Online | PDF Chef',
    description: 'Reduce PDF size with browser-based compression and readability preview controls. Private and client-side.',
  },
  '/merge': {
    title: 'Merge PDF Files Online - Free & Private | PDF Chef',
    description: 'Combine multiple PDFs into one document instantly with local processing. No upload required.',
  },
  '/split': {
    title: 'Split PDF Pages - Extract & Separate Online | PDF Chef',
    description: 'Split PDFs by selected pages, all pages, or by custom page groups, fully in-browser.',
  },
  '/edit': {
    title: 'Edit PDF - Add Text and Annotations | PDF Chef',
    description: 'Edit PDFs with text overlays and save the updated document privately on your device.',
  },
  '/pdf-to-jpg': {
    title: 'PDF to JPG Converter - Export Pages to Images | PDF Chef',
    description: 'Convert PDF pages to JPG, PNG, or WebP images with live quality and DPI controls.',
  },
  '/image-to-pdf': {
    title: 'JPG to PDF Converter - Create PDFs from Images | PDF Chef',
    description: 'Create PDFs from images with drag-and-drop layout controls and local export.',
  },
  '/make-pdf': {
    title: 'Make PDF from Photos - Camera or Gallery | PDF Chef',
    description: 'Capture or import photos and build a scanned PDF directly in your browser.',
  },
  '/sign': {
    title: 'Sign PDF - Add Signature Image | PDF Chef',
    description: 'Draw or upload your signature, place it on pages, and export a signed PDF locally.',
  },
  '/delete-pages': {
    title: 'Delete PDF Pages - Remove Unwanted Pages | PDF Chef',
    description: 'Select and remove PDF pages visually with thumbnail previews and instant export.',
  },
  '/reorder': {
    title: 'Reorder PDF Pages - Drag and Drop Sort | PDF Chef',
    description: 'Rearrange PDF pages with drag-and-drop ordering and page-level previews.',
  },
  '/rotate': {
    title: 'Rotate PDF Pages - Batch Page Rotation | PDF Chef',
    description: 'Rotate selected or all PDF pages by 90-degree increments and download the updated file.',
  },
  '/protect': {
    title: 'Protect PDF with Password | PDF Chef',
    description: 'Encrypt PDF documents with a password locally and keep your files private.',
  },
  '/unlock': {
    title: 'Unlock PDF - Remove Password | PDF Chef',
    description: 'Decrypt password-protected PDFs locally after entering the correct password.',
  },
  '/extract': {
    title: 'Extract PDF Pages - Export Selected Pages | PDF Chef',
    description: 'Choose exact pages and export them into a new PDF file with local-only processing.',
  },
  '/metadata': {
    title: 'PDF Metadata Editor - Title, Author, Keywords | PDF Chef',
    description: 'View and update PDF metadata fields like title, author, subject, and keywords.',
  },
  '/flatten': {
    title: 'Flatten PDF Forms - Lock Form Fields | PDF Chef',
    description: 'Flatten form fields into static content to make documents non-editable.',
  },
  '/compare': {
    title: 'Compare PDF Files - Multi-page Comparison Report | PDF Chef',
    description: 'Compare two PDFs page by page and export a detailed text comparison report.',
  },
  '/ocr': {
    title: 'OCR PDF - Extract Text Layer or Run OCR | PDF Chef',
    description: 'Extract text from PDF text layers or run OCR on image-based pages directly in-browser.',
  },
  '/watermark': {
    title: 'Watermark PDF - Add Custom Text Watermark | PDF Chef',
    description: 'Apply text watermarks with custom size, opacity, color, and rotation.',
  },
  '/page-numbers': {
    title: 'Add Page Numbers to PDF | PDF Chef',
    description: 'Add custom page numbering with flexible format, position, and page range controls.',
  },
  '/repair': {
    title: 'Repair PDF - Re-save for Compatibility | PDF Chef',
    description: 'Rebuild and re-save PDFs to improve compatibility with strict PDF readers.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | PDF Chef',
    description: 'Read the PDF Chef privacy policy.',
  },
  '/pdf-chef-privacy': {
    title: 'Android Privacy Policy | PDF Chef',
    description: 'Read the Android app privacy policy for PDF Chef.',
  },
};

const upsertMetaTag = (name: string, content: string, property = false) => {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    if (property) element.setAttribute('property', name);
    else element.setAttribute('name', name);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
};

export const RouteSEO: React.FC = () => {
  const location = useLocation();

  const meta = useMemo(() => {
    return routeMeta[location.pathname] ?? defaultMeta;
  }, [location.pathname]);

  useEffect(() => {
    const origin = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://pdfchef.dhananjaytech.app';
    const canonicalPath = location.pathname.startsWith('/') ? location.pathname : `/${location.pathname}`;
    const canonicalUrl = `${origin}/#${canonicalPath}`;

    document.title = meta.title;

    upsertMetaTag('description', meta.description);
    upsertMetaTag('og:title', meta.title, true);
    upsertMetaTag('og:description', meta.description, true);
    upsertMetaTag('og:url', canonicalUrl, true);
    upsertMetaTag('twitter:title', meta.title, true);
    upsertMetaTag('twitter:description', meta.description, true);
    upsertMetaTag('twitter:url', canonicalUrl, true);

    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);
  }, [location.pathname, meta]);

  return null;
};
