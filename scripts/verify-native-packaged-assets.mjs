import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const targets = [
  { label: 'Android', path: resolve(root, 'android/app/src/main/assets/public') },
  { label: 'iOS', path: resolve(root, 'ios/App/App/public') },
];
const generatedExtras = new Set(['cordova.js', 'cordova_plugins.js']);
const ignoredMetadataFiles = new Set(['.DS_Store']);

const relativePath = (base, path) => relative(base, path).split(sep).join('/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`Native packaged-asset verification failed: ${message}`); };

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

const fileMap = async directory => new Map(
  (await walk(directory)).map(path => [relativePath(directory, path), path]),
);

const identity = async paths => {
  const entries = [];
  for (const [path, absolute] of [...paths.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    entries.push(`${path}\0${sha256(await readFile(absolute))}`);
  }
  return sha256(Buffer.from(entries.join('\n')));
};

const verifyTree = async (label, source, packaged) => {
  const sourceFiles = await fileMap(source);
  const packagedFiles = await fileMap(packaged);
  const missing = [...sourceFiles.keys()].filter(path => !packagedFiles.has(path)).sort();
  if (missing.length) fail(`${label} is missing dist files: ${missing.join(', ')}`);

  const unexpected = [...packagedFiles.keys()]
    .filter(path => !sourceFiles.has(path) && !generatedExtras.has(path))
    .sort();
  if (unexpected.length) fail(`${label} has unexpected files: ${unexpected.join(', ')}`);

  for (const [path, sourcePath] of [...sourceFiles.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [sourceBytes, packagedBytes] = await Promise.all([
      readFile(sourcePath),
      readFile(packagedFiles.get(path)),
    ]);
    if (!sourceBytes.equals(packagedBytes)) {
      fail(`${label} byte mismatch for ${path}: dist=${sha256(sourceBytes)} packaged=${sha256(packagedBytes)}`);
    }
  }

  for (const extra of [...generatedExtras].sort()) {
    const path = packagedFiles.get(extra);
    if (!path) fail(`${label} documented generated shim is missing: ${extra}`);
    if ((await readFile(path)).length !== 0) fail(`${label} generated shim must be empty: ${extra}`);
  }

  return { count: sourceFiles.size, identity: await identity(sourceFiles) };
};

const copyDist = async target => {
  const targetEntries = await readdir(target, { withFileTypes: true });
  for (const entry of targetEntries) {
    if (ignoredMetadataFiles.has(entry.name)) continue;
    if (generatedExtras.has(entry.name)) {
      const path = resolve(target, entry.name);
      if (!entry.isFile() || (await stat(path)).size !== 0) {
        fail(`refusing to replace invalid generated shim: ${path}`);
      }
      continue;
    }
    await rm(resolve(target, entry.name), { recursive: true, force: true });
  }

  for (const sourcePath of await walk(dist)) {
    const destination = resolve(target, relativePath(dist, sourcePath));
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(sourcePath, destination);
  }
};

const verifyAll = async () => {
  const results = [];
  for (const target of targets) results.push([target.label, await verifyTree(target.label, dist, target.path)]);
  const identities = new Set(results.map(([, result]) => result.identity));
  if (identities.size !== 1) fail('dist/Android/iOS identities differ after byte verification');
  const [{ count, identity }] = results.map(([, result]) => result);
  console.log(
    `Native packaged-asset verification passed: ${count} byte-identical dist files in Android and iOS; ` +
      `${generatedExtras.size} documented empty Cordova shims per native tree; identity=${identity}.`,
  );
  return { count, identity };
};

const selfTest = async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'pdf-chef-native-assets-'));
  const candidate = resolve(temporaryRoot, 'public');
  try {
    await mkdir(candidate, { recursive: true });
    for (const extra of generatedExtras) await writeFile(resolve(candidate, extra), '');
    for (const sourcePath of await walk(dist)) {
      const destination = resolve(candidate, relativePath(dist, sourcePath));
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(sourcePath, destination);
    }
    const [firstDistFile] = await walk(dist);
    if (!firstDistFile) fail('dist is empty');
    const changedPath = resolve(candidate, relativePath(dist, firstDistFile));
    const original = await readFile(changedPath);
    await writeFile(changedPath, Buffer.concat([original, Buffer.from([0])]));
    let rejected = false;
    try {
      await verifyTree('temporary self-test', dist, candidate);
    } catch (error) {
      rejected = /byte mismatch/.test(error instanceof Error ? error.message : String(error));
    }
    if (!rejected) fail('temporary byte mismatch was not rejected');
    console.log('Native packaged-asset verifier self-test passed: temporary byte mismatch rejected.');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

if (process.argv.includes('--sync')) {
  for (const target of targets) await copyDist(target.path);
  await verifyAll();
} else if (process.argv.includes('--self-test')) {
  await selfTest();
} else {
  await verifyAll();
}
