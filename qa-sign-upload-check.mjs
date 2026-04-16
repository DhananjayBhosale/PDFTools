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
  await page.getByRole('heading', { name: 'Sign PDF' }).waitFor({ timeout: 10000 });
  out.navigate = true;

  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.getByText(/Page\s+1\s*\/\s*3/i).first().waitFor({ timeout: 25000 });
  out.uploadPdf = true;

  await page.getByRole('button', { name: /Add signature/i }).first().click();
  await page.getByRole('heading', { name: /Create Signature Stamp/i }).waitFor({ timeout: 10000 });
  out.modalOpen = true;

  await page.getByRole('button', { name: /^Upload$/i }).click();
  const imageInput = page.locator('input[type="file"]').last();
  await imageInput.setInputFiles(signPath);
  await sleep(700);

  const addBtn = page.getByRole('button', { name: /Add Stamp/i });
  out.addEnabled = await addBtn.isEnabled();
  await addBtn.click();

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
