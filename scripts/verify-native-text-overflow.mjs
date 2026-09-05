import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';

const overflowMessage = 'Replacement text does not fit on this page. Shorten the text or reduce its size before saving.';
const sourceText = 'Start target end';
const longReplacement = 'WIDEREPLACEMENTWIDEREPLACEMENT';

const buildPdf = ({ matrix = [1, 0, 0, 1, 435, 700], cropBox, rotate = 0, inheritedCrop = false }) => {
  const cropEntry = cropBox ? `/CropBox [${cropBox.join(' ')}]` : '';
  const content = `BT /F1 18 Tf ${matrix.join(' ')} Tm (${sourceText}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [3 0 R] /Count 1 ${inheritedCrop ? cropEntry : ''} >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${inheritedCrop ? '' : cropEntry} /Rotate ${rotate} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let source = '%PDF-1.7\n%PDFChef\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Array.from(Buffer.from(source));
};

await mkdir('output', { recursive: true });
const cacheDir = await mkdtemp(path.resolve('output/.native-text-overflow-vite-'));
const server = await createServer({
  cacheDir,
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`);
  const cases = [
    ...[0, 90, 180, 270].map((rotate) => ({
      name: `right-edge overflow at page rotation ${rotate}`,
      fixture: { rotate },
      replacement: longReplacement,
      rejects: true,
    })),
    { name: 'untouched suffix overflow', fixture: {}, replacement: 'WWWWWWW', rejects: true },
    { name: 'top-edge rotated text overflow', fixture: { matrix: [0, 1, -1, 0, 300, 615] }, replacement: longReplacement, rejects: true },
    { name: 'left-edge rotated text overflow', fixture: { matrix: [-1, 0, 0, -1, 175, 700] }, replacement: longReplacement, rejects: true },
    { name: 'bottom-edge rotated text overflow', fixture: { matrix: [0, -1, 1, 0, 300, 175] }, replacement: longReplacement, rejects: true },
    { name: 'skewed text overflow', fixture: { matrix: [1, 0.5, 0, 1, 435, 550] }, replacement: longReplacement, rejects: true },
    { name: 'offset CropBox overflow', fixture: { matrix: [1, 0, 0, 1, 385, 700], cropBox: [100, 100, 550, 750] }, replacement: longReplacement, rejects: true },
    { name: 'inherited CropBox overflow', fixture: { matrix: [1, 0, 0, 1, 385, 700], cropBox: [100, 100, 550, 750], inheritedCrop: true }, replacement: longReplacement, rejects: true },
    { name: 'CropBox outside MediaBox still respects MediaBox', fixture: { cropBox: [-50, -50, 700, 850] }, replacement: longReplacement, rejects: true },
    { name: 'scaled font overflow', fixture: { matrix: [1.5, 0, 0, 0.8, 365, 700] }, replacement: longReplacement, rejects: true },
    ...[0, 90, 180, 270].map((rotate) => ({
      name: `fitting edit at page rotation ${rotate}`,
      fixture: { rotate },
      replacement: 'safe',
      rejects: false,
    })),
    { name: 'fitting rotated text preserves transform', fixture: { matrix: [0, 1, -1, 0, 300, 615] }, replacement: 'safe', rejects: false },
    { name: 'fitting scaled text preserves transform', fixture: { matrix: [1.5, 0, 0, 0.8, 365, 700] }, replacement: 'safe', rejects: false },
    { name: 'deletion remains supported', fixture: {}, replacement: '', rejects: false },
  ];

  for (const scenario of cases) {
    const result = await page.evaluate(async ({ bytes, replacement, sourceText }) => {
      const { applyNativePdfTextEdits } = await import('/services/pdfNativeTextEditor.ts');
      try {
        const output = await applyNativePdfTextEdits(new Uint8Array(bytes), [{
          pageIndex: 0,
          sourceText: 'target',
          // The synthetic page has exactly one text object. PDFium resolves
          // actual target and saved character bounds from this source run.
          pdfRect: [0, 0, 612, 792],
          sourceRun: { text: sourceText, start: 6, end: 12, pdfRect: [0, 0, 612, 792] },
          replacementText: replacement,
        }]);
        return { bytes: Array.from(output) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }, { bytes: buildPdf(scenario.fixture), replacement: scenario.replacement, sourceText });

    if (scenario.rejects) {
      assert.equal(result.error, overflowMessage, scenario.name);
      assert.equal(result.bytes, undefined, `${scenario.name} must not deliver a PDF`);
    } else {
      assert.equal(result.error, undefined, scenario.name);
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(result.bytes),
        standardFontDataUrl: `${path.resolve('node_modules/pdfjs-dist/standard_fonts')}${path.sep}`,
      });
      try {
        const document = await loadingTask.promise;
        const outputPage = await document.getPage(1);
        const content = await outputPage.getTextContent();
        const run = content.items.find((item) => item.str.includes('Start'));
        assert.ok(run, scenario.name);
        assert.equal(run.str, scenario.replacement ? `Start ${scenario.replacement} end` : 'Start end', scenario.name);
        const matrix = scenario.fixture.matrix ?? [1, 0, 0, 1, 435, 700];
        const expectedTransform = [...matrix.slice(0, 4).map((value) => value * 18), ...matrix.slice(4)];
        run.transform.forEach((value, index) => {
          assert.ok(Math.abs(value - expectedTransform[index]) < 0.001, `${scenario.name}: transform ${index}`);
        });
        assert.equal(outputPage.rotate, scenario.fixture.rotate ?? 0, scenario.name);
      } finally {
        await loadingTask.destroy();
      }
    }
    console.log(`PASS ${scenario.name}`);
  }
  console.log(`Verified ${cases.length} native text overflow/fitting cases against serialized PDFium output.`);

  const visualCases = [
    { name: 'Visual Helvetica kerning estimate undercounts saved advances', font: StandardFonts.Helvetica, text: 'AVAVAVAV', edge: 'right', rejects: true },
    { name: 'Visual untouched suffix includes kerning advances', font: StandardFonts.Helvetica, text: 'safe AVAVAVAV', edge: 'right', rejects: true },
    { name: 'Visual Helvetica italic right overhang', font: StandardFonts.HelveticaOblique, text: 'f', edge: 'right', rejects: true },
    { name: 'Visual Times italic left overhang', font: StandardFonts.TimesRomanItalic, text: 'f', edge: 'left', rejects: true },
    { name: 'Visual accent extends above font ascender', font: StandardFonts.Helvetica, text: 'Á', edge: 'top', rejects: true },
    { name: 'Visual rotated kerning overflow', font: StandardFonts.Helvetica, text: 'AVAVAVAV', edge: 'rotated-top', rejects: true },
    { name: 'Visual duplicate placement checks every matching object', font: StandardFonts.Helvetica, text: 'f', edge: 'right', duplicate: true, rejects: true },
    { name: 'Visual fitting italic replacement', font: StandardFonts.TimesRomanItalic, text: 'fitting safely', rejects: false },
    { name: 'Visual missing expected run fails closed', font: StandardFonts.Helvetica, text: 'safe', missing: true, rejects: true },
  ];
  for (const scenario of visualCases) {
    const document = await PDFDocument.create();
    const outputPage = document.addPage([612, 792]);
    const font = await document.embedFont(scenario.font);
    const size = 18;
    const width = font.widthOfTextAtSize(scenario.text, size);
    const ascent = font.heightAtSize(size, { descender: false });
    const x = scenario.edge === 'right' ? 612 - width : scenario.edge === 'left' ? 1.5 : 200;
    const y = scenario.edge === 'top' ? 792 - ascent : scenario.edge === 'rotated-top' ? 792 - width : 700;
    const rotation = scenario.edge === 'rotated-top' ? 90 : 0;
    outputPage.drawText(scenario.text, { x, y, font, size, rotate: degrees(rotation) });
    if (scenario.duplicate) {
      const italicFont = await document.embedFont(StandardFonts.TimesRomanItalic);
      outputPage.drawText(scenario.text, { x, y, font: italicFont, size });
    }
    const result = await page.evaluate(async ({ bytes, run }) => {
      const { verifyPdfTextRunsFitWithinPage } = await import('/services/pdfNativeTextEditor.ts');
      try {
        await verifyPdfTextRunsFitWithinPage(new Uint8Array(bytes), [run]);
        return { verified: true };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }, {
      bytes: Array.from(await document.save()),
      run: { pageIndex: 0, text: scenario.missing ? 'absent replacement' : scenario.text, x, y },
    });
    if (scenario.rejects) {
      assert.equal(result.error, scenario.missing
        ? 'Visual fallback failed: the saved replacement text could not be verified.'
        : overflowMessage, scenario.name);
    } else {
      assert.equal(result.error, undefined, scenario.name);
      assert.equal(result.verified, true, scenario.name);
    }
    console.log(`PASS ${scenario.name}`);
  }
  console.log(`Verified ${visualCases.length} Visual saved-run ink safety cases.`);
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
