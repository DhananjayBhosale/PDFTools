import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';

const buildPdf = content => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
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
  return Buffer.from(source);
};

const createOptimizedPatchFixture = () => buildPdf([
  'q',
  '1 0 0 1 10 20 cm',
  '0 0 100 50 re f',
  'Q',
  'BT',
  '/F1 8 Tf',
  '1 0 0 1 24 760 Tm',
  '(A) Tj',
  'ET',
  'BT',
  '/F1 8 Tf',
  '1 0 0 1 32 760 Tm',
  '(B) Tj',
  'ET',
  'BT',
  '/F1 8 Tf',
  '1 0 0 1 40 760 Tm',
  '(C) Tj',
  'ET',
  'BT',
  '/F1 18 Tf',
  '1 0 0 1 72 700 Tm',
  '(This is a PDF file) Tj',
  'ET',
].join('\n'));

const createFixture = async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  page.drawText('This is a PDF file', { x: 72, y: 700, size: 18, font });
  return Buffer.from(await document.save());
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => consoleErrors.push(error.message));

await page.addInitScript(() => {
  localStorage.setItem('pdfchef.workspace.settings.v1', JSON.stringify({
    autoDownload: false,
    keepLocalHistory: false,
    confirmLargeJobs: false,
    largeFileWarningMb: 80,
    onboardingComplete: true,
    interfaceFont: 'inter',
  }));
});

try {
  await page.goto(`${baseUrl}/edit`);
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-edit.pdf',
    mimeType: 'application/pdf',
    buffer: await createFixture(),
  });

  const target = page.getByRole('button', { name: 'Edit existing PDF word: PDF' });
  await target.waitFor({ timeout: 60_000 });
  await target.click();

  const inspector = page.getByRole('region', { name: 'Selected text properties' });
  const saveMode = inspector.getByLabel('Existing text save mode');
  await saveMode.waitFor({ timeout: 60_000 });
  assert.equal(await saveMode.inputValue(), 'native');
  assert.equal(await inspector.getByRole('checkbox', { name: 'Solid background' }).count(), 0);
  assert.match(await page.getByText(/Direct text edit ready/).textContent(), /no patch or white box/);

  const sourceReplacement = page.getByTestId('existing-pdf-word-replacement');
  const selectionUnderline = page.getByTestId('existing-pdf-selection-underline');
  assert.equal(
    await sourceReplacement.evaluate(element => getComputedStyle(element).borderBottomWidth),
    '0px',
    'existing text selection should not draw a border through the glyphs',
  );
  const editor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  const replacementTextBounds = await editor.boundingBox();
  const underlineBounds = await selectionUnderline.boundingBox();
  assert.ok(replacementTextBounds && underlineBounds, 'existing text underline did not expose bounds');
  assert.ok(
    underlineBounds.y >= replacementTextBounds.y + replacementTextBounds.height - 1,
    'existing text underline crossed through the glyphs',
  );

  await editor.selectText();
  await editor.pressSequentially('document');

  const outputResolvers = [];
  await page.exposeFunction('capturePdfChefNativeOutput', bytes => {
    outputResolvers.shift()?.(bytes);
  });
  const installOutputListener = () => page.evaluate(() => {
    window.addEventListener('pdfchef:output-ready', event => {
      event.detail.blob.arrayBuffer()
        .then(buffer => window.capturePdfChefNativeOutput(Array.from(new Uint8Array(buffer))));
    });
  });
  await installOutputListener();
  const nextOutput = () => new Promise(resolve => outputResolvers.push(resolve));
  const saveButton = page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Save' });
  const outputPromise = nextOutput();
  await saveButton.click();
  const outputBytes = new Uint8Array(await outputPromise);

  const loadingTask = pdfjs.getDocument({ data: outputBytes });
  const outputDocument = await loadingTask.promise;
  const outputPage = await outputDocument.getPage(1);
  const textContent = await outputPage.getTextContent();
  const extracted = textContent.items.map(item => item.str).join('').trim();
  assert.equal(extracted, 'This is a document file');

  const operators = await outputPage.getOperatorList();
  const imageOperators = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
  ].filter(operation => typeof operation === 'number'));
  assert.equal(
    operators.fnArray.some(operation => imageOperators.has(operation)),
    false,
    'direct text output unexpectedly contains a visual image patch',
  );
  assert.equal(
    operators.fnArray.some(operation => operation === pdfjs.OPS.constructPath),
    false,
    'direct text output unexpectedly added a filled rectangle or other path',
  );
  assert.deepEqual(consoleErrors, []);
  await loadingTask.destroy();

  await editor.fill('');
  const deletionOutputPromise = nextOutput();
  await saveButton.click();
  const deletionBytes = new Uint8Array(await Promise.race([
    deletionOutputPromise,
    page.getByRole('alert').waitFor({ timeout: 15_000 }).then(async () => {
      throw new Error(`${await page.getByRole('alert').innerText()}\n${consoleErrors.join('\n')}`);
    }),
  ]));
  const deletionTask = pdfjs.getDocument({ data: deletionBytes });
  const deletionDocument = await deletionTask.promise;
  const deletionPage = await deletionDocument.getPage(1);
  const deletionText = await deletionPage.getTextContent();
  assert.equal(
    deletionText.items.map(item => item.str).join('').trim(),
    'This is a file',
  );
  await deletionTask.destroy();

  await page.goto(`${baseUrl}/edit`);
  await installOutputListener();
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'optimized-preview-direct.pdf',
    mimeType: 'application/pdf',
    buffer: createOptimizedPatchFixture(),
  });
  const optimizedTarget = page.getByRole('button', { name: 'Edit existing PDF word: PDF' });
  await optimizedTarget.waitFor({ timeout: 60_000 });
  await optimizedTarget.click();
  const optimizedInspector = page.getByRole('region', { name: 'Selected text properties' });
  const optimizedSaveMode = optimizedInspector.getByLabel('Existing text save mode');
  await optimizedSaveMode.waitFor();
  assert.equal(await optimizedSaveMode.inputValue(), 'native');
  assert.equal(
    await optimizedSaveMode.locator('option[value="visual"]').evaluate(element => element.disabled),
    true,
  );
  assert.equal(await page.getByTestId('replacement-source-backdrop').evaluate(element => element.tagName), 'DIV');
  await page.getByText(/preview-only solid mask/).waitFor();
  const optimizedEditor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  await optimizedEditor.selectText();
  await optimizedEditor.pressSequentially('document');
  const optimizedOutputPromise = nextOutput();
  await saveButton.click();
  const optimizedBytes = new Uint8Array(await optimizedOutputPromise);
  const optimizedTask = pdfjs.getDocument({ data: optimizedBytes });
  const optimizedDocument = await optimizedTask.promise;
  const optimizedPage = await optimizedDocument.getPage(1);
  const optimizedText = await optimizedPage.getTextContent();
  assert.equal(optimizedText.items.map(item => item.str).join('').trim(), 'A B CThis is a document file');
  await optimizedTask.destroy();

  console.log(JSON.stringify({
    status: 'PASS',
    checked: [
      'clicked word resolves to Direct text mode',
      'existing text selection uses an underline instead of a box',
      'saved output replaces one word in the extractable PDF text object',
      'neighboring sentence text remains present',
      'direct output contains no image patch',
      'clearing the inline word removes it from extractable PDF text',
      'direct deletion leaves exactly one separator between neighbouring words',
      'solid background remains absent in Direct text mode',
      'optimized display lists use a disclosed preview-only mask only for safe Direct output',
      'an unaligned reconstruction cannot enter Visual fallback or its exported drawing path',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
