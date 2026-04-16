# PDF Chef

<p align="center">
  <a href="https://pdfchef.dhananjaytech.app/">
    <img alt="Live site" src="https://img.shields.io/badge/Live-pdfchef.dhananjaytech.app-2563eb?style=for-the-badge&logo=cloudflarepages&logoColor=white">
  </a>
  <img alt="Private processing" src="https://img.shields.io/badge/Processing-On%20device-059669?style=for-the-badge">
  <img alt="Stack" src="https://img.shields.io/badge/React%20%2B%20TypeScript%20%2B%20PDF.js-Vite-111827?style=for-the-badge">
</p>

Private PDF tools that run in the browser. Merge, split, compress, convert, sign, OCR, compare, watermark, reorder, and protect PDFs without pushing the core workflow to a server.

**Live product:** [pdfchef.dhananjaytech.app](https://pdfchef.dhananjaytech.app/)

![PDF Chef homepage](.github/assets/homepage-preview.png)

## Why this repo is worth a look

- Clean, focused PDF utility app with a polished consumer-style UI instead of a demo shell
- Browser-first architecture for privacy-sensitive workflows
- Real editing and review flows: signing, page reorder, OCR, watermarking, page numbers, compare, and image extraction
- Mobile fixes and interaction work already baked into the current build

## What is actually special here

- **Live compression preview**: the compression flow is not just a blind quality slider. Users can inspect the output visually before downloading.
- **Selectable OCR page previews**: OCR results are shown page by page, and text can be selected from the preview instead of forcing users to trust a plain text dump.
- **Embedded image extraction**: PDF to Image can detect real raster images inside a PDF and extract them separately, instead of only flattening full pages.
- **Smoother interaction work**: sliders, drag flows, and mobile page operations were rebuilt to feel continuous instead of step-locked or jittery.
- **Transparent signature handling**: signatures can be prepared without a white box background, which matters for real documents.
- **Tool-grade previews**: signing, watermarking, page numbers, OCR, compare, and conversion flows all lean on live previews instead of static forms.

## What PDF Chef can do

### Arrange and prepare PDFs

- Merge PDFs
- Split PDFs
- Reorder pages
- Rotate pages
- Delete pages
- Extract selected pages
- Add page numbers
- Add watermarks
- Flatten filled documents

### Convert and create

- PDF to image
- Extract embedded images from a PDF
- Image to PDF
- Camera-style make PDF flow
- Compress PDFs

### Review, edit, and secure

- Edit PDF overlays
- Add signatures
- OCR with page-by-page copyable text
- Compare PDFs with exportable diff report
- View and update metadata
- Password protect or unlock PDFs
- Repair compatibility issues

## Product highlights

- **Private by default**: core PDF processing happens on the client
- **Modern interaction model**: smoother sliders, stronger mobile layouts, and touch-friendly page operations
- **Visual workflows**: live previews for signing, page changes, image conversion, and OCR results
- **Ship-ready branding**: the public product is already live and deployable

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- PDF.js
- pdf-lib
- Tesseract.js
- jsPDF
- Cloudflare Pages

## Run locally

Prerequisite: Node.js 18+

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

## Production build

```bash
npm run build
```

## Deploy

The app is deployed on Cloudflare Pages and currently live at [pdfchef.dhananjaytech.app](https://pdfchef.dhananjaytech.app/).

## Notes

- This repo contains the current production-facing web app, not a starter template.
- Some PDF operations are intentionally browser-limited and trade server depth for privacy and speed.
