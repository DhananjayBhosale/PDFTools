import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import JSZip from 'jszip';
import { prepareLocalAssets } from '../../scripts/prepare-local-assets.mjs';
import { verifyAndroidApkAssets } from '../../scripts/verify-android-apk-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = resolve(root, 'output/p2-fixes-2026-09-05/ocr');
const modelPath = 'vendor/tesseract/lang/eng.traineddata';
const oldModelPath = `${modelPath}.gz`;

const temporaryRoot = async () => {
  await mkdir(outputRoot, { recursive: true });
  return mkdtemp(join(outputRoot, 'assets-test-'));
};

test('OCR preparation packages the uncompressed model and removes the obsolete gzip URL', async () => {
  const temporary = await temporaryRoot();
  try {
    await mkdir(resolve(temporary, 'lang'), { recursive: true });
    await writeFile(resolve(temporary, 'lang/eng.traineddata.gz'), 'stale compressed model');
    await prepareLocalAssets(temporary);
    const source = await readFile(resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'));
    assert.deepEqual(await readFile(resolve(temporary, 'lang/eng.traineddata')), gunzipSync(source));
    assert.deepEqual(await readdir(resolve(temporary, 'lang')), ['eng.traineddata']);
    assert.match(await readFile(resolve(root, 'components/Tools/OCRPDF.tsx'), 'utf8'), /gzip: false/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

const withApkFixture = async (run: (fixture: {
  zip: JSZip;
  apkPath: string;
  dist: string;
  save: () => Promise<void>;
}) => Promise<void>) => {
  const temporary = await temporaryRoot();
  const dist = resolve(temporary, 'dist');
  const apkPath = resolve(temporary, 'test.apk');
  const zip = new JSZip();
  try {
    for (const [path, bytes] of [
      ['index.html', '<script src="/assets/app.js"></script>'],
      ['sw.js', 'offline fixture'],
      ['assets/app.js', 'fixture application'],
      [modelPath, 'uncompressed model fixture'],
    ]) {
      await mkdir(dirname(resolve(dist, path)), { recursive: true });
      await writeFile(resolve(dist, path), bytes);
      zip.file(`assets/public/${path}`, bytes);
    }
    for (const shim of ['cordova.js', 'cordova_plugins.js']) zip.file(`assets/public/${shim}`, '');
    zip.file('AndroidManifest.xml', 'native metadata is outside web asset scope');
    const save = async () => {
      await writeFile(apkPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    };
    await run({ zip, apkPath, dist, save });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};

test('final APK verifier accepts exact URLs and bytes with only documented empty shims and metadata', async () => {
  await withApkFixture(async ({ zip, apkPath, dist, save }) => {
    zip.file('assets/public/vendor/.DS_Store', 'Finder metadata');
    await save();
    const result = await verifyAndroidApkAssets(apkPath, dist);
    assert.equal(result.assetCount, 4);
    assert.match(result.apkSha256, /^[a-f0-9]{64}$/);
    assert.match(result.identity, /^[a-f0-9]{64}$/);
  });
});

test('final APK verifier rejects the historical gzip URL transformation despite identical decompressed content', async () => {
  await withApkFixture(async ({ apkPath, dist, save }) => {
    // Before the fix dist requested .gz, while AAPT emitted the model without it.
    await rm(resolve(dist, modelPath));
    await writeFile(resolve(dist, oldModelPath), gzipSync(Buffer.from('uncompressed model fixture')));
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /required URLs missing from APK: \/vendor\/tesseract\/lang\/eng\.traineddata\.gz/);
  });
});

test('final APK verifier rejects a model renamed or changed after native source copying', async () => {
  await withApkFixture(async ({ zip, apkPath, dist, save }) => {
    zip.remove(`assets/public/${modelPath}`);
    zip.file(`assets/public/${oldModelPath}`, 'uncompressed model fixture');
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /required URLs missing from APK/);
    zip.remove(`assets/public/${oldModelPath}`);
    zip.file(`assets/public/${modelPath}`, 'changed model fixture');
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /byte mismatch for \/vendor\/tesseract\/lang\/eng\.traineddata/);
  });
});

test('final APK verifier rejects stale public files and nonempty or missing Cordova shims', async () => {
  await withApkFixture(async ({ zip, apkPath, dist, save }) => {
    zip.file(`assets/public/${oldModelPath}`, 'stale model');
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /unexpected public assets in APK/);
    zip.remove(`assets/public/${oldModelPath}`);
    zip.file('assets/public/cordova.js', 'unexpected plugin runtime');
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /generated shim must be empty: cordova.js/);
    zip.remove('assets/public/cordova.js');
    await save();
    await assert.rejects(verifyAndroidApkAssets(apkPath, dist), /documented generated shim is missing: cordova.js/);
  });
});
