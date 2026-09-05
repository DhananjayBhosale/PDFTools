#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256')
  .update(readFileSync(resolve(root, path))).digest('hex');
const assert = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_PICKER_PENDING: ${message}`);
};
const count = (source, pattern) => [...source.matchAll(pattern)].length;

const paths = {
  plugin: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPlugin.java',
  coordinator: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinator.java',
  controller: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentPickerController.java',
  request: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/PickerRequestPolicy.java',
  pendingStore: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedPendingImportStore.java',
  pendingBatch: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/PendingImportBatch.java',
  pendingRecord: 'android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/PendingImportRecord.java',
  client: 'services/platform/android/androidDocuments.ts',
  workspace: 'services/platform/android/androidWorkspacePlatform.ts',
  pluginTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPluginContractTest.java',
  coordinatorTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinatorTest.java',
  pendingStoreTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedPendingImportStoreTest.java',
  controllerTest: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentPickerControllerTest.java',
  clientTest: 'tests/platform/androidDocuments.test.ts',
  workspaceTest: 'tests/platform/androidWorkspacePlatform.test.ts',
  runtimeTest: 'android/app/src/androidTest/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPluginInstrumentedTest.java',
};

for (const [path, expected] of new Map([
  [paths.controller, 'c80aa43e1efcc129a987e81d706009cf69019eeaae49e0f4c18a01b15e344975'],
  [paths.request, '3a8ae90c005fff0c702ca05b9c4c4a06d7bae19a82f3fafa1d47c07582c87a52'],
  [paths.pendingStore, 'b4bae855ba5bf4d3ad63d772231b1b1731150642f53b4bbc153e487094328ff8'],
  [paths.pendingBatch, '363b55b5feb5f53dc785d549984d52409e395f1f744ceacace2ee38c7398ad16'],
  [paths.pendingRecord, '78739adf5462f6899ca39f0efa4038db2d51268487f7e38ee27beee8050ce0a1'],
])) assert(hash(path) === expected, `accepted picker/pending substrate drift: ${path}`);

const plugin = read(paths.plugin);
const coordinator = read(paths.coordinator);
const controller = read(paths.controller);
const request = read(paths.request);
const pendingStore = read(paths.pendingStore);
const pendingBatch = read(paths.pendingBatch);
const client = read(paths.client);
const workspace = read(paths.workspace);

const exposed = [
  'readChunk', 'beginWrite', 'appendWrite', 'finishWrite', 'abortWrite',
  'listOwned', 'renameItem', 'trashOwned', 'restoreOwned', 'deleteOwned', 'clearOwned', 'takePendingImports',
  'acknowledgePendingImports', 'pickDocuments', 'exportItem', 'shareItem', 'openReader',
];
assert(count(plugin, /@PluginMethod\b/g) === exposed.length
  && exposed.every(method => new RegExp(
    `@PluginMethod\\s+public\\s+void\\s+${method}\\s*\\(\\s*PluginCall\\s+call\\s*\\)`,
  ).test(plugin)), 'exact AndroidDocuments surface drift');
assert(/@ActivityCallback\s+private void pickerResult\(PluginCall call, ActivityResult activityResult\)/
  .test(plugin), 'Capacitor picker ActivityCallback missing');
for (const invariant of [
  'PICKER_LAUNCH_ACTIVE.compareAndSet(false, true)',
  'execute(() -> completePickerResult(call, activityResult))',
  'getBridge().getSavedCall(call.getCallbackId()) == call',
  'data.length() != 2', 'data.has("acceptedMimeTypes")',
  'data.has("maximumItems")', 'data.length() != 5',
  'PickerRequestPolicy().restore', 'createPickerIntent(request)',
  'handlePickerResult(', 'notifyListeners(PICKER_EVENT, event, true)',
]) assert(plugin.includes(invariant), `picker lifecycle invariant missing: ${invariant}`);
assert(plugin.includes('MAXIMUM_PICKER_ITEMS = 100')
  && plugin.includes('values.length() > 6')
  && plugin.includes('AndroidDocumentIngressPolicy.isSupportedMimeType'),
  'picker MIME/count bounds missing');
assert(controller.includes('new Intent(Intent.ACTION_OPEN_DOCUMENT)')
  && controller.includes('Intent.CATEGORY_OPENABLE')
  && controller.includes('FLAG_GRANT_READ_URI_PERMISSION')
  && controller.includes('FLAG_GRANT_PERSISTABLE_URI_PERMISSION')
  && controller.includes('ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())'),
  'accepted DocumentsUI/grant/content policy drift');
assert(request.includes('if (!userInitiated) throw invalid()')
  && request.includes('maximumItems > AndroidDocumentIngressPolicy.MAX_ITEMS')
  && request.includes('documentRef(Request request, int orderedIndex)'),
  'user-initiation, count, or deterministic item-ref policy missing');
for (const invariant of [
  'PDFCHEF-PENDING-BATCH-V1\\0', 'ACKNOWLEDGED = 3',
  'batchRef.equals(batchRef(checked))', 'List.copyOf(checked)',
]) assert(pendingBatch.includes(invariant), `durable batch identity invariant missing: ${invariant}`);
for (const invariant of [
  'beginBatch(List<String> refs)', 'completeBatch(String batchRef, List<String> refs)',
  'takeCompleteBatch(int maximumItems)', 'loadAcknowledgedBatch(String batchRef)',
  'finalizeAcknowledgedBatch(PendingImportBatch complete)',
  'cleanupBatchTemps(batches, ".batch")', 'cleanupBatchTemps(acknowledged, ".ack")',
  'Files.exists(layout.dataPath(ref), LinkOption.NOFOLLOW_LINKS)',
]) assert(pendingStore.includes(invariant), `durable batch store invariant missing: ${invariant}`);

for (const signature of [
  'synchronized List<DocumentRecord> pendingImportsForBatch(String batchRef)',
  'synchronized PendingImportBatchRecords takePendingImports(int maximumItems)',
  'synchronized int acknowledgePendingImports(String batchRef, List<String> refs,',
]) assert(coordinator.includes(signature), `coordinator facade missing: ${signature}`);
const acknowledgeBody = coordinator.slice(
  coordinator.indexOf('synchronized int acknowledgePendingImports'),
  coordinator.indexOf('private static List<String> checkedPendingRefs'),
);
assert(acknowledgeBody.indexOf('// Validate the complete request before the first mutation.')
  < acknowledgeBody.indexOf('graph().writer.retainPending(ref, graph().pendingStore, cancellation)'),
  'full acknowledgement validation must precede the first accepted retain transition');
assert(coordinator.includes('graph().pendingStore.loadCompleteBatch(batchRef)')
  && coordinator.includes('graph().pendingStore.loadAcknowledgedBatch(batchRef)')
  && coordinator.includes('graph().pendingStore.finalizeAcknowledgedBatch(batch)'),
  'pending delivery must use exact durable live/acknowledged batch state');

for (const forbidden of [
  'put("uri"', 'put("path"', 'put("provider"', 'put("filename"',
  'put("bytes"', 'getMessage()', 'printStackTrace(', 'System.out', 'Log.',
]) assert(!plugin.includes(forbidden), `bridge privacy leak: ${forbidden}`);
assert(!/android\.permission\.(?:READ|WRITE|MANAGE)_EXTERNAL_STORAGE/.test(plugin),
  'storage permission must not enter the picker bridge');

for (const invariant of [
  'takePendingImports(options: Readonly<Record<string, never>>)',
  'acknowledgePendingImports(options:', 'pickDocuments(options:',
  "eventName: 'pendingImportReady'", 'ANDROID_PICKER_MIME_TYPES',
  'parsePendingBatch(await this.native.takePendingImports({}))',
  "['batchRef', 'items', 'status']", 'new Set(acceptedMimeTypes).size',
]) assert(client.includes(invariant), `strict TypeScript seam missing: ${invariant}`);
assert(client.includes('throw invalidResponse()')
  && !client.includes('takePendingImports().catch'),
  'pending response failures must remain explicit');

const listOwned = workspace.slice(
  workspace.indexOf('const listOwned'),
  workspace.indexOf('const listLegacy'),
);
assert(listOwned.includes('documents.listOwned()')
  && !listOwned.includes('catch')
  && !listOwned.includes('takePendingImports')
  && !listOwned.includes('acknowledgePendingImports'),
  'owned listing must be mutation-free and must not turn failures into false empty');
const pendingService = workspace.slice(
  workspace.indexOf('const pendingImports'),
  workspace.indexOf('const pickerMimeTypes'),
);
assert(pendingService.indexOf('addPendingImportListener') < pendingService.indexOf('await deliver()')
  && pendingService.indexOf('await consume(imports)')
    < pendingService.indexOf('acknowledgePendingImports'),
  'pending delivery must register first and acknowledge only after consume');
assert(pendingService.includes('const pendingRecoveryReady = activatePendingRecovery')
  && pendingService.includes('pendingImports.start(async imports => { void imports; })')
  && workspace.includes('await requirePendingRecovery();'),
  'Android startup must recover pending batches before owned Recent listing');
assert(workspace.includes('documentImport:')
  && workspace.includes('pendingImports,'),
  'Android workspace picker/pending seams are not wired');

for (const [path, proofs] of new Map([
  [paths.pluginTest, ['pendingBatchIdentityIsVersionedOrderBoundAndOpaque',
    'unavailableActivityLauncherCannotStrandTheProcessReaderGuard']],
  [paths.coordinatorTest, ['pendingPeekAndDuplicatePickerResultAfterAcknowledgementAreRetrySafe']],
  [paths.pendingStoreTest, ['incompleteBatchIsNeverDeliverableAndRestartPreservesExactOrder',
    'restartCleansReplaceAndReceiptTempsWithoutDeletingLiveState',
    'finalizationRejectsOrphanPendingPayloadWithoutPublishingReceipt']],
  [paths.controllerTest, ['pickerStagesAnIncompleteBatchBeforeItemsAndCompletesOnlyAfterTheFullOrder']],
  [paths.clientTest, ['picker and pending DTOs are exact',
    'pending failures never become empty']],
  [paths.workspaceTest, ['pending delivery registers first',
    'Android platform startup recovers a lost pending event',
    'native owned-list failure propagates']],
  [paths.runtimeTest, ['pickerAndPendingBridgeAreDiscoverableAndCancellationIsNeutral',
    'AndroidDocuments.takePendingImports', 'AndroidDocuments.pickDocuments']],
])) {
  const source = read(path);
  for (const proof of proofs) assert(source.includes(proof), `focused proof missing: ${proof}`);
}

console.log('ANDROID_DOCUMENT_PICKER_PENDING_VERIFIER: PASS');
console.log('PICKER_CONTRACT: ACTION_OPEN_DOCUMENT; six MIME types; 1..100; opaque b1_/d1_; listener-first durable peek and consume-before-ack');
console.log('ADDRESS_LEAKAGE: NONE');
console.log('PHYSICAL_DEVICE: NOT_CHECKED');
console.log('SIGNING_AND_PLAY: NOT_CHECKED');
console.log('PRODUCTION_RELEASE_READY: NO');
