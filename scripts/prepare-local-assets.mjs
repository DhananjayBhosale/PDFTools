import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const assets = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'core/tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'core/tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm', 'core/tesseract-core-relaxedsimd-lstm.wasm'],
];

export const prepareLocalAssets = async (targetRoot = resolve(root, 'public/vendor/tesseract')) => {
  for (const [source, destination] of assets) {
    const target = resolve(targetRoot, destination);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, source), target);
  }

  // AAPT decompresses .gz assets and removes their suffix. Prepare that format
  // before Vite/native copying so every platform serves the URL OCR requests.
  const model = gunzipSync(await readFile(resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')));
  await mkdir(resolve(targetRoot, 'lang'), { recursive: true });
  await writeFile(resolve(targetRoot, 'lang/eng.traineddata'), model);
  await rm(resolve(targetRoot, 'lang/eng.traineddata.gz'), { force: true });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareLocalAssets();
  console.log(`Prepared ${assets.length + 1} local OCR assets.`);
}
