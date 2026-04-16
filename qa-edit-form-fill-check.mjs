import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:4173/#/edit';

const createFixture = async () => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('First name', { x: 72, y: 700, size: 12, font });
  const firstName = form.createTextField('first_name');
  firstName.addToPage(page, { x: 160, y: 686, width: 180, height: 24 });

  page.drawText('Subscribe', { x: 72, y: 650, size: 12, font });
  const subscribe = form.createCheckBox('subscribe');
  subscribe.addToPage(page, { x: 160, y: 646, width: 18, height: 18 });

  page.drawText('Role', { x: 72, y: 600, size: 12, font });
  const role = form.createDropdown('role');
  role.addOptions(['Designer', 'Engineer', 'Manager']);
  role.select('Engineer');
  role.addToPage(page, { x: 160, y: 586, width: 180, height: 24 });

  const fixturePath = path.join(os.tmpdir(), `pdfchef-form-${Date.now()}.pdf`);
  await fs.writeFile(fixturePath, await pdfDoc.save());
  return fixturePath;
};

const readSavedValues = async (pdfPath) => {
  const pdfDoc = await PDFDocument.load(await fs.readFile(pdfPath));
  const form = pdfDoc.getForm();

  return {
    firstName: form.getTextField('first_name').getText(),
    subscribe: form.getCheckBox('subscribe').isChecked(),
    role: form.getDropdown('role').getSelected(),
  };
};

const fixturePath = await createFixture();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
await context.addInitScript(() => {
  try {
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: undefined,
      configurable: true,
    });
  } catch {}
});
const page = await context.newPage();

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.setInputFiles('input[type="file"]', fixturePath);

  await page.waitForSelector('[data-testid="pdf-form-field"][data-field-name="first_name"]', { timeout: 15000 });
  await page.fill('[data-testid="pdf-form-field"][data-field-name="first_name"]', 'Alicia');
  await page.check('[data-testid="pdf-form-field"][data-field-name="subscribe"]');
  await page.selectOption('[data-testid="pdf-form-field"][data-field-name="role"]', 'Manager');

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: /save/i }).click();
  const download = await downloadPromise;
  const savedPath = await download.path();
  assert.ok(savedPath, 'expected saved PDF download path');

  const values = await readSavedValues(savedPath);
  assert.equal(values.firstName, 'Alicia');
  assert.equal(values.subscribe, true);
  assert.deepEqual(values.role, ['Manager']);

  console.log(JSON.stringify({ ok: true, values }, null, 2));
} finally {
  await browser.close();
  await fs.rm(fixturePath, { force: true });
}
