import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const pdfPath = '/Users/dhananjaybhosale/Downloads/PDFTools-main/qa-sample.pdf';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = {};

try {
  await page.goto(`${baseUrl}/#/sign`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Sign PDF' }).waitFor({ timeout: 10000 });
  out.navigate = true;

  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.getByText(/Page\s+1\s*\/\s*3/i).first().waitFor({ timeout: 25000 });
  out.upload = true;

  await page.getByRole('button', { name: /Add signature/i }).first().click();
  await page.getByRole('heading', { name: /Create Signature Stamp/i }).waitFor({ timeout: 10000 });
  out.modalOpen = true;

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('signature canvas not found');

  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 90);
  await page.mouse.move(box.x + 280, box.y + 130);
  await page.mouse.up();
  out.drawn = true;

  await page.getByRole('button', { name: /Add Stamp/i }).click();
  await page.getByText(/Stamp\s+1/i).first().waitFor({ timeout: 15000 });
  out.stampAdded = true;

  const select = page.locator('select').first();
  await select.selectOption('1');
  await sleep(300);
  out.selectedPage = await select.inputValue();

  await page.getByRole('button', { name: /^Export$/i }).first().click();
  await sleep(1200);
  out.exportClicked = true;

  out.success = true;
} catch (error) {
  out.success = false;
  out.error = String(error);
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
