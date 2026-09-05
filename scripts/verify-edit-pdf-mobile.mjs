import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';
const root = process.cwd();
const fixture = path.join(root, 'qa-sample.pdf');
const outputDir = path.join(root, 'output', 'edit-pdf-mobile-verification');
const screenshotPath = path.join(outputDir, 'edit-pdf-selected-mobile.png');
const inlineTextScreenshotPath = path.join(outputDir, 'edit-pdf-inline-text-mobile.png');
const replacementScreenshotPath = path.join(outputDir, 'edit-existing-pdf-text-mobile.png');

await fs.access(fixture);
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
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

const selected = type => page.locator(`[role="group"][aria-label^="Selected ${type} "]`);
const canvas = () => page.locator('canvas').first();
const touchscreenPinch = async (direction) => {
  const viewport = page.getByTestId('pdf-zoom-viewport');
  const bounds = await viewport.boundingBox();
  assert.ok(bounds, 'PDF zoom viewport did not expose bounds');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = Math.max(80, Math.min(760, bounds.y + Math.min(bounds.height, 480) / 2));
  const before = Number(await viewport.getAttribute('data-pdf-zoom'));
  const startGap = direction === 'in' ? 36 : 72;
  const endGap = direction === 'in' ? 72 : 36;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: centerX - startGap, y: centerY },
      { x: centerX + startGap, y: centerY },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: centerX - endGap, y: centerY },
      { x: centerX + endGap, y: centerY },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForFunction(
    ({ expectedDirection, previous }) => {
      const value = Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom'));
      return expectedDirection === 'in' ? value > previous : value < previous;
    },
    { expectedDirection: direction, previous: before },
  );
  await page.waitForTimeout(300);
  return Number(await viewport.getAttribute('data-pdf-zoom'));
};
const touchscreenScrollDown = async () => {
  const viewport = page.getByTestId('pdf-zoom-viewport');
  const bounds = await viewport.boundingBox();
  assert.ok(bounds, 'mobile PDF scroll viewport did not expose bounds');
  const before = await viewport.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
    windowScrollY: window.scrollY,
  }));
  assert.equal(before.overflowY, 'auto', 'mobile PDF box does not own vertical scrolling');
  assert.ok(before.scrollHeight > before.clientHeight, 'zoomed mobile PDF does not overflow inside its box');
  const x = bounds.x + bounds.width / 2;
  const startY = Math.min(bounds.y + bounds.height - 48, bounds.y + 300);
  const endY = Math.max(bounds.y + 48, startY - 180);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: (startY + endY) / 2 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y: endY }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForFunction(
    previous => (document.querySelector('[data-testid="pdf-zoom-viewport"]'))?.scrollTop > previous,
    before.scrollTop,
  );
  await viewport.evaluate(element => new Promise(resolve => {
    let previous = element.scrollTop;
    let stableFrames = 0;
    const check = () => {
      const current = element.scrollTop;
      stableFrames = Math.abs(current - previous) < 0.25 ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 4) resolve(undefined);
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
  assert.equal(await page.evaluate(() => window.scrollY), before.windowScrollY, 'touch-scrolling the PDF moved the app page');
};
const upload = async () => {
  if (page.url() === 'about:blank') {
    await page.goto(baseUrl);
    await page.locator('a[href="/edit"]').first().click();
  } else {
    await page.goto(`${baseUrl}/edit`);
  }
  await page.getByRole('heading', { name: /Edit PDF/ }).waitFor();
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(fixture);
  await canvas().waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByRole('button', { name: 'Close editor' }).waitFor();
};

const place = async type => {
  await page.getByRole('button', { name: type === 'text' ? 'Text' : 'Shape', exact: true }).click();
  const bounds = await canvas().boundingBox();
  assert.ok(bounds, 'PDF canvas did not expose bounds');
  await page.mouse.click(
    bounds.x + bounds.width * (type === 'text' ? 0.35 : 0.62),
    bounds.y + bounds.height * (type === 'text' ? 0.32 : 0.58),
  );
  await selected(type === 'shape' ? 'rectangle' : type).waitFor();
};

try {
  await upload();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const touchZoomedIn = await touchscreenPinch('in');
  await touchscreenScrollDown();
  const touchZoomedOut = await touchscreenPinch('out');
  assert.ok(touchZoomedIn > 1, 'touchscreen pinch-in did not increase PDF zoom');
  assert.ok(touchZoomedOut < touchZoomedIn, 'touchscreen pinch-out did not decrease PDF zoom');

  const currentPage = page.getByLabel('Current editor page');
  await page.locator('[data-testid="existing-pdf-text-target"]').first().waitFor({ timeout: 60_000 });
  const firstPageTargetLabels = await page.locator('[data-testid="existing-pdf-text-target"]').evaluateAll(
    targets => targets.map(target => target.getAttribute('aria-label')),
  );
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Current editor page"]')?.value === '1');
  await page.getByRole('group', { name: /Page 2 of/ }).waitFor({ state: 'visible' });
  assert.equal(await currentPage.inputValue(), '1');
  const secondPageTargetLabels = await page.locator('[data-testid="existing-pdf-text-target"]').evaluateAll(
    targets => targets.map(target => target.getAttribute('aria-label')),
  );
  assert.notDeepEqual(secondPageTargetLabels, firstPageTargetLabels, 'Next page did not render a different PDF page');
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Current editor page"]')?.value === '0');
  await page.getByRole('group', { name: /Page 1 of/ }).waitFor({ state: 'visible' });
  assert.equal(await currentPage.inputValue(), '0');

  const sourceTextTarget = page.locator('[data-testid="existing-pdf-text-target"][aria-label="Edit existing PDF word: PDF"]').first();
  await sourceTextTarget.waitFor({ timeout: 60_000 });
  const sourceTargets = page.locator('[data-testid="existing-pdf-text-target"]');
  const sourceTargetCount = await sourceTargets.count();
  const sourceRunId = await sourceTextTarget.getAttribute('data-source-run-id');
  assert.ok(sourceRunId, 'source word did not expose a PDF run identity');
  const sourceRunTargetCount = await sourceTargets.evaluateAll(
    (targets, runId) => targets.filter(target => target.getAttribute('data-source-run-id') === runId).length,
    sourceRunId,
  );
  assert.ok(sourceRunTargetCount > 1, 'fixture did not expose multiple words from one PDF source run');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  assert.equal(await sourceTextTarget.evaluate(element => getComputedStyle(element).pointerEvents), 'none');
  assert.equal(await sourceTextTarget.evaluate(element => element.tabIndex), -1);
  await page.getByRole('button', { name: 'Text', exact: true }).click();
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
  const suffix = page.getByTestId('replacement-preview-suffix');
  assert.equal(await suffix.count(), 1, 'Direct-text replacement did not preserve its source suffix');
  const suffixBounds = await suffix.boundingBox();
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
  await page.screenshot({ path: replacementScreenshotPath, fullPage: true });
  assert.equal(
    await sourceTargets.count(),
    sourceTargetCount - sourceRunTargetCount,
    'edited PDF source run remained an active duplicate target',
  );

  await place('text');
  const undo = page.getByRole('button', { name: 'Undo added element change' });
  const redo = page.getByRole('button', { name: 'Redo added element change' });
  const inlineTextEditor = page.getByRole('textbox', { name: 'Edit text on page 1' });
  await inlineTextEditor.waitFor();
  assert.equal(
    await inlineTextEditor.evaluate(element => document.activeElement === element),
    true,
    'selecting placed text did not focus its inline editor',
  );
  await inlineTextEditor.pressSequentially('Dhananajay');
  assert.equal(await inlineTextEditor.inputValue(), 'Dhananajay');
  await page.screenshot({ path: inlineTextScreenshotPath, fullPage: true });
  await inlineTextEditor.press('Escape');
  assert.equal(
    await inlineTextEditor.evaluate(element => document.activeElement === element),
    false,
    'Escape did not leave inline editing',
  );
  await undo.click();
  const canvasText = page.locator('[role="group"][aria-label^="text on page "]').last();
  assert.equal((await canvasText.textContent())?.trim(), 'Text', 'one Undo did not revert the inline typing session');
  await redo.click();
  await canvasText.click();
  assert.equal(await inlineTextEditor.inputValue(), 'Dhananajay', 'Redo did not restore inline text');

  await place('shape');
  const replacementPreview = page.getByTestId('replacement-text-preview');
  assert.equal(await replacementPreview.evaluate(element => getComputedStyle(element).whiteSpace), 'pre');
  assert.equal(
    await replacementPreview.evaluate(element => element.scrollHeight <= element.clientHeight + 1),
    true,
    'deselected replacement wrapped onto another line',
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await undo.click();
  await assert.rejects(selected('rectangle').waitFor({ state: 'visible', timeout: 500 }));
  await page.locator('[role="group"][aria-label^="text on page "]').last().click();
  await selected('text').waitFor();
  assert.equal(await redo.isEnabled(), true, 'selection-only tap cleared Redo');
  await redo.click();
  await page.locator('[role="group"][aria-label^="rectangle on page "]').waitFor();

  await page.locator('[role="group"][aria-label^="text on page "]').last().click();
  const text = selected('text');
  await text.focus();
  const textStart = await text.evaluate(element => element.style.left);
  await text.dispatchEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: false });
  for (let index = 0; index < 100; index += 1) {
    await text.dispatchEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: true });
  }
  const textMoved = await text.evaluate(element => element.style.left);
  assert.notEqual(textMoved, textStart, 'keyboard movement did not move the selected element');
  await undo.click();
  assert.equal(
    await page.locator('[role="group"][aria-label^="text on page "]').last().evaluate(element => element.style.left),
    textStart,
  );

  await page.locator('[role="group"][aria-label^="rectangle on page "]').click();
  const rectangle = selected('rectangle');
  await rectangle.focus();
  const resize = rectangle.getByRole('button', { name: 'Resize selected element with arrow keys' });
  const widthStart = await rectangle.evaluate(element => element.style.width);
  await resize.dispatchEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight', repeat: false });
  const widthChanged = await rectangle.evaluate(element => element.style.width);
  assert.notEqual(widthChanged, widthStart, 'keyboard resize did not change the selected element');
  await undo.click();
  assert.equal(
    await page.locator('[role="group"][aria-label^="rectangle on page "]').evaluate(element => element.style.width),
    widthStart,
  );

  let closePrompt = '';
  page.once('dialog', async dialog => {
    closePrompt = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Close editor' }).click();
  assert.match(closePrompt, /Discard your unsaved edits/);
  await canvas().waitFor({ state: 'visible' });

  await page.locator('#main').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Edited PDF ready. Review it before sharing.').waitFor({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Close editor' }).click();
  await page.getByText('Choose a PDF to edit').waitFor();

  await page.locator('input[type=file][accept=".pdf"]').setInputFiles(fixture);
  await canvas().waitFor({ state: 'visible', timeout: 60_000 });
  await place('text');
  await page.evaluate(() => {
    localStorage.setItem('pdfchef.workspace.settings.v1', JSON.stringify({
      autoDownload: false,
      keepLocalHistory: true,
      confirmLargeJobs: false,
      largeFileWarningMb: 80,
      onboardingComplete: true,
      interfaceFont: 'inter',
    }));
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
  });
  await page.locator('#main').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Unable to save the edited PDF. Your edits are still here so you can try again.').waitFor();
  let failurePrompt = '';
  page.once('dialog', async dialog => {
    failurePrompt = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Close editor' }).click();
  assert.match(failurePrompt, /Discard your unsaved edits/);
  await canvas().waitFor({ state: 'visible' });

  const unexpectedErrors = consoleErrors.filter(message => !message.includes('Local history is unavailable'));
  assert.deepEqual(unexpectedErrors, []);
  console.log(JSON.stringify({
    status: 'PASS',
    viewport: '390x844',
    screenshots: [replacementScreenshotPath, inlineTextScreenshotPath, screenshotPath],
    checked: [
      'touchscreen pinch-in and pinch-out inside the PDF viewport',
      'one-finger vertical scrolling stays inside the zoomed PDF box',
      'visible Next and Previous page controls render different PDF pages',
      'selectable source-text activation and direct replacement typing',
      'word-level source targets and position-locked replacements',
      'insert mode bypasses selectable source-text targets',
      'long replacement text remains visible on canvas',
      'Enter commits a single-line replacement',
      'edited source-run duplicate suppression',
      'text and shape placement',
      'direct inline text focus, typing, Escape, Undo, and Redo',
      'selection preserves Redo',
      'keyboard move and resize undo',
      'dirty Close cancellation',
      'successful save clears dirty baseline',
      'failed delivery preserves dirty baseline',
      'no horizontal overflow',
    ],
  }, null, 2));
} finally {
  await browser.close();
}
