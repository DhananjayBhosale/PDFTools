#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const hash = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const assert = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_DOCUMENT_SCANNER_DEPENDENCY: ${message}`);
};
const count = (source, value) => source.split(value).length - 1;
const scanner = 'com.google.android.gms:play-services-mlkit-document-scanner:16.0.0';
const delegate = 'com.google.mlkit.vision.documentscanner.internal.GmsDocumentScanningDelegateActivity';
const paths = {
  build: 'android/app/build.gradle',
  proguard: 'android/app/proguard-rules.pro',
  test: 'android/app/src/test/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/HostDocumentScannerDependencyContractTest.java',
  debugManifest: 'android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml',
  releaseManifest: 'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
};

const build = read(paths.build);
const proguard = read(paths.proguard);
assert(count(build, scanner) === 1, 'scanner dependency must be exact and singular');
assert(!build.includes('exclude group:'), 'official scanner dependency must not carry ad-hoc exclusions');
assert(/-keepclassmembers class com\.google\.mlkit\.common\.internal\.CommonComponentRegistrar\s*\{\s*public <init>\(\);\s*\}/s.test(proguard),
  'CommonComponentRegistrar constructor keep rule must remain narrow');
assert(!proguard.includes('com.google.mlkit.**') && !proguard.includes('com.google.android.gms.**'),
  'broad Google keep rule forbidden');

for (const [variant, path] of [['debug', paths.debugManifest], ['release', paths.releaseManifest]]) {
  assert(existsSync(resolve(root, path)), `${variant} merged manifest missing; run process${variant[0].toUpperCase()}${variant.slice(1)}Manifest`);
  const manifest = read(path);
  const delegateTags = [...manifest.matchAll(
    /<activity\b[^>]*android:name="com\.google\.mlkit\.vision\.documentscanner\.internal\.GmsDocumentScanningDelegateActivity"[^>]*>/g,
  )];
  assert(delegateTags.length === 1 && count(manifest, `android:name="${delegate}"`) === 1,
    `${variant} scanner delegate drifted`);
  assert(delegateTags[0][0].includes('android:exported="false"'),
    `${variant} scanner delegate must be non-exported on its own manifest tag`);
  for (const permission of ['android.permission.CAMERA', 'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.MANAGE_EXTERNAL_STORAGE']) {
    assert(!manifest.includes(permission), `${variant} manifest contains forbidden ${permission}`);
  }
}

const gradlew = resolve(root, 'android/gradlew');
const insight = (configuration, dependency) => execFileSync(
  gradlew,
  ['-p', resolve(root, 'android'), '--no-daemon', ':app:dependencyInsight', '--configuration', configuration, '--dependency', dependency],
  { cwd: root, encoding: 'utf8', env: process.env },
);
for (const configuration of ['debugRuntimeClasspath', 'releaseRuntimeClasspath']) {
  const scannerInsight = insight(configuration, scanner);
  assert(scannerInsight.includes(scanner), `${configuration} does not resolve the pinned scanner`);
}

for (const path of [paths.build, paths.proguard, paths.test, 'scripts/verify-android-document-scanner-dependency.mjs']) {
  console.log(`OWNED ${hash(path)}  ${path}`);
}
console.log('ANDROID_DOCUMENT_SCANNER_DEPENDENCY_VERIFIER: PASS');
console.log('SCANNER_DEPENDENCY: official plain 16.0.0; no camera/storage permission; exact non-exported delegate');
console.log('RUNTIME_DISCOVERY: NOT_CHECKED');
console.log('PRODUCTION_RELEASE_READY: NO');
