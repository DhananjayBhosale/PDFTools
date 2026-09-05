import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const baseUrl = process.env.PDF_CHEF_URL || 'http://127.0.0.1:4173';
const overflowMessage = 'Replacement text does not fit on this page. Shorten the text or reduce its size before saving.';
const timeout = 60_000;
const requestedCases = process.argv.slice(2).map(value => value.toLowerCase());
const browser = await chromium.launch({ headless: true });
const results = [];

const createFixture = async lines => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([612, 792]);
  for (const { text, x = 72, y = 700 } of lines) page.drawText(text, { x, y, size: 18, font });
  return Buffer.from(await document.save());
};

const createTransformedFixture = matrix => {
  const content = `BT /F1 18 Tf ${matrix} Tm (Turn target safely) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let source = '%PDF-1.7\n%PDFChef\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { source += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(source);
};

const sourceWord = (page, word) => page.getByRole('button', { name: `Edit existing PDF word: ${word}`, exact: true });
const replacement = page => page.getByTestId('existing-pdf-word-replacement');
const inlineEditor = page => page.getByRole('textbox', { name: 'Edit text on page 1', exact: true });
const saveMode = page => page.getByLabel('Existing text save mode');
const saveButton = page => page.getByRole('button', { name: 'Save', exact: true });
const outputCount = page => page.evaluate(() => window.__pdfChefSafetyOutputs.length);

const load = async (page, name, bytes) => {
  await page.locator('input[type=file][accept=".pdf"]').setInputFiles({ name, mimeType: 'application/pdf', buffer: bytes });
  await page.getByTestId('existing-pdf-text-target').first().waitFor({ timeout });
};

const activate = async (page, word = 'target') => {
  await sourceWord(page, word).click();
  await saveMode(page).waitFor({ timeout });
};

const save = async page => {
  const before = await outputCount(page);
  await saveButton(page).click();
  await page.waitForFunction(previous => window.__pdfChefSafetyOutputs.length > previous, before, { timeout });
  return new Uint8Array(await page.evaluate(async () => Array.from(new Uint8Array(
    await window.__pdfChefSafetyOutputs.at(-1).arrayBuffer(),
  ))));
};

const extractText = async bytes => {
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const text = await page.getTextContent();
    return text.items.filter(item => 'str' in item).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
  } finally {
    await task.destroy();
  }
};

const delayEngine = async page => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let arrived;
  const requested = new Promise(resolve => { arrived = resolve; });
  await page.route('**/pdfium-*.wasm', async route => {
    arrived();
    await gate;
    await route.continue();
  });
  return {
    release,
    requested: async () => {
      let timer;
      try {
        await Promise.race([
          requested,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cold PDFium request did not arrive.')), 15_000); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
};

const check = async (name, run) => {
  if (requestedCases.length && !requestedCases.some(value => name.toLowerCase().includes(value))) return;
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('pdfchef.workspace.settings.v1', JSON.stringify({
      autoDownload: false,
      keepLocalHistory: false,
      confirmLargeJobs: false,
      onboardingComplete: true,
      interfaceFont: 'inter',
    }));
    window.__pdfChefSafetyOutputs = [];
    window.addEventListener('pdfchef:output-ready', event => window.__pdfChefSafetyOutputs.push(event.detail.blob));
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  page.setDefaultTimeout(15_000);
  try {
    await page.goto(`${baseUrl}/edit`);
    await run(page);
    assert.deepEqual(pageErrors, [], 'Unexpected uncaught browser errors');
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({ name, status: 'FAIL', error: String(error), pageErrors });
  } finally {
    await context.close();
  }
};

try {
  await check('Delayed word activation preserves typed note and its Undo history', async page => {
    const engine = await delayEngine(page);
    try {
      await load(page, 'pending-note.pdf', await createFixture([{ text: 'Alpha target safely' }]));
      await sourceWord(page, 'target').click();
      await engine.requested();
      await page.getByRole('toolbar', { name: 'PDF editor tools' }).getByRole('button', { name: 'Text', exact: true }).click();
      await inlineEditor(page).fill('MY IMPORTANT NOTE');
      assert.equal(await inlineEditor(page).inputValue(), 'MY IMPORTANT NOTE');
      engine.release();
      await replacement(page).waitFor({ timeout });
      const note = page.getByTestId('editor-element');
      assert.equal(await note.count(), 1, 'The note was dropped when the pending replacement committed');
      assert.equal((await note.textContent()).trim(), 'MY IMPORTANT NOTE');
      await page.getByRole('button', { name: 'Undo added element change' }).click();
      assert.equal(await replacement(page).count(), 0, 'One Undo should remove the newly activated replacement');
      assert.equal((await note.textContent()).trim(), 'MY IMPORTANT NOTE', 'Undo lost the completed note typing');
      await page.getByRole('button', { name: 'Redo added element change' }).click();
      assert.equal(await replacement(page).count(), 1);
      assert.equal((await note.textContent()).trim(), 'MY IMPORTANT NOTE');
    } finally {
      engine.release();
    }
  });

  await check('Two source runs activating asynchronously both remain present', async page => {
    const engine = await delayEngine(page);
    try {
      await load(page, 'pending-two-runs.pdf', await createFixture([
        { text: 'Alpha first line', y: 700 },
        { text: 'Bravo second line', y: 600 },
      ]));
      await sourceWord(page, 'Alpha').click();
      await engine.requested();
      await sourceWord(page, 'Bravo').click();
      engine.release();
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="existing-pdf-word-replacement"]').length === 2, null, { timeout });
      const words = await replacement(page).evaluateAll(elements => elements.map(element => (
        element.querySelector('textarea')?.value
        ?? element.querySelector('[data-testid="replacement-text-preview"]')?.firstChild?.textContent
      )?.trim()).sort());
      assert.deepEqual(words, ['Alpha', 'Bravo']);
      assert.equal(await sourceWord(page, 'Alpha').count(), 0);
      assert.equal(await sourceWord(page, 'Bravo').count(), 0);
    } finally {
      engine.release();
    }
  });

  await check('Delayed activation cannot enter a newly opened document after Close', async page => {
    const engine = await delayEngine(page);
    try {
      await load(page, 'old-document.pdf', await createFixture([{ text: 'Old target safely' }]));
      await sourceWord(page, 'target').click();
      await engine.requested();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: 'Close editor' }).click();
      await page.setViewportSize({ width: 1280, height: 900 });
      await load(page, 'new-document.pdf', await createFixture([{ text: 'New fresh document' }]));
      await sourceWord(page, 'fresh').click();
      engine.release();
      // Native inspections are serialized. This activation completes only after
      // the stale request has resumed, so no arbitrary post-release delay is needed.
      await saveMode(page).waitFor({ timeout });
      assert.equal(await replacement(page).count(), 1);
      assert.equal(await inlineEditor(page).inputValue(), 'fresh');
      assert.equal(await sourceWord(page, 'New').count(), 0, 'The new source run should be the activated run');
      assert.equal(await outputCount(page), 0);
      assert.equal(await extractText(await save(page)), 'New fresh document');
    } finally {
      engine.release();
    }
  });

  await check('Missing PDFium refuses estimated proportional word boundaries', async page => {
    let requests = 0;
    await page.route('**/pdfium-*.wasm', route => { requests += 1; return route.abort(); });
    await load(page, 'proportional-prefix.pdf', await createFixture([{ text: 'WWWWWW target iii' }]));
    const originalTargets = await page.getByTestId('existing-pdf-text-target').count();
    await sourceWord(page, 'target').click();
    const alert = page.getByRole('alert');
    await alert.waitFor({ timeout });
    assert.ok(requests > 0, 'The intended missing-engine path was not exercised');
    assert.match(await alert.innerText(), /exact boundaries could not be verified/i);
    assert.equal(await replacement(page).count(), 0);
    assert.equal(await page.getByTestId('replacement-source-backdrop').count(), 0, 'An estimated patch was still shown');
    assert.equal(await page.getByTestId('existing-pdf-text-target').count(), originalTargets);
    assert.equal(await outputCount(page), 0);
  });

  for (const [name, matrix] of [
    ['rotated', '0 1 -1 0 300 250'],
    ['skewed', '1 0.25 0 1 72 500'],
  ]) {
    await check(`${name} source offers Direct editing but disables Visual fallback`, async page => {
      await load(page, `${name}-source.pdf`, createTransformedFixture(matrix));
      await activate(page);
      assert.equal(await saveMode(page).inputValue(), 'native');
      assert.equal(await saveMode(page).locator('option[value="native"]').isDisabled(), false);
      const visualOption = saveMode(page).locator('option[value="visual"]');
      const visualState = await visualOption.evaluate(element => ({ disabled: element.disabled, html: element.outerHTML }));
      assert.equal(visualState.disabled, true, JSON.stringify({ visualState, statuses: await page.getByRole('status').allTextContents() }));
      assert.match((await page.getByRole('status').allTextContents()).join(' '), /Visual fallback is unavailable for rotated, skewed, or mirrored source text/);
      await inlineEditor(page).fill('word');
      assert.equal(await extractText(await save(page)), 'Turn word safely');
    });
  }

  for (const mode of ['native', 'visual']) {
    await check(`${mode} overflow blocks output and shorter text saves with the suffix intact`, async page => {
      await load(page, `${mode}-right-edge.pdf`, await createFixture([{ text: 'Start target end', x: 435 }]));
      await activate(page);
      await saveMode(page).selectOption(mode);
      if (mode === 'visual') {
        const status = (await page.getByRole('status').allTextContents()).join(' ');
        assert.match(status, /original text remains searchable and copyable underneath/i);
        assert.match(status, /this is not redaction/i);
      }
      await inlineEditor(page).fill('WIDEREPLACEMENT'.repeat(6));
      await saveButton(page).click();
      await page.getByRole('alert').waitFor({ timeout });
      assert.equal((await page.getByRole('alert').innerText()).trim(), overflowMessage);
      assert.equal(await outputCount(page), 0, 'Overflow must not emit a PDF output');
      assert.equal(await inlineEditor(page).inputValue(), 'WIDEREPLACEMENT'.repeat(6), 'The rejected edit should remain available to correct');
      await inlineEditor(page).fill('ok');
      const extracted = await extractText(await save(page));
      if (mode === 'native') assert.equal(extracted, 'Start ok end');
      else {
        assert.match(extracted, /Start target end/, 'Visual output should retain the disclosed underlying original text');
        assert.match(extracted, /ok end/, 'The shorter replacement and untouched suffix should both be exported');
      }
      assert.equal(await outputCount(page), 1);
    });
  }

  const failures = results.filter(result => result.status === 'FAIL');
  assert.ok(results.length > 0, 'No safety cases matched the requested filter');
  console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', baseUrl, checks: results }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
