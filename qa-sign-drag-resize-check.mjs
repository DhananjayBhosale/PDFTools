import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const pdfPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sample.pdf';
const signPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sign.png';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = {};

try {
  await page.goto(`${baseUrl}/#/sign`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.getByText(/Page\s+1\s*\/\s*3/i).first().waitFor({ timeout: 25000 });

  await page.getByRole('button', { name: /Add signature/i }).first().click();
  await page.getByRole('button', { name: /^Upload$/i }).click();
  await page.locator('input[type="file"]').last().setInputFiles(signPath);
  await sleep(600);
  await page.getByRole('button', { name: /Add Stamp/i }).click();
  await page.getByText(/Stamp\s+1/i).first().waitFor({ timeout: 15000 });

  const overlay = page.locator('div.absolute.z-20.cursor-move').first();
  const beforeStyle = await overlay.getAttribute('style');

  const ob = await overlay.boundingBox();
  if (!ob) throw new Error('overlay not found');
  await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
  await page.mouse.down();
  await page.mouse.move(ob.x + ob.width / 2 + 30, ob.y + ob.height / 2 + 20);
  await page.mouse.up();
  await sleep(300);

  const afterDragStyle = await overlay.getAttribute('style');

  const resizeBtn = page.locator('button[aria-label="Resize signature"]').first();
  const rb = await resizeBtn.boundingBox();
  if (!rb) throw new Error('resize button not found');
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width / 2 + 35, rb.y + rb.height / 2 + 10);
  await page.mouse.up();
  await sleep(300);

  const afterResizeStyle = await overlay.getAttribute('style');

  out.beforeStyle = beforeStyle;
  out.afterDragStyle = afterDragStyle;
  out.afterResizeStyle = afterResizeStyle;
  out.dragChanged = beforeStyle !== afterDragStyle;
  out.resizeChanged = afterDragStyle !== afterResizeStyle;
  out.success = true;
} catch (error) {
  out.success = false;
  out.error = String(error);
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
