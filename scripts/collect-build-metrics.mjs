import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'dist', 'assets');

function formatKb(value) {
  return Math.round((value / 1024) * 100) / 100;
}

async function main() {
  const files = await fs.readdir(assetsDir);
  const jsFiles = files.filter((file) => file.endsWith('.js'));
  const entries = [];

  for (const file of jsFiles) {
    const absPath = path.join(assetsDir, file);
    const buffer = await fs.readFile(absPath);
    entries.push({
      file,
      sizeKb: formatKb(buffer.length),
      gzipKb: formatKb(gzipSync(buffer).length),
    });
  }

  entries.sort((a, b) => b.sizeKb - a.sizeKb);

  const totalSizeKb = entries.reduce((sum, entry) => sum + entry.sizeKb, 0);
  const totalGzipKb = entries.reduce((sum, entry) => sum + entry.gzipKb, 0);

  console.log(JSON.stringify({
    totalJsSizeKb: Math.round(totalSizeKb * 100) / 100,
    totalJsGzipKb: Math.round(totalGzipKb * 100) / 100,
    largestChunks: entries.slice(0, 10),
  }, null, 2));
}

await main();
