import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';

const buildPdf = (content, { cropBox = '[20 10 592 782]', rotate = 0 } = {}) => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /CropBox ${cropBox} /Rotate ${rotate} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
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

const createFidelityFixture = () => buildPdf([
  'q',
  '0.94 0.97 1 rg',
  '35 620 540 130 re f',
  '0.1 0.35 0.7 RG',
  '2 w',
  '35 620 540 130 re S',
  '0.78 0.16 0.18 rg',
  '50 635 120 9 re f',
  '0.1 0.6 0.35 rg',
  '400 735 130 7 re f',
  'BT',
  '/F1 20 Tf',
  '0.12 0.2 0.55 rg',
  '1 0 0 1 72 700 Tm',
  '[(WWW ) (target) ( iii ) (target end)] TJ',
  'ET',
  'Q',
].join('\n'));

const createPositionedKerningFixture = () => buildPdf([
  'BT',
  '/F1 20 Tf',
  '1 0 0 1 72 700 Tm',
  '[(WWW ) 90 (target) -140 ( iii ) 50 (target end)] TJ',
  'ET',
].join('\n'));

const createRotatedFixture = () => buildPdf([
  'q',
  '0.96 0.94 1 rg',
  '45 650 500 95 re f',
  'BT',
  '/F1 18 Tf',
  '0.55 0.12 0.35 rg',
  '1 0 0 1 72 700 Tm',
  '(Rotate target safely) Tj',
  'ET',
  'Q',
].join('\n'), { rotate: 90 });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

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
  const fixture = createFidelityFixture();
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-fidelity.pdf',
    mimeType: 'application/pdf',
    buffer: fixture,
  });

  const targets = page.getByRole('button', { name: 'Edit existing PDF word: target' });
  await targets.first().waitFor({ timeout: 60_000 });
  assert.equal(await targets.count(), 2, 'the repeated-word fixture did not expose both targets');

  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible' });
  await canvas.evaluate((element) => {
    const context = element.getContext('2d');
    window.__pdfChefFidelity = {
      width: element.width,
      height: element.height,
      pixels: context.getImageData(0, 0, element.width, element.height).data,
      maskLeft: 0,
      maskTop: 0,
      maskBottom: 0,
    };
  });

  await targets.nth(1).click();
  const inspector = page.getByRole('region', { name: 'Selected text properties' });
  assert.equal(await inspector.getByLabel('Existing text save mode').inputValue(), 'native');
  const editor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  assert.equal(await editor.inputValue(), 'target');
  assert.equal(await editor.evaluate((element) => getComputedStyle(element).color), 'rgb(31, 51, 140)');
  await editor.fill('replacement');

  await page.getByTestId('existing-pdf-word-replacement').evaluate((element) => {
    const canvasElement = document.querySelector('canvas');
    const canvasRect = canvasElement.getBoundingClientRect();
    const editorRect = element.getBoundingClientRect();
    const scaleX = canvasElement.width / canvasRect.width;
    const scaleY = canvasElement.height / canvasRect.height;
    const state = window.__pdfChefFidelity;
    state.maskLeft = Math.max(0, Math.floor((editorRect.left - canvasRect.left) * scaleX) - 12);
    state.maskTop = Math.max(0, Math.floor((editorRect.top - canvasRect.top) * scaleY) - 12);
    state.maskBottom = Math.min(
      state.height,
      Math.ceil((editorRect.bottom - canvasRect.top) * scaleY) + 12,
    );
  });

  const outputResolvers = [];
  await page.exposeFunction('capturePdfChefFidelityOutput', (bytes) => {
    outputResolvers.shift()?.(bytes);
  });
  await page.evaluate(() => {
    window.addEventListener('pdfchef:output-ready', (event) => {
      event.detail.blob.arrayBuffer().then((buffer) => {
        window.capturePdfChefFidelityOutput(Array.from(new Uint8Array(buffer)));
      });
    });
  });
  const outputPromise = new Promise((resolve) => outputResolvers.push(resolve));
  await page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Save' }).click();
  const outputBytes = new Uint8Array(await outputPromise);
  const reopenBytes = Buffer.from(outputBytes);

  const loadingTask = pdfjs.getDocument({ data: outputBytes });
  const outputDocument = await loadingTask.promise;
  const outputPage = await outputDocument.getPage(1);
  const textContent = await outputPage.getTextContent();
  assert.equal(
    textContent.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim(),
    'WWW target iii replacement end',
    'the wrong repeated occurrence was replaced',
  );
  await loadingTask.destroy();

  await page.getByText('Edited PDF ready. Review it before sharing.').waitFor({ timeout: 30_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-fidelity-output.pdf',
    mimeType: 'application/pdf',
    buffer: reopenBytes,
  });
  const outputCanvas = page.locator('canvas').first();
  await outputCanvas.waitFor({ state: 'visible' });
  const diff = await outputCanvas.evaluate((element) => {
    const state = window.__pdfChefFidelity;
    const context = element.getContext('2d');
    const current = context.getImageData(0, 0, element.width, element.height).data;
    if (element.width !== state.width || element.height !== state.height) {
      return { sizeMismatch: true, differingPixels: -1, maxChannelDelta: 255, comparedPixels: 0 };
    }
    let differingPixels = 0;
    let comparedPixels = 0;
    let maxChannelDelta = 0;
    let comparedPrefixPixels = 0;
    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const insideEditedLine = y >= state.maskTop && y <= state.maskBottom;
        if (insideEditedLine && x >= state.maskLeft) continue;
        const offset = (y * state.width + x) * 4;
        let pixelDelta = 0;
        for (let channel = 0; channel < 4; channel += 1) {
          pixelDelta = Math.max(pixelDelta, Math.abs(current[offset + channel] - state.pixels[offset + channel]));
        }
        maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
        if (pixelDelta > 2) differingPixels += 1;
        comparedPixels += 1;
        if (insideEditedLine) comparedPrefixPixels += 1;
      }
    }
    return { sizeMismatch: false, differingPixels, maxChannelDelta, comparedPixels, comparedPrefixPixels };
  });

  assert.equal(diff.sizeMismatch, false);
  assert.ok(diff.comparedPrefixPixels > 0, 'the untouched same-line prefix was not compared');
  assert.ok(diff.maxChannelDelta <= 2, `stable-region max channel delta was ${diff.maxChannelDelta}`);
  assert.ok(
    diff.differingPixels / Math.max(1, diff.comparedPixels) <= 0.00001,
    `${diff.differingPixels} pixels changed outside the edited word-and-suffix strip`,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-rotated.pdf',
    mimeType: 'application/pdf',
    buffer: createRotatedFixture(),
  });
  const rotatedTarget = page.getByRole('button', { name: 'Edit existing PDF word: target' });
  await rotatedTarget.waitFor({ timeout: 60_000 });
  await rotatedTarget.click();
  const rotatedInspector = page.getByRole('region', { name: 'Selected text properties' });
  const rotatedMode = await rotatedInspector.getByLabel('Existing text save mode').inputValue();
  const rotatedStatuses = await page.getByRole('status').allTextContents();
  assert.equal(rotatedMode, 'native', rotatedStatuses.join(' | ') || 'rotated target did not enter direct mode');
  const rotatedEditor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  await rotatedEditor.fill('word');
  const rotatedOutputPromise = new Promise((resolve) => outputResolvers.push(resolve));
  await page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Save' }).click();
  const rotatedOutputBytes = new Uint8Array(await rotatedOutputPromise);
  const rotatedTask = pdfjs.getDocument({ data: rotatedOutputBytes });
  const rotatedDocument = await rotatedTask.promise;
  const rotatedPage = await rotatedDocument.getPage(1);
  const rotatedText = await rotatedPage.getTextContent();
  assert.equal(rotatedText.items.map((item) => item.str).join('').trim(), 'Rotate word safely');
  await rotatedTask.destroy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-positioned-kerning.pdf',
    mimeType: 'application/pdf',
    buffer: createPositionedKerningFixture(),
  });
  const kernedTargets = page.getByRole('button', { name: 'Edit existing PDF word: target' });
  await kernedTargets.nth(1).waitFor({ timeout: 60_000 });
  await kernedTargets.nth(1).click();
  assert.equal(
    await page.getByRole('region', { name: 'Selected text properties' })
      .getByLabel('Existing text save mode').inputValue(),
    'native',
  );
  await page.getByRole('textbox', { name: 'Edit text on page 1' }).fill('replacement');
  await page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Save' }).click();
  await page.getByRole('alert').getByText(/unedited PDF text moved during serialization/i).waitFor();
  assert.ok(consoleErrors.some((message) => /unedited PDF text moved during serialization/i.test(message)));
  assert.deepEqual(
    consoleErrors.filter((message) => !/unedited PDF text moved during serialization/i.test(message)),
    [],
  );

  await page.goto(`${baseUrl}/edit`);
  consoleErrors.length = 0;
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
    name: 'native-text-positioned-suffix.pdf',
    mimeType: 'application/pdf',
    buffer: createPositionedKerningFixture(),
  });
  const firstKernedTarget = page.getByRole('button', { name: 'Edit existing PDF word: WWW' });
  await firstKernedTarget.waitFor({ timeout: 60_000 });
  await firstKernedTarget.click();
  assert.equal(
    await page.getByRole('region', { name: 'Selected text properties' })
      .getByLabel('Existing text save mode').inputValue(),
    'native',
  );
  await page.getByRole('textbox', { name: 'Edit text on page 1' }).fill('Beginning');
  await page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Save' }).click();
  await page.getByRole('alert').getByText(/unedited PDF text moved during serialization/i).waitFor();
  assert.ok(consoleErrors.some((message) => /unedited PDF text moved during serialization/i.test(message)));
  assert.deepEqual(
    consoleErrors.filter((message) => !/unedited PDF text moved during serialization/i.test(message)),
    [],
  );

  console.log(JSON.stringify({
    status: 'PASS',
    directModeAvailability: '3/3 accepted word targets resolved across TJ/CropBox and rotated fixtures',
    renderDiff: diff,
    checked: [
      'non-zero CropBox',
      'TJ-fragmented proportional repeated words',
      'the selected repeated occurrence, not its twin, is replaced',
      'PDFium fill colour reaches the inline preview',
      'the untouched same-line prefix retains its TJ kerning pixels',
      'vector artwork outside the edited word-and-suffix strip is pixel-stable within a 2-channel tolerance',
      'saved output reopens and remains extractable',
      '90-degree page rotation remains directly editable and extractable',
      'a TJ object with custom character positioning fails closed when regeneration moves untouched prefix text',
      'a first-word edit fails closed when regeneration changes relative spacing inside the untouched suffix',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
