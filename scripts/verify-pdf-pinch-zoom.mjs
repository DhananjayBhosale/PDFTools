import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';
const fixture = path.join(process.cwd(), 'qa-sample.pdf');
await fs.access(fixture);

const browser = await chromium.launch({ headless: true });

const verifySurface = async ({ route, label, mobile }) => {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
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
    await page.goto(`${baseUrl}${route}`);
    await page.locator('input[type=file]').setInputFiles(fixture);
    const viewport = page.getByTestId('pdf-zoom-viewport');
    await viewport.waitFor({ state: 'visible', timeout: 60_000 });
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 60_000 });
    assert.equal(await viewport.evaluate(element => getComputedStyle(element).touchAction), 'pan-x pan-y');

    const before = Number(await viewport.getAttribute('data-pdf-zoom'));
    const bounds = await viewport.boundingBox();
    assert.ok(bounds, `${label} did not expose zoom viewport bounds`);
    const centerX = Math.max(80, Math.min((mobile ? 310 : 1200), bounds.x + bounds.width / 2));
    const centerY = Math.max(100, Math.min((mobile ? 700 : 800), bounds.y + Math.min(bounds.height, 500) / 2));

    const dispatchPinch = async direction => {
      const startGap = direction === 'in' ? 30 : 60;
      const endGap = direction === 'in' ? 60 : 30;
      if (!mobile) {
        await viewport.dispatchEvent('wheel', {
          ctrlKey: true,
          deltaY: direction === 'in' ? -20 : 20,
          clientX: centerX,
          clientY: centerY,
        });
        return;
      }
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
    };

    await dispatchPinch('in');

    await page.waitForFunction(
      previous => Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom')) > previous,
      before,
    );
    const after = Number(await viewport.getAttribute('data-pdf-zoom'));
    assert.ok(after > before, `${label} pinch did not increase zoom`);
    await dispatchPinch('out');
    await page.waitForFunction(
      previous => Number(document.querySelector('[data-testid="pdf-zoom-viewport"]')?.getAttribute('data-pdf-zoom')) < previous,
      after,
    );
    const afterOut = Number(await viewport.getAttribute('data-pdf-zoom'));
    assert.ok(afterOut < after, `${label} pinch-out did not decrease zoom`);
    assert.deepEqual(errors, [], `${label} emitted browser errors`);
    return { surface: label, input: mobile ? 'two-touch pinch' : 'Mac trackpad pinch', before, afterIn: after, afterOut };
  } finally {
    await context.close();
  }
};

try {
  const results = [];
  for (const surface of [
    { route: '/view', label: 'Reader desktop', mobile: false },
    { route: '/sign', label: 'Sign PDF desktop', mobile: false },
    { route: '/view', label: 'Reader mobile', mobile: true },
    { route: '/sign', label: 'Sign PDF mobile', mobile: true },
  ]) {
    results.push(await verifySurface(surface));
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  await browser.close();
}
