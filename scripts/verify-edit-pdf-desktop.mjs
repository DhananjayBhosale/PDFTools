import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';
const root = process.cwd();
const fixture = path.join(root, 'qa-sample.pdf');
const outputDir = path.join(root, 'output', 'edit-pdf-desktop-verification');
const screenshotPath = path.join(outputDir, 'edit-pdf-inline-text-desktop.png');
const replacementScreenshotPath = path.join(outputDir, 'edit-existing-pdf-text-desktop.png');

await fs.access(fixture);
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];

const trackpadPinch = async (direction) => {
  const viewport = page.getByTestId('pdf-zoom-viewport');
  const bounds = await viewport.boundingBox();
  assert.ok(bounds, 'PDF zoom viewport did not expose bounds');
  const before = Number(await viewport.getAttribute('data-pdf-zoom'));
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    Math.max(1, Math.min(700, bounds.y + Math.min(bounds.height, 500) / 2)),
  );
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, direction === 'in' ? -20 : 20);
  } finally {
    await page.keyboard.up('Control');
  }
  await page.waitForFunction(
    ({ expectedDirection, previous }) => {
      const value = Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom'));
      return expectedDirection === 'in' ? value > previous : value < previous;
    },
    { expectedDirection: direction, previous: before },
  );
  return Number(await viewport.getAttribute('data-pdf-zoom'));
};

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
  await page.getByRole('heading', { name: /Edit PDF/ }).waitFor();
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(fixture);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60_000 });

  assert.equal(await page.getByRole('toolbar', { name: 'PDF editor tools' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Close editor' }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const trackpadZoomedIn = await trackpadPinch('in');
  const trackpadZoomedOut = await trackpadPinch('out');
  assert.ok(trackpadZoomedIn > 1, 'Mac trackpad pinch-in did not increase PDF zoom');
  assert.ok(trackpadZoomedOut < trackpadZoomedIn, 'Mac trackpad pinch-out did not decrease PDF zoom');

  const zoomViewport = page.getByTestId('pdf-zoom-viewport');
  await zoomViewport.evaluate(element => {
    window.__pdfChefWheelTrust = [];
    element.addEventListener('wheel', event => window.__pdfChefWheelTrust.push(event.isTrusted), { capture: true });
  });
  const currentPage = page.getByLabel('Current editor page');
  await page.mouse.move(640, 500);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -200);
  } finally {
    await page.keyboard.up('Control');
  }
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom')) === 2);
  const scrollMetrics = await zoomViewport.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
    windowScrollY: window.scrollY,
  }));
  assert.equal(scrollMetrics.overflowY, 'auto', 'desktop PDF box does not own vertical scrolling');
  assert.ok(scrollMetrics.scrollHeight > scrollMetrics.clientHeight, 'zoomed desktop PDF does not overflow inside its box');
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, 80);
  await page.waitForFunction(
    previous => (document.querySelector('[data-testid="pdf-zoom-viewport"]'))?.scrollTop > previous,
    scrollMetrics.scrollTop,
  );
  assert.equal(await page.evaluate(() => window.scrollY), scrollMetrics.windowScrollY, 'scrolling the PDF moved the app page');
  await zoomViewport.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.mouse.wheel(0, 80);
  await page.waitForFunction(() => (document.querySelector('[aria-label="Current editor page"]'))?.value === '1');
  assert.equal(await currentPage.inputValue(), '1', 'scrolling past the zoomed page end did not open the next page');
  await page.waitForTimeout(300);
  await zoomViewport.evaluate(element => { element.scrollTop = 0; });
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, -80);
  await page.waitForFunction(() => (document.querySelector('[aria-label="Current editor page"]'))?.value === '0');
  assert.equal(await currentPage.inputValue(), '0', 'scrolling past the zoomed page start did not open the previous page');
  await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom')) === 1);

  const sourceTargets = page.locator('[data-testid="existing-pdf-text-target"]');
  const sourceTextTarget = page.locator('[data-testid="existing-pdf-text-target"][aria-label="Edit existing PDF word: PDF"]').first();
  await sourceTextTarget.waitFor({ timeout: 60_000 });
  const sourceTargetCount = await sourceTargets.count();
  const sourceBaseline = await sourceTextTarget.evaluate(element => {
    const pageSurface = element.parentElement;
    const bounds = element.getBoundingClientRect();
    const pageBounds = pageSurface.getBoundingClientRect();
    const scale = pageSurface.offsetWidth > 0 ? pageBounds.width / pageSurface.offsetWidth : 1;
    return (bounds.bottom - pageBounds.top) / scale;
  });
  const sourceRunId = await sourceTextTarget.getAttribute('data-source-run-id');
  assert.ok(sourceRunId, 'source word did not expose a PDF run identity');
  const sourceRunTargetCount = await sourceTargets.evaluateAll(
    (targets, runId) => targets.filter(target => target.getAttribute('data-source-run-id') === runId).length,
    sourceRunId,
  );
  assert.ok(sourceRunTargetCount > 1, 'fixture did not expose multiple words from one PDF source run');
  const sourceWordLabel = await sourceTextTarget.getAttribute('aria-label');
  assert.match(sourceWordLabel || '', /^Edit existing PDF word: \S+$/);
  await sourceTextTarget.click();
  const replacementEditor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  await replacementEditor.waitFor();
  assert.doesNotMatch(await replacementEditor.inputValue(), /\s/);
  assert.equal(await replacementEditor.evaluate(element => document.activeElement === element), true);
  const sourceReplacement = page.getByTestId('existing-pdf-word-replacement');
  const selectionUnderline = page.getByTestId('existing-pdf-selection-underline');
  const replacementTextBounds = await replacementEditor.boundingBox();
  const underlineBounds = await selectionUnderline.boundingBox();
  assert.ok(replacementTextBounds && underlineBounds, 'source replacement underline did not expose bounds');
  const replacementGlyphBottom = await replacementEditor.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText('Hg');
    const baseline = metrics.fontBoundingBoxAscent
      + (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    const scale = element.offsetHeight > 0 ? bounds.height / element.offsetHeight : 1;
    return bounds.y + (baseline + metrics.fontBoundingBoxDescent) * scale;
  });
  assert.ok(
    underlineBounds.y >= replacementGlyphBottom - 1,
    `source replacement underline ${underlineBounds.y} crossed glyph bottom ${replacementGlyphBottom}`,
  );
  const previewBaseline = await replacementEditor.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const pageSurface = element.parentElement.parentElement;
    const pageBounds = pageSurface.getBoundingClientRect();
    const scale = pageSurface.offsetWidth > 0 ? pageBounds.width / pageSurface.offsetWidth : 1;
    const style = getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText('Hg');
    const cssBaseline = metrics.fontBoundingBoxAscent
      + (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    return (bounds.y - pageBounds.y) / scale + cssBaseline;
  });
  assert.ok(
    Math.abs(previewBaseline - sourceBaseline) <= 0.35,
    `middle-word preview baseline ${previewBaseline} did not align with source baseline ${sourceBaseline}`,
  );
  const lockedPosition = await sourceReplacement.getAttribute('style');
  assert.equal(await sourceReplacement.getByRole('button', { name: 'Resize selected element with arrow keys' }).count(), 0);
  await sourceReplacement.press('ArrowRight');
  assert.equal(await sourceReplacement.getAttribute('style'), lockedPosition, 'source word moved with an arrow key');
  await replacementEditor.selectText();
  await replacementEditor.pressSequentially('Edited selectable text');
  assert.equal(
    await replacementEditor.evaluate(element => element.scrollWidth <= element.clientWidth + 1),
    true,
    'replacement box did not expand to show the complete edited line',
  );
  assert.equal(
    await replacementEditor.evaluate(element => element.scrollHeight <= element.clientHeight + 1),
    true,
    'replacement text is vertically clipped',
  );
  await replacementEditor.press('Enter');
  assert.equal(await replacementEditor.evaluate(element => document.activeElement === element), false);
  assert.equal((await replacementEditor.inputValue()).includes('\n'), false);
  const selectedTextProperties = page.getByRole('region', { name: 'Selected text properties' });
  const saveMode = selectedTextProperties.getByLabel('Existing text save mode');
  await saveMode.waitFor();
  await saveMode.selectOption('visual');
  await page.getByText(/Visual fallback is active/).waitFor();
  assert.equal(await page.getByText(/Direct text edit ready/).count(), 0, 'save-mode status stayed on Direct text');
  assert.equal(
    await page.getByText(/Direct rewriting is not safe for this PDF structure/).count(),
    0,
    'voluntarily choosing Visual fallback falsely reported that Direct mode was unsafe',
  );
  const solidBackground = selectedTextProperties.getByRole('checkbox', { name: 'Solid background' });
  await solidBackground.waitFor();
  assert.equal(await solidBackground.isChecked(), false);
  assert.ok(
    (await page.getByTestId('replacement-preview-suffix').textContent() || '').length > 0,
    'Visual fallback did not retain the unedited source suffix',
  );
  const suffixBounds = await page.getByTestId('replacement-preview-suffix').boundingBox();
  const replacementMeasureBounds = await page.getByTestId('replacement-preview-content-measure').boundingBox();
  assert.ok(suffixBounds && replacementMeasureBounds, 'selected replacement suffix did not expose measurable bounds');
  assert.ok(
    Math.abs(suffixBounds.x - (replacementMeasureBounds.x + replacementMeasureBounds.width)) <= 1,
    'selected replacement suffix included artificial editor width or padding',
  );
  assert.ok(
    Math.abs(suffixBounds.y - replacementMeasureBounds.y) <= 0.5,
    'selected replacement suffix did not share the replacement baseline',
  );
  const editedUnderlineBounds = await selectionUnderline.boundingBox();
  assert.ok(editedUnderlineBounds, 'edited replacement underline did not expose bounds');
  assert.ok(
    Math.abs(editedUnderlineBounds.width - replacementMeasureBounds.width) <= 1,
    'selection underline did not follow the measured replacement text width',
  );
  assert.equal(await sourceTargets.count(), sourceTargetCount - sourceRunTargetCount);
  await page.screenshot({ path: replacementScreenshotPath, fullPage: true });
  await page.getByRole('region', { name: 'Selected text properties' }).getByRole('button', { name: 'Delete' }).click();
  assert.equal(await sourceTargets.count(), sourceTargetCount, 'deleting a replacement did not restore its source target');
  const undo = page.getByRole('button', { name: 'Undo added element change' });
  const redo = page.getByRole('button', { name: 'Redo added element change' });
  await undo.click();
  assert.equal(await sourceTargets.count(), sourceTargetCount - sourceRunTargetCount, 'Undo did not restore the deleted replacement');

  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const selectedText = page.locator('[role="group"][aria-label^="Selected text on page "]').first();
  await selectedText.waitFor();

  const inlineTextEditor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  await inlineTextEditor.waitFor();
  assert.equal(
    await inlineTextEditor.evaluate(element => document.activeElement === element),
    true,
    'desktop text selection did not focus the on-canvas editor',
  );
  await inlineTextEditor.pressSequentially('Desktop');
  assert.equal(await inlineTextEditor.inputValue(), 'Desktop');
  assert.equal(await page.getByText(/Visual fallback is active/).count(), 0, 'replacement status remained after selecting added text');
  await inlineTextEditor.press('Escape');

  const inspector = page.getByRole('region', { name: 'Selected text properties' });
  const inspectorText = inspector.getByRole('textbox', { name: 'Text', exact: true });
  await inspectorText.selectText();
  await inspectorText.pressSequentially('Inspector grouped');
  await inspectorText.press('Tab');

  await undo.click();
  const canvasText = page.locator('[role="group"][aria-label^="text on page "]').last();
  assert.equal((await canvasText.textContent())?.trim(), 'Desktop', 'one Undo did not revert the inspector typing session');

  await redo.click();
  assert.equal((await canvasText.textContent())?.trim(), 'Inspector grouped', 'Redo did not restore inspector typing');
  await canvasText.click();
  await inlineTextEditor.press('Escape');
  await inspector.waitFor();

  await page.screenshot({ path: screenshotPath, fullPage: true });
  assert.ok(
    await page.evaluate(() => window.__pdfChefWheelTrust.length >= 3 && window.__pdfChefWheelTrust.every(Boolean)),
    'desktop wheel verification did not use trusted browser input',
  );
  assert.deepEqual(consoleErrors, []);

  console.log(JSON.stringify({
    status: 'PASS',
    viewport: '1280x900',
    screenshots: [replacementScreenshotPath, screenshotPath],
    checked: [
      'desktop toolbar layout',
      'Mac trackpad pinch-in and pinch-out inside the PDF viewport',
      'ordinary vertical scrolling stays inside the zoomed PDF box',
      'ordinary trackpad scrolling crosses zoomed page boundaries in both directions',
      'selectable source-text activation and direct replacement typing',
      'middle-word preview baseline alignment with its untouched prefix',
      'word-level source targets and position-locked replacements',
      'long replacement text remains visible on canvas',
      'Enter commits a single-line replacement',
      'automatic replacement backdrop, exact suffix placement, optional solid background, and source-run duplicate suppression',
      'replacement delete restores the source target and Undo restores the replacement',
      'direct on-canvas text focus and typing',
      'one-snapshot inspector typing Undo and Redo',
      'desktop selected-text inspector',
      'no horizontal overflow',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
