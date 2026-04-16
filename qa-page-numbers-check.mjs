import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const pdfPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sample.pdf';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = {};

try {
  await page.goto(`${baseUrl}/#/page-numbers`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Page Numbers', level: 1 }).waitFor({ timeout: 10000 });
  out.navigate = true;

  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.getByText(/Live Preview/i).waitFor({ timeout: 25000 });
  out.upload = true;

  const startInput = page.locator('label:has-text("Start page") + input');
  const endInput = page.locator('label:has-text("End page") + input');

  await startInput.fill('3');
  await endInput.fill('1');
  await page.getByText(/Start page must be less than or equal to end page\./i).waitFor({ timeout: 5000 });
  out.invalidMessage = true;
  out.applyDisabledWhenInvalid = await page.getByRole('button', { name: /Add Page Numbers/i }).isDisabled();

  await startInput.fill('1');
  await endInput.fill('3');
  await sleep(300);
  out.applyEnabledWhenValid = !(await page.getByRole('button', { name: /Add Page Numbers/i }).isDisabled());

  const horizontalLabel = page.locator('label').filter({ hasText: /^Horizontal/ }).first();
  const fontLabel = page.locator('label').filter({ hasText: /^Font size/ }).first();
  const beforeHorizontal = (await horizontalLabel.textContent()) || '';
  const beforeFont = (await fontLabel.textContent()) || '';

  const overlay = page.locator('div.border-dashed').first();
  const overlayBox = await overlay.boundingBox();
  if (!overlayBox) throw new Error('preview overlay not found');

  await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(overlayBox.x + overlayBox.width / 2 + 35, overlayBox.y + overlayBox.height / 2 + 10);
  await page.mouse.up();
  await sleep(250);

  const handle = page.getByRole('button', { name: 'Resize page number' }).first();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('resize handle not found');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 20, handleBox.y + handleBox.height / 2 + 20);
  await page.mouse.up();
  await sleep(250);

  const afterHorizontal = (await horizontalLabel.textContent()) || '';
  const afterFont = (await fontLabel.textContent()) || '';
  out.dragChangedHorizontal = beforeHorizontal !== afterHorizontal;
  out.resizeChangedFont = beforeFont !== afterFont;
  out.beforeHorizontal = beforeHorizontal;
  out.afterHorizontal = afterHorizontal;
  out.beforeFont = beforeFont;
  out.afterFont = afterFont;

  await page.getByRole('button', { name: /Add Page Numbers/i }).click();
  await sleep(1200);
  const errorToast = await page.locator('.bg-rose-600').first().textContent().catch(() => null);
  out.errorToast = errorToast;

  out.success = true;
} catch (error) {
  out.success = false;
  out.error = String(error);
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
