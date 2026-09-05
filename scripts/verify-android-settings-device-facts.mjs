#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_SETTINGS_DEVICE_FACTS: ${message}`);
};

const activity = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java');
const metadataPlugin = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/AndroidAppMetadataPlugin.java');
const storagePlugin = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/AndroidStorageStatsPlugin.java');
const calculator = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/AndroidStorageStatsCalculator.java');
const workspace = read('services/platform/android/androidWorkspacePlatform.ts');
const manifest = read('android/app/src/main/AndroidManifest.xml');

const metadataRegistration = 'registerPlugin(AndroidAppMetadataPlugin.class)';
const storageRegistration = 'registerPlugin(AndroidStorageStatsPlugin.class)';
const bridgeStart = 'super.onCreate(savedInstanceState)';
for (const registration of [metadataRegistration, storageRegistration]) {
  assert(activity.split(registration).length - 1 === 1, `expected one ${registration}`);
  assert(activity.indexOf(registration) < activity.indexOf(bridgeStart), `${registration} must precede bridge startup`);
}
assert(activity.indexOf(metadataRegistration) < activity.indexOf(storageRegistration), 'device-fact registration order drift');

assert(metadataPlugin.includes('@CapacitorPlugin(name = "AndroidAppMetadata")')
  && (metadataPlugin.match(/@PluginMethod\b/g) ?? []).length === 1
  && /public\s+void\s+getMetadata\s*\(/.test(metadataPlugin),
'metadata plugin surface drift');
assert(storagePlugin.includes('@CapacitorPlugin(name = "AndroidStorageStats")')
  && (storagePlugin.match(/@PluginMethod\b/g) ?? []).length === 1
  && /public\s+void\s+getStorageStats\s*\(/.test(storagePlugin),
'storage plugin surface drift');

for (const required of [
  'isAndroidAppMetadataAvailable()',
  'isAndroidStorageStatsAvailable()',
  'getApplicationMetadata: () => metadata.getMetadata()',
  'getStorageInformation: () => storage.getStorageStats()',
  'return platformWithDeviceFacts',
]) {
  assert(workspace.includes(required), `workspace activation missing ${required}`);
}
const adapterStart = workspace.indexOf('const withDeviceFacts');
const adapterEnd = workspace.indexOf('const openOwnedStream', adapterStart);
const adapter = workspace.slice(adapterStart, adapterEnd);
assert(adapterStart >= 0 && adapterEnd > adapterStart, 'device-fact adapter boundary missing');
assert(!/\bcatch\b/.test(adapter), 'device-fact adapter must not hide native or DTO failure');
assert(!/retainedBytes\s*:\s*0|version\s*:\s*['"]|build\s*:\s*['"]/.test(adapter),
  'device-fact adapter must not substitute successful defaults');

assert(calculator.includes('private static final String DOCUMENTS_DIRECTORY = "pdfchef_documents";')
  && calculator.includes('private static final String OWNED_DIRECTORY = "owned";')
  && calculator.includes('Files.newDirectoryStream(ownedDirectory)')
  && calculator.includes('LinkOption.NOFOLLOW_LINKS')
  && !calculator.includes('resolve("records")')
  && !calculator.includes('resolve("sessions")')
  && !calculator.includes('resolve("operations")'),
'retained-byte root or no-follow contract drift');

assert(!/READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/.test(manifest),
  'device facts must not add broad storage permission');

console.log('ANDROID_SETTINGS_DEVICE_FACTS_VERIFIER: PASS');
console.log('DEVICE_FACTS: public app name/version/build plus flat no-follow owned payload bytes');
console.log('FAILURE_MODEL: unavailable or malformed native data propagates to existing Settings error state');
console.log('THEME_VERSION_SIGNING_PLAY_PRODUCTION: NOT_IN_SCOPE');
