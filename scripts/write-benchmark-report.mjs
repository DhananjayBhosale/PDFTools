import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const resultsDir = path.join(rootDir, 'benchmarks', 'results');

function formatPercentDelta(before, after) {
  if (!before) return 'n/a';
  const delta = ((after - before) / before) * 100;
  const rounded = Math.round(delta * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function metricLine(label, before, after, unit = '') {
  return `- ${label}: ${before}${unit} -> ${after}${unit} (${formatPercentDelta(before, after)})`;
}

async function readJson(fileName) {
  const filePath = path.join(resultsDir, fileName);
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function main() {
  const [baselineBrowser, baselineBuild, afterBrowser, afterBuild] = await Promise.all([
    readJson('baseline-browser.json'),
    readJson('baseline-build.json'),
    readJson('after-browser.json'),
    readJson('after-build.json'),
  ]);

  const lines = [
    '# Eval Report',
    '',
    '## Scope',
    '- PDF Chef runtime, UX, and frontend overhaul',
    '',
    '## Capability Results',
    metricLine(
      'Preview generation time',
      baselineBrowser.metrics['getPdfPagePreviews.text80'].durationMs,
      afterBrowser.metrics['getPdfPagePreviews.text80'].durationMs,
      ' ms',
    ),
    metricLine(
      'Preview count on 80-page fixture',
      baselineBrowser.metrics['getPdfPagePreviews.text80'].previewCount,
      afterBrowser.metrics['getPdfPagePreviews.text80'].previewCount,
    ),
    metricLine(
      'First-page image render time',
      baselineBrowser.metrics['renderPageAsImage.text80.page1'].durationMs,
      afterBrowser.metrics['renderPageAsImage.text80.page1'].durationMs,
      ' ms',
    ),
    metricLine(
      'Compression time',
      baselineBrowser.metrics['compressPDFAdaptive.image12.recommended'].durationMs,
      afterBrowser.metrics['compressPDFAdaptive.image12.recommended'].durationMs,
      ' ms',
    ),
    '',
    '## Regression Results',
    metricLine(
      'Compressed fixture size',
      baselineBrowser.metrics['compressPDFAdaptive.image12.recommended'].compressedSize,
      afterBrowser.metrics['compressPDFAdaptive.image12.recommended'].compressedSize,
      ' bytes',
    ),
    metricLine(
      'Total JS output',
      baselineBuild.totalJsSizeKb,
      afterBuild.totalJsSizeKb,
      ' kB',
    ),
    metricLine(
      'Total JS gzip',
      baselineBuild.totalJsGzipKb,
      afterBuild.totalJsGzipKb,
      ' kB',
    ),
    metricLine(
      'Largest chunk gzip',
      baselineBuild.largestChunks[0].gzipKb,
      afterBuild.largestChunks[0].gzipKb,
      ' kB',
    ),
    '',
    '## Metrics',
    `- Baseline largest chunk: ${baselineBuild.largestChunks[0].file}`,
    `- After largest chunk: ${afterBuild.largestChunks[0].file}`,
    '',
    '## Failures',
    '- None recorded in the generated report. Inspect command output if a validation step failed.',
    '',
    '## Release Verdict',
    '- Pending final manual review and validation command results.',
    '',
  ];

  const reportPath = path.join(rootDir, '.planning', 'evals', 'pdf-runtime-ui-overhaul-report.md');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, lines.join('\n'));

  console.log(reportPath);
}

await main();
