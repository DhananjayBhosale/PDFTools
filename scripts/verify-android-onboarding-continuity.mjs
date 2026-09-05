#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = relative => readFileSync(resolve(root, relative), 'utf8');
const sha256 = source => createHash('sha256').update(source).digest('hex');

const entry = read('index.tsx');
const continuity = read('services/platform/android/androidOnboardingContinuity.ts');
const workspace = read('services/workspace.ts');
const onboarding = read('components/UI/Onboarding.tsx');
const mainActivity = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/MainActivity.java');
const inspectorPlugin = read('android/app/src/main/java/com/dhananjaytech/zenpdf_allpdftoolsinoneplace/legacy/AndroidLegacyInspectorPlugin.java');

assert.equal(
  sha256(onboarding),
  'ef9b44dea7119ff5cea6e5895233b8a5af97b0f3010ce1ce400ca040b0cd0b24',
  'exact Opus onboarding component bytes changed',
);
assert.match(entry, /import \{ startAndroidOnboardingContinuity \} from '\.\/services\/platform\/android\/androidOnboardingContinuity';/);
const androidStart = entry.indexOf("} else if (shellTarget === 'android') {");
const androidEnd = entry.indexOf('} else {', androidStart);
assert.ok(androidStart >= 0 && androidEnd > androidStart, 'Android bootstrap branch is missing');
const branch = entry.slice(androidStart, androidEnd);
const construction = branch.indexOf('const androidPlatform = createAndroidWorkspacePlatform(browserPlatform);');
const gate = branch.indexOf('startAndroidOnboardingContinuity(settleWithin, () => render(androidPlatform))');
assert.ok(construction >= 0 && gate > construction, 'platform must be constructed once before the continuity gate');
assert.equal((branch.match(/createAndroidWorkspacePlatform\(/g) ?? []).length, 1);
assert.equal((branch.match(/render\(/g) ?? []).length, 1);
assert.doesNotMatch(branch, /console\.|catch\s*\(/);

for (const required of [
  "snapshot.health === 'ok' || snapshot.health === 'partial_invalid'",
  'snapshot.values.onboarding_completed === true',
  "if (!ports.isCommitAllowed()) return 'abandoned'",
  "await settle(() => run(() => importWindowOpen), 'unavailable', budgetMs)",
  'importWindowOpen = false;',
  'commit();',
]) {
  assert.ok(continuity.includes(required), `continuity contract is missing: ${required}`);
}
assert.ok(
  continuity.indexOf('importWindowOpen = false;') < continuity.indexOf('commit();'),
  'late-write guard must close before first render commits',
);
assert.doesNotMatch(continuity, /console\.|AndroidLegacySettingsWriter|setThemeMode|writeLegacy/);
for (const required of [
  'getExplicitWorkspaceInterfaceFont',
  'hasCheckedAndroidLegacyInterfaceFont',
  'markAndroidLegacyInterfaceFontChecked',
  "legacy === 'DEFAULT'",
  "legacy === 'INTER'",
  "legacy === 'MANROPE'",
  'readExplicitSharedInterfaceFont() === null',
]) {
  assert.ok(continuity.includes(required), `legacy font continuity contract is missing: ${required}`);
}
assert.doesNotMatch(continuity, /legacy === 'ROBOTO'|legacy === 'POPPINS'|legacy === 'MONTSERRAT'/);
for (const required of [
  "pdfchef.workspace.interface-font-authority.v1",
  "pdfchef.android.legacy-interface-font.v1",
  "window.localStorage.getItem(WORKSPACE_INTERFACE_FONT_AUTHORITY_KEY) !== 'shared'",
  "window.localStorage.setItem(WORKSPACE_INTERFACE_FONT_AUTHORITY_KEY, 'shared')",
]) {
  assert.ok(workspace.includes(required), `workspace font authority contract is missing: ${required}`);
}
assert.match(inspectorPlugin, /@CapacitorPlugin\(name = "AndroidLegacyInspector"\)/);
assert.match(mainActivity, /registerPlugin\(AndroidLegacyInspectorPlugin\.class\)/);

console.log('ANDROID_ONBOARDING_CONTINUITY_VERIFIER: PASS');
