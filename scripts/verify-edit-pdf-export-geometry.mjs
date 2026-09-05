import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';
const replacementText = 'A longer rotated replacement line';

const visualPointToPdf = (rotation, visualX, visualY) => {
  const cropX = 20;
  const cropY = 30;
  const cropWidth = 600;
  const cropHeight = 800;
  if (rotation === 90) return { x: cropX + visualY, y: cropY + visualX };
  if (rotation === 180) return { x: cropX + cropWidth - visualX, y: cropY + visualY };
  if (rotation === 270) return { x: cropX + cropWidth - visualY, y: cropY + cropHeight - visualX };
  return { x: cropX + visualX, y: cropY + cropHeight - visualY };
};

const createFixture = async (rotation, sourceFontSize = 14) => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([640, 860]);
  page.setCropBox(20, 30, 600, 800);
  page.setRotation(degrees(rotation));
  page.drawRectangle({
    x: 20,
    y: 30,
    width: 600,
    height: 800,
    color: rgb(0.84, 0.9, 0.96),
  });
  const visualWidth = rotation === 90 || rotation === 270 ? 800 : 600;
  const visualHeight = rotation === 90 || rotation === 270 ? 600 : 800;
  const baseline = visualPointToPdf(rotation, visualWidth * 0.12, visualHeight * 0.24);
  page.drawText('Selectable source line', {
    x: baseline.x,
    y: baseline.y,
    size: sourceFontSize,
    font,
    color: rgb(0, 0, 0),
    rotate: degrees(rotation),
  });
  return Buffer.from(await document.save());
};

const closeTo = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1, `${label}: expected ${actual} to be close to ${expected}`);

const browser = await chromium.launch({ headless: true });
try {
  for (const { rotation, sourceFontSize } of [
    { rotation: 0, sourceFontSize: 6 },
    { rotation: 0, sourceFontSize: 14 },
    { rotation: 90, sourceFontSize: 14 },
    { rotation: 180, sourceFontSize: 14 },
    { rotation: 270, sourceFontSize: 14 },
  ]) {
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

    await page.goto(`${baseUrl}/edit`);
    await page.locator('input[type=file][accept=".pdf"]').setInputFiles({
      name: `cropped-rotated-${rotation}-${sourceFontSize}pt.pdf`,
      mimeType: 'application/pdf',
      buffer: await createFixture(rotation, sourceFontSize),
    });
    const target = page.locator('[data-testid="existing-pdf-text-target"]').first();
    await target.waitFor({ timeout: 60_000 });
    await target.click();

    const editor = page.getByRole('textbox', { name: 'Edit text on page 1' });
    const saveMode = page.getByLabel('Existing text save mode');
    await saveMode.waitFor();
    await saveMode.selectOption('visual');
    await editor.selectText();
    await editor.pressSequentially(replacementText);
    const replacementSuffix = await page.getByTestId('replacement-preview-suffix').textContent() || '';
    const exportedReplacementText = `${replacementText}${replacementSuffix}`;
    const backdrop = page.locator('[data-testid="replacement-source-backdrop"]');
    await backdrop.waitFor();
    assert.equal(await backdrop.evaluate(element => element.tagName), 'IMG');
    const backdropPixel = await backdrop.evaluate(async element => {
      await element.decode();
      const canvas = document.createElement('canvas');
      canvas.width = element.naturalWidth;
      canvas.height = element.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(element, 0, 0);
      return Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data);
    });
    assert.ok(backdropPixel[0] > 205 && backdropPixel[0] < 225, `unexpected automatic backdrop red channel: ${backdropPixel[0]}`);
    assert.ok(backdropPixel[1] > 220 && backdropPixel[1] < 240, `unexpected automatic backdrop green channel: ${backdropPixel[1]}`);
    assert.ok(backdropPixel[2] > 235 && backdropPixel[2] <= 255, `unexpected automatic backdrop blue channel: ${backdropPixel[2]}`);
    const solidBackground = page.getByRole('checkbox', { name: 'Solid background' });
    assert.equal(await solidBackground.isChecked(), false);
    assert.equal(await page.getByLabel('Background', { exact: true }).count(), 0);
    await solidBackground.check();
    assert.equal(await backdrop.evaluate(element => element.tagName), 'DIV');
    await page.getByLabel('Background', { exact: true }).waitFor();
    await solidBackground.uncheck();
    assert.equal(await backdrop.evaluate(element => element.tagName), 'IMG');
    assert.equal(
      await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
      true,
      `replacement text clipped in the ${rotation}-degree preview`,
    );

    const placement = await page.getByTestId('existing-pdf-word-replacement').evaluate(element => {
      const textarea = element.querySelector('textarea');
      return {
        leftPercent: Number.parseFloat(element.style.left),
        topPercent: Number.parseFloat(element.style.top),
        fontSize: Number.parseFloat(getComputedStyle(textarea).fontSize),
      };
    });
    assert.equal(placement.fontSize, sourceFontSize, `${sourceFontSize} pt source size was not preserved`);
    const outputPromise = page.evaluate(() => new Promise((resolve, reject) => {
      window.addEventListener('pdfchef:output-ready', event => {
        event.detail.blob.arrayBuffer()
          .then(buffer => resolve(Array.from(new Uint8Array(buffer))))
          .catch(reject);
      }, { once: true });
    }));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const outputBytes = new Uint8Array(await outputPromise);

    const loadingTask = pdfjs.getDocument({ data: outputBytes });
    const outputDocument = await loadingTask.promise;
    const outputPage = await outputDocument.getPage(1);
    const viewport = outputPage.getViewport({ scale: 1 });
    const textContent = await outputPage.getTextContent();
    const item = textContent.items.find(candidate => candidate.str === exportedReplacementText);
    assert.ok(item, `replacement text missing from ${rotation}-degree export`);
    const transform = pdfjs.Util.transform(viewport.transform, item.transform);
    closeTo(transform[4], placement.leftPercent / 100 * viewport.width, `${rotation}-degree x`);
    closeTo(transform[5], placement.topPercent / 100 * viewport.height + placement.fontSize, `${rotation}-degree baseline`);
    closeTo(transform[5], viewport.height * 0.24, `${rotation}-degree source baseline`);
    assert.deepEqual(consoleErrors, []);
    await loadingTask.destroy();
    await page.close();
  }

  console.log(JSON.stringify({
    status: 'PASS',
    checked: [
      'cropped page offsets',
      'automatic source backdrop on a coloured page',
      'solid background remains optional and off by default',
      '0/90/180/270-degree replacement export positions',
      '6-point Visual fallback source size and baseline preservation',
      'replacement baselines remain aligned with the original source run',
      'exported replacement text presence',
      'long replacement text remains visible before export',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
