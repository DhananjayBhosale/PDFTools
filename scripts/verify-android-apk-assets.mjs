import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicPrefix = 'assets/public/';
const generatedShims = new Set(['cordova.js', 'cordova_plugins.js']);
const ignoredMetadataFiles = new Set(['.DS_Store']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`Android APK asset verification failed: ${message}`); };

const walk = async directory => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredMetadataFiles.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
    else fail(`non-file entry is not allowed: ${absolute}`);
  }
  return files;
};

// Check the actual archive, after AAPT has transformed and compressed assets.
// The native source-copy verifier alone cannot establish these request URLs.
export const verifyAndroidApkAssets = async (apkPath, distDirectory = resolve(root, 'dist')) => {
  const sourceFiles = new Map((await walk(distDirectory)).map(path => [
    relative(distDirectory, path).split(sep).join('/'), path,
  ]));
  for (const required of ['index.html', 'sw.js']) {
    if (!sourceFiles.has(required)) fail(`required dist URL is missing: /${required}`);
  }

  const apkBytes = await readFile(apkPath);
  // ZIP readers can choose different members when a name is duplicated. Do
  // not let JSZip's last-entry lookup hide an ambiguous runtime asset.
  const names = execFileSync('unzip', ['-Z1', apkPath], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split('\n').filter(name => name.startsWith(publicPrefix) && !name.endsWith('/'));
  if (new Set(names).size !== names.length) fail('duplicate public asset names in APK');
  const archive = await JSZip.loadAsync(apkBytes);
  const packagedFiles = new Map();
  for (const name of names) {
    const path = name.slice(publicPrefix.length);
    if (ignoredMetadataFiles.has(basename(path))) continue;
    const entry = archive.files[name];
    if (!entry || entry.dir || entry.unsafeOriginalName !== name) fail(`ambiguous APK asset path: ${name}`);
    packagedFiles.set(path, entry);
  }

  const missing = [...sourceFiles.keys()].filter(path => !packagedFiles.has(path)).sort();
  if (missing.length) fail(`required URLs missing from APK: ${missing.map(path => `/${path}`).join(', ')}`);
  const unexpected = [...packagedFiles.keys()]
    .filter(path => !sourceFiles.has(path) && !generatedShims.has(path)).sort();
  if (unexpected.length) fail(`unexpected public assets in APK: ${unexpected.join(', ')}`);

  const identityEntries = [];
  for (const [path, sourcePath] of [...sourceFiles.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const sourceBytes = await readFile(sourcePath);
    const packagedBytes = await packagedFiles.get(path).async('nodebuffer');
    if (!sourceBytes.equals(packagedBytes)) {
      fail(`byte mismatch for /${path}: dist=${sha256(sourceBytes)} apk=${sha256(packagedBytes)}`);
    }
    identityEntries.push(`${path}\0${sha256(sourceBytes)}`);
  }
  for (const shim of generatedShims) {
    const entry = packagedFiles.get(shim);
    if (!entry) fail(`documented generated shim is missing: ${shim}`);
    if ((await entry.async('nodebuffer')).length !== 0) fail(`generated shim must be empty: ${shim}`);
  }

  return {
    apkSha256: sha256(apkBytes),
    assetCount: sourceFiles.size,
    identity: sha256(Buffer.from(identityEntries.join('\n'))),
    generatedShims: [...generatedShims],
  };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) fail('usage: node scripts/verify-android-apk-assets.mjs <apk-path>');
  const dist = process.env.PDF_CHEF_DIST_DIR ? resolve(process.env.PDF_CHEF_DIST_DIR) : resolve(root, 'dist');
  const result = await verifyAndroidApkAssets(resolve(process.argv[2]), dist);
  console.log(`Android APK asset verification passed: ${result.assetCount} byte-identical dist URLs; identity=${result.identity}; apkSha256=${result.apkSha256}.`);
}
