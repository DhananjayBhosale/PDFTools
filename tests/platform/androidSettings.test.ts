import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Capacitor } from '@capacitor/core';
import {
  AndroidLegacyInspectorClient,
  type AndroidLegacyInspectorNativePlugin,
} from '../../services/platform/android/androidLegacyInspector.ts';
import {
  ANDROID_THEME_MODES,
  AndroidThemePersistence,
  AndroidSettingsClient,
  androidThemeModeFor,
  isAndroidSettingsAvailable,
  resolveAndroidLegacyTheme,
  type AndroidLegacySettingsWriterNativePlugin,
} from '../../services/platform/android/androidSettings.ts';

const fixture = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../fixtures/android-legacy/public/${name}`, import.meta.url), 'utf8'));

const inspectorStub = (
  overrides: Partial<AndroidLegacyInspectorNativePlugin> = {},
): AndroidLegacyInspectorClient => new AndroidLegacyInspectorClient({
  readHistory: async () => fixture('history-001.json'),
  readSettings: async () => fixture('settings-ok.json'),
  ...overrides,
});

const writerStub = (
  overrides: Partial<AndroidLegacySettingsWriterNativePlugin> = {},
): AndroidLegacySettingsWriterNativePlugin => ({
  setThemeMode: async ({ mode }) => ({ mode, changed: true }),
  ...overrides,
});

test('settings reads use the accepted inspector contract and preserve every health state', async () => {
  for (const health of ['ok', 'missing', 'blank', 'corrupt', 'partial-invalid'] as const) {
    const name = health === 'partial-invalid' ? 'settings-partial-invalid.json' : `settings-${health}.json`;
    const result = await new AndroidSettingsClient(inspectorStub({ readSettings: async () => fixture(name) }), writerStub())
      .readSettings();
    assert.equal(result.health, health.replace('-', '_'));
  }
});

test('theme writes send exactly one accepted mode and decode exactly mode and changed', async () => {
  const calls: unknown[] = [];
  const client = new AndroidSettingsClient(inspectorStub(), writerStub({
    setThemeMode: async options => { calls.push(options); return { mode: options.mode, changed: false }; },
  }));

  for (const mode of ANDROID_THEME_MODES) {
    const result = await client.setThemeMode(mode);
    assert.deepEqual(result, { mode, changed: false });
    assert.equal(Object.isFrozen(result), true);
  }
  assert.deepEqual(calls, ANDROID_THEME_MODES.map(mode => ({ mode })));
});

test('invalid request and result shapes do not cross the adapter boundary', async () => {
  const hidden = { mode: 'DARK', changed: true };
  Object.defineProperty(hidden, 'path', { value: '/private/settings' });
  const invalid: unknown[] = [
    null,
    Object.create(null),
    { mode: 'DARK' },
    { mode: 'DARK', changed: true, extra: 'no' },
    { mode: 'LIGHT', changed: true },
    { mode: 'DARK', changed: 'true' },
    Object.assign({ mode: 'DARK', changed: true }, { [Symbol('private')]: true }),
    hidden,
  ];
  for (const response of invalid) {
    const client = new AndroidSettingsClient(inspectorStub(), writerStub({
      setThemeMode: async () => response,
    }));
    await assert.rejects(client.setThemeMode('DARK'), TypeError);
  }

  const client = new AndroidSettingsClient(inspectorStub(), writerStub());
  await assert.rejects(client.setThemeMode('dark' as never), /invalid Android theme mode/);
});

test('native errors retain identity and availability requires Android plus both native headers', async () => {
  const nativeError = Object.assign(new Error('LEGACY_THEME_WRITE_FAILED'), { code: 'LEGACY_THEME_WRITE_FAILED' });
  const client = new AndroidSettingsClient(inspectorStub(), writerStub({
    setThemeMode: async () => { throw nativeError; },
  }));
  await assert.rejects(client.setThemeMode('DARK'), error => error === nativeError);
  assert.equal(isAndroidSettingsAvailable(), false);

  const capacitor = Capacitor as unknown as {
    getPlatform(): string;
    isPluginAvailable(name: string): boolean;
  };
  const getPlatform = capacitor.getPlatform;
  const isPluginAvailable = capacitor.isPluginAvailable;
  try {
    capacitor.getPlatform = () => 'android';
    capacitor.isPluginAvailable = name => [
      'AndroidLegacyInspector',
      'AndroidLegacySettingsWriter',
    ].includes(name);
    assert.equal(isAndroidSettingsAvailable(), true);
    capacitor.isPluginAvailable = name => name === 'AndroidLegacyInspector';
    assert.equal(isAndroidSettingsAvailable(), false);
  } finally {
    capacitor.getPlatform = getPlatform;
    capacitor.isPluginAvailable = isPluginAvailable;
  }
});

test('T908: legacy theme resolution preserves health and maps DYNAMIC without rewriting it', async () => {
  const writes: unknown[] = [];
  const persistence = new AndroidThemePersistence(new AndroidSettingsClient(
    inspectorStub({
      readSettings: async () => ({
        health: 'ok', invalidValueCount: 0, values: { theme_mode: 'DARK' },
      }),
    }),
    writerStub({ setThemeMode: async options => { writes.push(options); return { ...options, changed: true }; } }),
  ));
  const read = await persistence.readLegacyTheme();
  assert.deepEqual(read, {
    health: 'ok',
    preference: 'dark',
    legacyMode: 'DARK',
  });
  assert.deepEqual(writes, []);

  const dynamic = resolveAndroidLegacyTheme({
    health: 'ok',
    invalidValueCount: 0,
    values: { theme_mode: 'DYNAMIC' },
  });
  assert.deepEqual(dynamic, {
    health: 'ok',
    preference: 'system',
    legacyMode: 'DYNAMIC',
  });
  assert.deepEqual(writes, []);
});

test('T908: missing, blank and corrupt settings never become a successful preference', () => {
  for (const health of ['missing', 'blank', 'corrupt'] as const) {
    assert.deepEqual(resolveAndroidLegacyTheme({
      health,
      invalidValueCount: 0,
      values: {},
    }), {
      health,
      preference: null,
      legacyMode: null,
    });
  }
  assert.deepEqual(resolveAndroidLegacyTheme({
    health: 'partial_invalid',
    invalidValueCount: 1,
    values: { theme_mode: 'LIGHT' },
  }), {
    health: 'partial_invalid',
    preference: 'light',
    legacyMode: 'LIGHT',
  });
});

test('T908: explicit shared themes map only to SYSTEM, LIGHT and DARK', () => {
  assert.equal(androidThemeModeFor('system'), 'SYSTEM');
  assert.equal(androidThemeModeFor('light'), 'LIGHT');
  assert.equal(androidThemeModeFor('dark'), 'DARK');
  assert.throws(() => androidThemeModeFor('dynamic' as never), /invalid shared theme/);
});

test('T908: explicit native writes are serialized and a failed write does not strand later choices', async () => {
  const started: string[] = [];
  const releases: Array<() => void> = [];
  let first = true;
  const firstFailure = Object.assign(new Error('LEGACY_THEME_WRITE_FAILED'), { code: 'LEGACY_THEME_WRITE_FAILED' });
  const persistence = new AndroidThemePersistence(new AndroidSettingsClient(
    inspectorStub(),
    writerStub({
      setThemeMode: async ({ mode }) => {
        started.push(mode);
        await new Promise<void>(resolve => { releases.push(resolve); });
        if (first) {
          first = false;
          throw firstFailure;
        }
        return { mode, changed: true };
      },
    }),
  ));

  const light = persistence.writeTheme('light');
  const dark = persistence.writeTheme('dark');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(started, ['LIGHT']);
  releases.shift()!();
  await assert.rejects(light, error => error === firstFailure);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(started, ['LIGHT', 'DARK']);
  releases.shift()!();
  assert.deepEqual(await dark, { mode: 'DARK', changed: true });
});
