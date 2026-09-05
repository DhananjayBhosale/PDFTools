#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256')
  .update(readFileSync(resolve(root, path))).digest('hex');
const assert = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_DOCUMENT_SCANNER: ${message}`);
};
const count = (source, pattern) => [...source.matchAll(pattern)].length;

const paths = {
  plugin: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerPlugin.java',
  importer: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerImporter.java',
  resultSource: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerResultSource.java',
  importerTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerImporterTest.java',
  resultSourceTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerResultSourceTest.java',
  pluginTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/scanner/AndroidDocumentScannerPluginContractTest.java',
  client: 'services/platform/android/androidDocumentScanner.ts',
  clientTest: 'tests/platform/androidDocumentScanner.test.ts',
  activity: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java',
};
const plugin = read(paths.plugin);
const importer = read(paths.importer);
const resultSource = read(paths.resultSource);
const client = read(paths.client);
const activity = read(paths.activity);

assert(/@CapacitorPlugin\s*\(\s*name\s*=\s*"AndroidDocumentScanner"\s*\)/.test(plugin),
  'plugin name drifted');
assert(count(plugin, /@PluginMethod\b/g) === 1
  && /@PluginMethod\s+public\s+void\s+scan\s*\(\s*PluginCall\s+call\s*\)/.test(plugin),
  'bridge must expose exactly scan');
assert(plugin.includes('data.length() != 0'), 'scan request must be exact empty object');
for (const option of ['.setGalleryImportAllowed(true)',
  'GmsDocumentScannerOptions.SCANNER_MODE_FULL',
  'GmsDocumentScannerOptions.RESULT_FORMAT_PDF',
  'GmsDocumentScannerOptions.RESULT_FORMAT_JPEG']) {
  assert(plugin.includes(option), `scanner option missing ${option}`);
}
assert(plugin.includes('Activity.RESULT_CANCELED')
  && plugin.includes('result.put("status", "cancelled")')
  && plugin.includes('result.put("item", JSObject.NULL)'),
  'cancellation must resolve as a distinct non-error');
assert(plugin.includes('getDocumentLifecycleCoordinator()')
  && plugin.includes('AndroidDocumentScannerImporter.forCoordinator')
  && !plugin.includes('new DocumentLifecycleCoordinator'),
  'scanner must use the sole Application-owned coordinator');
assert(plugin.includes('AndroidDocumentScannerResultSource.resolve(')
  && plugin.includes('getContext().getCacheDir().toPath()')
  && plugin.includes('getContext().getContentResolver().openInputStream(pdfUri)'),
  'scanner result must use the strict native-only content/private-cache resolver');
assert(plugin.includes('EXTRA_SEND_INTENT_EXCEPTION')
  && plugin.indexOf('ResultKind.LAUNCH_FAILED') < plugin.indexOf('ResultKind.CANCELLED'),
  'intent-sender failure must be classified before genuine cancellation');
assert(plugin.includes('@ActivityCallback')
  && plugin.includes('ACTION_INTENT_SENDER_REQUEST')
  && plugin.includes('EXTRA_INTENT_SENDER_REQUEST')
  && plugin.includes('startActivityForResult(call, request, "scannerResult")')
  && plugin.includes('call.isReleased()')
  && plugin.includes('getBridge().getSavedCall(call.getCallbackId()) != call')
  && plugin.includes('shouldDeliver(call != null, call != null && call.isReleased())')
  && !plugin.includes('ActivityResultLauncher<IntentSenderRequest>')
  && !plugin.includes('pendingCall') && !plugin.includes('shutdownNow'),
  'scanner launch must use the recreation-safe Capacitor callback contract');
for (const forbidden of ['put("uri"', 'put("path"', 'put("bytes"', 'put("exception"',
  'getMessage()', 'printStackTrace', 'android.util.Log', 'System.out']) {
  assert(!plugin.includes(forbidden), `native detail leak: ${forbidden}`);
}

for (const invariant of ['MAXIMUM_CHUNK_BYTES = 524_288',
  'MAXIMUM_FILE_BYTES = 128L * 1024L * 1024L',
  'coordinator.beginWrite(DISPLAY_NAME', 'coordinator.appendWrite(',
  'coordinator.finishWrite(', 'writer.abort(sessionRef)',
  'Thread.currentThread().isInterrupted()', 'input.read(buffer, buffered, buffer.length - buffered)',
  'Arrays.copyOf(buffer, buffered)', 'byte[] chunk = buffer.clone()']) {
  assert(importer.includes(invariant), `bounded importer invariant missing ${invariant}`);
}
assert(!/FileOutputStream|Files\.|Path\b|File\b|MediaStore|persistedUri/.test(importer),
  'scanner importer must not introduce another staging or address layer');
for (const invariant of ['ML_KIT_STAGING_ROOT = "mlkit_docscan_ui_client"',
  '"content".equals(uri.getScheme())', '"file".equals(uri.getScheme())',
  'candidate.startsWith(trustedRoot)', 'Files.isSymbolicLink(cursor)',
  'Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)', 'Files.delete(path)',
  'fsyncDirectory(directory)', 'FileChannel.open(resolved.path, StandardOpenOption.READ',
  'for (Resolved value : all)', 'cleanupFiles(all)']) {
  assert(resultSource.includes(invariant), `result-source invariant missing ${invariant}`);
}
assert(plugin.includes('finally {') && plugin.includes('batch.close()'),
  'every terminal import path must clean trusted PDF and JPEG scanner staging');
for (const forbidden of ['toFile().delete', 'deleteOnExit', 'Files.walk', 'Files.delete(cacheDir)',
  'Files.delete(trustedRoot)']) {
  assert(!resultSource.includes(forbidden), `unsafe result cleanup primitive: ${forbidden}`);
}
const registrations = [
  'registerPlugin(AndroidLegacyInspectorPlugin.class)',
  'registerPlugin(AndroidLegacySettingsWriterPlugin.class)',
  'registerPlugin(AndroidDocumentsPlugin.class)',
  'registerPlugin(AndroidDocumentScannerPlugin.class)',
  'super.onCreate(savedInstanceState)',
];
const registrationPositions = registrations.map(entry => activity.indexOf(entry));
assert(registrationPositions.every(position => position >= 0)
  && registrationPositions.every((position, index) => index === 0
    || position > registrationPositions[index - 1])
  && count(activity, /registerPlugin\(/g) === 4
  && count(activity, /registerPlugin\(AndroidDocumentScannerPlugin\.class\)/g) === 1,
  'scanner must be the fourth and final plugin registered before bridge creation');

assert(client.includes("registerPlugin<AndroidDocumentScannerNativePlugin>('AndroidDocumentScanner')")
  && client.includes('async scan(): Promise<AndroidDocumentScanResult>')
  && client.includes('return parseResult(await this.native.scan({}))'),
  'strict TypeScript scan adapter missing');
for (const forbidden of ['uri:', 'path:', 'bytes:', 'exception:', 'file://', 'content://']) {
  assert(!client.includes(forbidden), `TypeScript address/detail field forbidden: ${forbidden}`);
}

const sourceExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
const resolveSource = (fromFile, specifier) => {
  let base;
  if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else if (specifier.startsWith('@/')) base = resolve(root, specifier.slice(2));
  else if (specifier === 'framer-motion') base = resolve(root, 'lib/framer-motion-shim.tsx');
  else return null;
  const insideRoot = candidate => {
    const path = relative(root, candidate);
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  };
  const candidates = [
    ...sourceExtensions.map(extension => `${base}${extension}`),
    ...sourceExtensions.slice(1).map(extension => resolve(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    if (insideRoot(candidate) && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`ANDROID_DOCUMENT_SCANNER: unresolved local module ${specifier}`);
};
const pending = [resolve(root, 'index.tsx')];
const graph = new Set();
const patterns = [
  /\bimport\s+(?:type\s+)?[^;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[^;]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];
while (pending.length > 0) {
  const file = pending.pop();
  if (graph.has(file)) continue;
  graph.add(file);
  const source = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const dependency = resolveSource(file, match[1]);
      if (dependency !== null && !graph.has(dependency)) pending.push(dependency);
    }
  }
}
assert(graph.has(resolve(root, paths.client)),
  'exact-Opus Make PDF activation must include the strict scanner adapter');
const scannerConsumers = [...graph]
  .filter(file => file !== resolve(root, paths.client))
  .filter(file => readFileSync(file, 'utf8').includes('AndroidDocumentScanner'))
  .map(file => relative(root, file));
assert(JSON.stringify(scannerConsumers)
  === JSON.stringify(['services/platform/android/androidWorkspacePlatform.ts']),
  `scanner adapter consumer drifted: ${scannerConsumers.join(', ')}`);
const makePdf = read('components/Tools/MakePDF.tsx');
const workspace = read('services/platform/android/androidWorkspacePlatform.ts');
assert(workspace.includes('isAndroidDocumentScannerAvailable()')
  && workspace.includes('createAndroidDocumentScannerService()')
  && workspace.includes('platform.documentScanner = createAndroidDocumentScannerService()')
  && workspace.indexOf('if (!isAndroidDocumentsAvailable()) return base;')
    < workspace.indexOf('if (isAndroidDocumentScannerAvailable())')
  && makePdf.includes('platform.documentScanner'),
  'workspace must inject the scanner only behind native availability');

for (const path of [paths.plugin, paths.importer, paths.resultSource, paths.pluginTest,
  paths.importerTest, paths.resultSourceTest,
  paths.client, paths.clientTest, 'scripts/verify-android-document-scanner.mjs']) {
  console.log(`OWNED ${hash(path)}  ${path}`);
}
console.log('ANDROID_DOCUMENT_SCANNER_VERIFIER: PASS');
console.log(`FRONTEND_ENTRY_GRAPH: ${graph.size} modules; adapter activated only behind native availability`);
console.log('SCANNER_API: scan({}) -> completed durable d1_ item/counts | cancelled non-error');
console.log('NATIVE_REGISTRATION: ACTIVE; fourth plugin behind Android native discovery');
console.log('RUNTIME_DISCOVERY: NOT_CHECKED');
console.log('PRODUCTION_RELEASE_READY: REQUIRES_BUILD_AND_RUNTIME_GATES');
