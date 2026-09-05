import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AndroidLegacyInspectorClient,
  isAndroidLegacyInspectorAvailable,
  type AndroidLegacyInspectorNativePlugin,
} from '../../services/platform/android/androidLegacyInspector.ts';
import { ANDROID_LEGACY_READ_CAPABILITIES } from '../../services/platform/android/legacyCompatibilityContracts.ts';

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../fixtures/android-legacy/public/${name}`, import.meta.url), 'utf8'));

const nativeStub = (
  overrides: Partial<AndroidLegacyInspectorNativePlugin> = {},
): AndroidLegacyInspectorNativePlugin => ({
  readHistory: async () => fixture('history-001.json'),
  readSettings: async () => fixture('settings-ok.json'),
  ...overrides,
});

test('client exposes the accepted local read-only capability descriptor', () => {
  const client = new AndroidLegacyInspectorClient(nativeStub());
  assert.equal(client.capabilities, ANDROID_LEGACY_READ_CAPABILITIES);
  assert.deepEqual(client.capabilities, {
    readOnly: true,
    history: true,
    settings: true,
    files: true,
    collections: true,
    maximumHistoryEntries: 300,
  });
  assert.equal(Object.isFrozen(client.capabilities), true);
});

test('injected native reads are decoded into accepted history and settings snapshots', async () => {
  const calls: string[] = [];
  const client = new AndroidLegacyInspectorClient(nativeStub({
    readHistory: async () => { calls.push('history'); return fixture('history-partial-invalid.json'); },
    readSettings: async () => { calls.push('settings'); return fixture('settings-corrupt.json'); },
  }));

  const history = await client.readHistory();
  const settings = await client.readSettings();

  assert.deepEqual(calls, ['history', 'settings']);
  assert.equal(history.health, 'partial_invalid');
  assert.equal(history.invalidRecordCount, 1);
  assert.equal(settings.health, 'corrupt');
});

test('invalid native payloads never cross the client boundary', async () => {
  const secret = '/private/data/user/0/com.dhananjaytech.pdfchef/files/processed/secret.pdf';
  const client = new AndroidLegacyInspectorClient(nativeStub({
    readHistory: async () => ({
      health: 'ok', sourceCount: 1, invalidRecordCount: 0, returnedCount: 1,
      truncated: false, entries: [{ path: secret }],
    }),
    readSettings: async () => ({ health: 'ok', invalidValueCount: 0, values: { providerAddress: secret } }),
  }));

  await assert.rejects(client.readHistory(), error => {
    assert.equal(String(error).includes(secret), false);
    return true;
  });
  await assert.rejects(client.readSettings(), error => {
    assert.equal(String(error).includes(secret), false);
    return true;
  });
});

test('native errors and explicit unhealthy states are not collapsed into success', async () => {
  const nativeError = new Error('native history unavailable');
  const rejecting = new AndroidLegacyInspectorClient(nativeStub({
    readHistory: async () => { throw nativeError; },
  }));
  await assert.rejects(rejecting.readHistory(), error => error === nativeError);

  const unhealthy = new AndroidLegacyInspectorClient(nativeStub({
    readHistory: async () => fixture('history-missing.json'),
    readSettings: async () => fixture('settings-blank.json'),
  }));
  assert.equal((await unhealthy.readHistory()).health, 'missing');
  assert.equal((await unhealthy.readSettings()).health, 'blank');
});

test('registered proxy existence is not treated as native availability on web', () => {
  assert.equal(isAndroidLegacyInspectorAvailable(), false);
});
