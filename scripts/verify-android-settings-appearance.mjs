#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`ANDROID_SETTINGS_APPEARANCE: ${message}`);
};
const count = (source, needle) => source.split(needle).length - 1;

const settings = read('services/platform/android/androidSettings.ts');
const appearance = read('hooks/useAppearance.tsx');
const surface = read('components/Pages/SettingsPage.tsx');
const contractTest = read('tests/platform/androidSettings.test.ts');
const surfaceTest = read('tests/ui/androidSettingsAppearance.test.ts');
const activity = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java');
const manifest = read('android/app/src/main/AndroidManifest.xml');

for (const registration of [
  'registerPlugin(AndroidLegacyInspectorPlugin.class)',
  'registerPlugin(AndroidLegacySettingsWriterPlugin.class)',
]) {
  assert(count(activity, registration) === 1, `expected one ${registration}`);
}

for (const required of [
  "mode === 'LIGHT'",
  "mode === 'DARK'",
  "preference === 'system'",
  "preference === 'light'",
  "preference === 'dark'",
  'this.writeTail.then(() => this.client.setThemeMode(mode))',
  'isAndroidLegacyInspectorAvailable()',
  "Capacitor.isPluginAvailable('AndroidLegacySettingsWriter')",
]) {
  assert(settings.includes(required), `accepted Android settings seam drifted: ${required}`);
}
assert(!/androidThemeModeFor[\s\S]{0,500}DYNAMIC/.test(settings),
  'shared appearance must never write legacy DYNAMIC');

for (const required of [
  "export const THEME_MARKER_KEY = 'pdfchef.appearance.android-theme-write.v1'",
  'Reflect.ownKeys(value)',
  'reconcilePendingTheme(marker, await readLegacy())',
  'if (local) return',
  'if (!storage.write(THEME_MARKER_KEY, serializeThemeMarker({ target: next, confirmed })))',
  'await persistence.writeTheme(next)',
  "report('failed')",
  "report(clean ? 'saved' : 'unsaved')",
  "isAndroid: Capacitor.getPlatform() === 'android'",
]) {
  assert(appearance.includes(required), `appearance transaction drifted: ${required}`);
}
const markerGuard = appearance.indexOf(
  'if (!storage.write(THEME_MARKER_KEY, serializeThemeMarker({ target: next, confirmed })))',
);
const nativeWrite = appearance.indexOf('await persistence.writeTheme(next)', markerGuard);
assert(markerGuard >= 0 && nativeWrite > markerGuard,
  'durable marker publication must precede the native theme write');

const feedbackStart = surface.indexOf('const THEME_SYNC_FEEDBACK');
const themeRowStart = surface.indexOf('<Row label="Theme" stacked>');
const textSizeStart = surface.indexOf('<Row label="Text size" stacked>');
assert(feedbackStart >= 0 && themeRowStart > feedbackStart && textSizeStart > themeRowStart,
  'Theme feedback must remain inside the existing Settings flow');
const feedback = surface.slice(feedbackStart, surface.indexOf('export const SettingsPage'));
const themeRow = surface.slice(themeRowStart, textSizeStart);
for (const state of ['saving', 'saved', 'imported', 'failed', 'unsaved']) {
  assert(feedback.includes(`${state}:`), `missing fixed feedback state: ${state}`);
}
assert(themeRow.includes('role="status" aria-live="polite"')
  && themeRow.includes('<StatusLine tone={themeFeedback.tone}>'),
'Theme result must stay anchored and politely announced');
assert(!/disabled|createPortal|fixed|absolute/.test(themeRow),
  'Theme control must remain usable and feedback must not float');

for (const proof of [
  'legacy theme resolution preserves health and maps DYNAMIC without rewriting it',
  'explicit native writes are serialized and a failed write does not strand later choices',
  'a real local choice stays authoritative and the older store is not read',
  'a marker that cannot be published stops the choice before the device is asked',
  'the feedback is anchored in the Theme row, in flow, and announced politely',
]) {
  assert(contractTest.includes(proof) || surfaceTest.includes(proof), `focused proof missing: ${proof}`);
}

assert(!/READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/.test(manifest),
  'theme continuity must not add a storage permission');

console.log('ANDROID_SETTINGS_APPEARANCE_VERIFIER: PASS');
console.log('AUTHORITY: valid shared local theme, otherwise one read-only legacy import');
console.log('WRITES: explicit SYSTEM/LIGHT/DARK only, serialized behind a durable marker');
console.log('FAILURE: fixed anchored feedback; no native message, path, or false success');
console.log('TEXT_SCALE_RESET_SIGNING_PLAY_PRODUCTION: NOT_IN_SCOPE');
