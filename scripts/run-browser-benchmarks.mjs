import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const fixtureDir = path.join(rootDir, 'benchmarks', 'fixtures');
const baseUrl = process.env.BENCH_BASE_URL || 'http://127.0.0.1:3001';
const benchMode = process.env.BENCH_MODE || 'parallel';

async function readFixture(fileName, type) {
  const bytes = await fs.readFile(path.join(fixtureDir, fileName));
  return {
    fileName,
    type,
    bytes: [...bytes],
  };
}

async function main() {
  const textFixture = await readFixture('text-80-pages.pdf', 'application/pdf');
  const imageFixture = await readFixture('image-12-pages.pdf', 'application/pdf');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(async ({ textFixture, imageFixture, benchMode }) => {
    const module = await import('/services/pdfService.ts');

    const makeFile = ({ bytes, fileName, type }) =>
      new File([new Uint8Array(bytes)], fileName, { type });

    const time = async (label, fn) => {
      const start = performance.now();
      const result = await fn();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return [label, { durationMs, ...result }];
    };

    const textFile = makeFile(textFixture);
    const imageFile = makeFile(imageFixture);

    const runPreview = () => time('getPdfPagePreviews.text80', async () => {
      const previews = await module.getPdfPagePreviews(textFile, { limit: 50 });
      previews.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      return {
        previewCount: previews.length,
      };
    });

    const runRender = () => time('renderPageAsImage.text80.page1', async () => {
      const doc = await module.loadPDFDocument(textFile);
      const image = await module.renderPageAsImage(doc, 0, {
        format: 'image/jpeg',
        quality: 0.8,
        scale: 2,
      });
      if (image.objectUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(image.objectUrl);
      }
      if (benchMode === 'sequential' && doc?.destroy) {
        await doc.destroy();
      }
      return {
        width: image.width,
        height: image.height,
        sizeBytes: image.sizeBytes,
      };
    });

    const runCompression = () => time('compressPDFAdaptive.image12.recommended', async () => {
      const result = await module.compressPDFAdaptive(
        imageFile,
        'recommended',
        () => {},
        false,
        undefined,
        true,
      );
      return {
        status: result.status,
        compressedSize: result.meta.compressedSize,
        projectedDPI: result.meta.projectedDPI,
        strategyUsed: result.meta.strategyUsed,
      };
    });

    const entries = benchMode === 'sequential'
      ? [await runPreview(), await runRender(), await runCompression()]
      : await Promise.all([runPreview(), runRender(), runCompression()]);

    return Object.fromEntries(entries);
  }, { textFixture, imageFixture, benchMode });

  await browser.close();
  console.log(JSON.stringify({
    baseUrl,
    metrics,
  }, null, 2));
}

await main();
