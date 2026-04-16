import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const pdfPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sample.pdf';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = {};

try {
  await page.goto(`${baseUrl}/#/compress`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Compress PDF' }).waitFor({ timeout: 10000 });
  out.navigate = true;

  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.getByText('Target Size').waitFor({ timeout: 15000 });
  out.upload = true;

  await page.getByRole('button', { name: /Preview & Tune Quality/i }).click();
  await page.getByRole('heading', { name: /Readability Check/i }).waitFor({ timeout: 10000 });
  out.openPreview = true;

  const beforeLabels = await page.getByText(/Page\s+\d+\s*\/\s*\d+/i).allTextContents();
  out.pageLabelsBefore = beforeLabels;

  const nextButtons = page.locator('button[aria-label="Next page"]');
  const count = await nextButtons.count();
  out.nextButtonCount = count;

  let clicked = false;
  for (let i = count - 1; i >= 0; i -= 1) {
    const btn = nextButtons.nth(i);
    const box = await btn.boundingBox();
    if (!box) continue;
    await btn.click({ timeout: 5000 });
    clicked = true;
    break;
  }
  out.nextClicked = clicked;

  await sleep(700);
  const afterLabels = await page.getByText(/Page\s+\d+\s*\/\s*\d+/i).allTextContents();
  out.pageLabelsAfter = afterLabels;

  const zoomButtons = page.locator('button[aria-label="Zoom in"]');
  out.zoomButtonCount = await zoomButtons.count();
  let zoomClicked = false;
  for (let i = (await zoomButtons.count()) - 1; i >= 0; i -= 1) {
    const btn = zoomButtons.nth(i);
    const box = await btn.boundingBox();
    if (!box) continue;
    await btn.click({ timeout: 5000 });
    zoomClicked = true;
    break;
  }
  out.zoomClicked = zoomClicked;

  const zoomTexts = await page.locator('span').filter({ hasText: /\d+%/ }).allTextContents();
  out.zoomTexts = zoomTexts;

  const applyButtons = page.getByRole('button', { name: /Apply compression|Use anyway/i });
  out.applyButtonCount = await applyButtons.count();
  let applyClicked = false;
  for (let i = (await applyButtons.count()) - 1; i >= 0; i -= 1) {
    const btn = applyButtons.nth(i);
    const box = await btn.boundingBox();
    if (!box) continue;
    await btn.click({ timeout: 5000 });
    applyClicked = true;
    break;
  }
  out.applyClicked = applyClicked;

  await page.getByText(/Compression Successful|No Reduction Possible/i).first().waitFor({ timeout: 30000 });
  out.applyResult = await page.getByText(/Compression Successful|No Reduction Possible/i).first().textContent();

  out.success = true;
} catch (error) {
  out.success = false;
  out.error = String(error);
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
