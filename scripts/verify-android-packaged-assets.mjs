import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const packaged = resolve(root, 'android/app/src/main/assets/public');
const allowedGeneratedExtras = new Set(['cordova.js', 'cordova_plugins.js']);
const ignoredMetadataFiles = new Set(['.DS_Store']);

const walk = async (directory) => {
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
const relativePath = (base, path) => relative(base, path).split(sep).join('/');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => { throw new Error(`Android packaged-asset verification failed: ${message}`); };

const distFiles = await walk(dist);
const packagedFiles = await walk(packaged);
const distByPath = new Map(distFiles.map(path => [relativePath(dist, path), path]));
const packagedByPath = new Map(packagedFiles.map(path => [relativePath(packaged, path), path]));
const missing = [...distByPath.keys()].filter(path => !packagedByPath.has(path)).sort();
if (missing.length) fail(`dist files missing from Android assets: ${missing.join(', ')}`);
const unexpected = [...packagedByPath.keys()]
  .filter(path => !distByPath.has(path) && !allowedGeneratedExtras.has(path))
  .sort();
if (unexpected.length) fail(`unexpected Android assets: ${unexpected.join(', ')}`);

for (const [path, distPath] of [...distByPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const [distBytes, packagedBytes] = await Promise.all([readFile(distPath), readFile(packagedByPath.get(path))]);
  if (!distBytes.equals(packagedBytes)) {
    fail(`byte mismatch for ${path}: dist=${sha256(distBytes)} android=${sha256(packagedBytes)}`);
  }
}
for (const extra of [...allowedGeneratedExtras].sort()) {
  const path = packagedByPath.get(extra);
  if (!path) fail(`documented generated extra is missing: ${extra}`);
  if ((await readFile(path)).length !== 0) fail(`documented generated extra must be empty: ${extra}`);
}

console.log(`Android packaged-asset verification passed: ${distByPath.size} byte-identical dist files; ${allowedGeneratedExtras.size} documented empty Cordova extras.`);
