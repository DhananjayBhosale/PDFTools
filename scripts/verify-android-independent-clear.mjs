#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256')
  .update(readFileSync(resolve(root, path))).digest('hex');
const requireText = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_INDEPENDENT_CLEAR: ${message}`);
};

const recent = read('components/Pages/RecentPage.tsx');
const workspace = read('services/workspace.ts');
const runtime = read('hooks/useWorkspaceRuntime.tsx');
const client = read('services/platform/android/androidDocuments.ts');
const platform = read('services/platform/android/androidWorkspacePlatform.ts');
const plugin = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/AndroidDocumentsPlugin.java');
const coordinator = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/DocumentLifecycleCoordinator.java');
const writer = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/documents/OwnedDocumentWriter.java');

requireText(hash('components/Pages/RecentPage.tsx')
  === 'ced30798fc358ae49b0d26089c75aa65b7144485879e927f03a20c38232ac274',
'frozen exact-Opus Recent surface drift');
requireText(recent.includes("mode === 'documents' ? platform.records.clearDocuments() : platform.records.clearRecords()")
  && recent.includes('Delete kept files only')
  && recent.includes('The list of what you made stays')
  && recent.includes('This cannot be undone.'),
'existing two-action destructive UX contract drift');

requireText(workspace.includes('blob: Blob | null')
  && workspace.includes('export const withoutOutputPayload')
  && workspace.includes("db.transaction(OUTPUT_STORE, 'readwrite')")
  && workspace.includes('cursor.update(withoutOutputPayload(record))')
  && runtime.includes('await clearOutputDocuments()'),
'browser-session payload-only clear must retain metadata in one transaction');
requireText(platform.includes('separateClearActions: true')
  && /async clearRecords\(\) \{\s*await base\.records\.clearRecords\(\);\s*await documents\.clearOwned\(\);\s*\}/.test(platform)
  && /async clearDocuments\(\) \{\s*await base\.records\.clearDocuments\(\);\s*await documents\.clearOwnedPayloads\(\);\s*\}/.test(platform),
'Android record and payload clears must remain independent');

requireText(client.includes('clearOwnedPayloads(options: Readonly<Record<string, never>>)')
  && client.includes("['clearedCount']")
  && client.includes('readonly available: boolean'),
'strict TypeScript clear and availability DTO missing');
requireText(plugin.includes('@PluginMethod public void clearOwnedPayloads(PluginCall call)')
  && plugin.includes('.clearOwnedDocumentPayloads()')
  && plugin.includes('output.put("clearedCount", clearedCount)')
  && plugin.includes('item.put("available", record.available())'),
'strict native bridge or unavailable listing field missing');
requireText(coordinator.includes('public synchronized int clearOwnedDocumentPayloads()')
  && coordinator.includes('closeAllOwnedCursors();')
  && coordinator.includes('graph().writer.clearOwnedPayloads()')
  && coordinator.includes('public boolean available()'),
'coordinator payload-clear boundary missing');

for (const literal of [
  'private static final int OWNED_VERSION = 3',
  'output.writeBoolean(value.available)',
  'version >= OWNED_VERSION ? input.readBoolean() : true',
  'int clearOwnedPayloads()',
  'AFTER_PAYLOAD_CLEAR_MARKER',
  'AFTER_PAYLOAD_CLEAR_RECORD_PUBLISH',
  'BEFORE_PAYLOAD_CLEAR_DATA_DELETE',
  'BEFORE_PAYLOAD_CLEAR_MARKER_DELETE',
  'deleteVerified(data)',
  'fsyncDirectory(layout.owned)',
  'deleteVerified(marker)',
  'fsyncDirectory(layout.operations)',
]) requireText(writer.includes(literal), `native durability contract missing: ${literal}`);
requireText(writer.includes('"clear_" + PendingImportRecord.refPayload(ref) + ".payload-clear"')
  && writer.includes('recoverPayloadClears(layout)')
  && writer.includes('if (!record.available) throw notFound()'),
'payload-clear recovery or unavailable gating missing');
requireText(!/clearOwnedDocumentPayloads[\s\S]{0,500}(?:Legacy|processed_index|app_settings)/.test(coordinator),
'payload-only clear must not touch the legacy app store');

console.log('ANDROID_INDEPENDENT_CLEAR: PASS');
