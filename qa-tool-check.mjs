import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const pdfPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sample.pdf';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`);
    }),
  ]);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  async function step(tool, name, fn, timeoutMs = 30000) {
    const id = `${tool}:${name}`;
    console.log(`START ${id}`);
    try {
      const data = await withTimeout(fn(), timeoutMs, id);
      console.log(`PASS ${id}`);
      results.push({ tool, name, ok: true, data });
    } catch (error) {
      console.log(`FAIL ${id} -> ${String(error)}`);
      results.push({ tool, name, ok: false, error: String(error) });
    }
  }

  async function gotoHash(path) {
    await page.goto(`${baseUrl}/#${path}`, { waitUntil: 'domcontentloaded' });
    await sleep(350);
  }

  // Compress flow
  await step('compress', 'navigate', async () => {
    await gotoHash('/compress');
    await page.getByRole('heading', { name: 'Compress PDF' }).waitFor({ timeout: 10000 });
  });

  await step('compress', 'upload', async () => {
    await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
    await page.getByText('Target Size').waitFor({ timeout: 15000 });
  });

  await step('compress', 'open-preview', async () => {
    await page.getByRole('button', { name: /Preview & Tune Quality/i }).click();
    await page.getByRole('heading', { name: /Readability Check/i }).waitFor({ timeout: 10000 });
    return await page.getByText(/Page\s+1\s*\/\s*\d+/i).first().textContent();
  });

  await step('compress', 'preview-nav', async () => {
    await page.getByRole('button', { name: 'Next page' }).first().click();
    await sleep(500);
    const afterNext = await page.getByText(/Page\s+\d+\s*\/\s*\d+/i).first().textContent();
    await page.getByRole('button', { name: 'Previous page' }).first().click();
    await sleep(500);
    const afterPrev = await page.getByText(/Page\s+\d+\s*\/\s*\d+/i).first().textContent();
    return { afterNext, afterPrev };
  });

  await step('compress', 'preview-zoom', async () => {
    await page.getByRole('button', { name: 'Zoom in' }).first().click();
    await sleep(250);
    const zoomValue = await page.locator('span').filter({ hasText: /\d+%/ }).first().textContent();
    await page.getByRole('button', { name: 'Reset zoom' }).first().click();
    return { zoomValue };
  });

  await step('compress', 'apply', async () => {
    await page.getByRole('button', { name: /Apply compression|Use anyway/i }).click();
    await page.getByText(/Compression Successful|No Reduction Possible/i).first().waitFor({ timeout: 25000 });
    return await page.getByText(/Compression Successful|No Reduction Possible/i).first().textContent();
  }, 40000);

  // Sign flow
  await step('sign', 'navigate', async () => {
    await gotoHash('/sign');
    await page.getByRole('heading', { name: 'Sign PDF' }).waitFor({ timeout: 10000 });
  });

  await step('sign', 'upload', async () => {
    await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
    await page.getByText(/Page\s+1\s*\/\s*3/i).first().waitFor({ timeout: 20000 });
  }, 35000);

  await step('sign', 'add-signature', async () => {
    await page.getByRole('button', { name: /Add signature/i }).click();
    await page.getByRole('heading', { name: /Create Signature Stamp/i }).waitFor({ timeout: 8000 });

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('signature canvas not found');

    await page.mouse.move(box.x + 40, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 90);
    await page.mouse.move(box.x + 280, box.y + 120);
    await page.mouse.up();

    await page.getByRole('button', { name: /Add Stamp/i }).click();
    await page.getByText(/Stamp 1/i).first().waitFor({ timeout: 10000 });
  });

  await step('sign', 'page-targeting', async () => {
    const select = page.locator('select').first();
    await select.selectOption('1');
    await sleep(300);
    const selectedValue = await select.inputValue();
    return { selectedValue };
  });

  await step('sign', 'export-click', async () => {
    await page.getByRole('button', { name: /^Export$/i }).first().click();
    await sleep(1200);
  });

  // Page numbers flow
  await step('page-numbers', 'navigate', async () => {
    await gotoHash('/page-numbers');
    await page.getByRole('heading', { name: 'Page Numbers' }).waitFor({ timeout: 10000 });
  });

  await step('page-numbers', 'upload', async () => {
    await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
    await page.getByText(/Live Preview/i).waitFor({ timeout: 20000 });
  }, 35000);

  await step('page-numbers', 'validation', async () => {
    await page.getByLabel('Start page').fill('3');
    await page.getByLabel('End page').fill('1');
    await page.getByText(/Start page must be less than or equal to end page\./i).waitFor({ timeout: 5000 });

    const disabled = await page.getByRole('button', { name: /Add Page Numbers/i }).isDisabled();

    await page.getByLabel('Start page').fill('1');
    await page.getByLabel('End page').fill('3');
    await sleep(300);

    const enabled = !(await page.getByRole('button', { name: /Add Page Numbers/i }).isDisabled());
    return { disabled, enabled };
  });

  await step('page-numbers', 'drag-resize', async () => {
    const overlay = page.locator('div.border-dashed').first();
    const overlayBox = await overlay.boundingBox();
    if (!overlayBox) throw new Error('overlay not found');

    const horizontalLabel = page.locator('label').filter({ hasText: /^Horizontal/ }).first();
    const fontLabel = page.locator('label').filter({ hasText: /^Font size/ }).first();

    const beforeHorizontal = (await horizontalLabel.textContent()) || '';
    const beforeFont = (await fontLabel.textContent()) || '';

    await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(overlayBox.x + overlayBox.width / 2 + 30, overlayBox.y + overlayBox.height / 2 + 10);
    await page.mouse.up();
    await sleep(250);

    const resizeHandle = page.getByRole('button', { name: 'Resize page number' }).first();
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('resize handle not found');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 20);
    await page.mouse.up();
    await sleep(250);

    const afterHorizontal = (await horizontalLabel.textContent()) || '';
    const afterFont = (await fontLabel.textContent()) || '';

    return { beforeHorizontal, afterHorizontal, beforeFont, afterFont };
  });

  await step('page-numbers', 'apply-click', async () => {
    await page.getByRole('button', { name: /Add Page Numbers/i }).click();
    await sleep(1200);
    const err = await page.locator('.bg-rose-600').first().textContent().catch(() => null);
    return { errorToast: err };
  });

  await browser.close();

  const summary = {
    pass: results.filter((r) => r.ok).length,
    fail: results.filter((r) => !r.ok).length,
    results,
    consoleErrors,
  };

  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

const watchdog = setTimeout(() => {
  console.error('Global watchdog timeout reached (180s)');
  process.exit(2);
}, 180000);

run()
  .then(() => clearTimeout(watchdog))
  .catch((error) => {
    clearTimeout(watchdog);
    console.error(error);
    process.exit(1);
  });
