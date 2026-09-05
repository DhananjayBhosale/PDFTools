import assert from 'node:assert/strict';
import test from 'node:test';
import { Capacitor } from '@capacitor/core';
import {
  AndroidAppMetadataClient,
  isAndroidAppMetadataAvailable,
  type AndroidAppMetadataNativePlugin,
} from '../../services/platform/android/androidAppMetadata.ts';

const nativeStub = (
  implementation: AndroidAppMetadataNativePlugin['getMetadata'] = async () => ({
    name: 'PDF Chef', version: '1.0', build: '1',
  }),
): AndroidAppMetadataNativePlugin => ({ getMetadata: implementation });

test('client requests no arguments and accepts exactly the public application metadata DTO', async () => {
  let calls = 0;
  const client = new AndroidAppMetadataClient(nativeStub(async (...args) => {
    calls += 1;
    assert.deepEqual(args, []);
    return { name: 'PDF Chef', version: '1.0', build: '1' };
  }));

  const metadata = await client.getMetadata();
  assert.equal(calls, 1);
  assert.deepEqual(metadata, { name: 'PDF Chef', version: '1.0', build: '1' });
  assert.equal(Object.isFrozen(metadata), true);
});

test('a genuinely unavailable build remains null', async () => {
  const metadata = await new AndroidAppMetadataClient(nativeStub(async () => ({
    name: 'PDF Chef', version: '1.0', build: null,
  }))).getMetadata();
  assert.deepEqual(metadata, { name: 'PDF Chef', version: '1.0', build: null });
});

test('response must be a plain exact DTO with nonblank NUL-free public text', async () => {
  const withHiddenField = { name: 'PDF Chef', version: '1.0', build: '1' };
  Object.defineProperty(withHiddenField, 'hiddenPackage', { value: 'com.example.private' });
  const invalid: unknown[] = [
    null,
    [],
    Object.create(null),
    { name: 'PDF Chef', version: '1.0' },
    { name: 'PDF Chef', version: '1.0', build: '1', packageId: 'com.example.private' },
    withHiddenField,
    Object.assign({ name: 'PDF Chef', version: '1.0', build: '1' }, { [Symbol('x')]: true }),
    { name: '', version: '1.0', build: '1' },
    { name: ' \t', version: '1.0', build: '1' },
    { name: 'PDF\0Chef', version: '1.0', build: '1' },
    { name: 'PDF Chef', version: '', build: '1' },
    { name: 'PDF Chef', version: '1.0\0', build: '1' },
    { name: 'PDF Chef', version: '1.0', build: '' },
    { name: 'PDF Chef', version: '1.0', build: ' \n' },
    { name: 'PDF Chef', version: '1.0', build: '1\0' },
    { name: 'PDF Chef', version: '1.0', build: 1 },
  ];

  for (const response of invalid) {
    const client = new AndroidAppMetadataClient(nativeStub(async () => response));
    await assert.rejects(client.getMetadata(), TypeError);
  }
});

test('native rejection identity is preserved and availability needs Android native discovery', async () => {
  const nativeError = Object.assign(new Error('metadata unavailable'), { code: 'APP_METADATA_UNAVAILABLE' });
  const client = new AndroidAppMetadataClient(nativeStub(async () => { throw nativeError; }));
  await assert.rejects(client.getMetadata(), error => error === nativeError);
  assert.equal(isAndroidAppMetadataAvailable(), false);

  const capacitor = Capacitor as unknown as {
    getPlatform(): string;
    isPluginAvailable(name: string): boolean;
  };
  const getPlatform = capacitor.getPlatform;
  const isPluginAvailable = capacitor.isPluginAvailable;
  try {
    capacitor.getPlatform = () => 'android';
    capacitor.isPluginAvailable = name => name === 'AndroidAppMetadata';
    assert.equal(isAndroidAppMetadataAvailable(), true);
    capacitor.isPluginAvailable = () => false;
    assert.equal(isAndroidAppMetadataAvailable(), false);
  } finally {
    capacitor.getPlatform = getPlatform;
    capacitor.isPluginAvailable = isPluginAvailable;
  }
});

test('native contract intentionally exposes getMetadata only', () => {
  const native = nativeStub();
  assert.deepEqual(Object.keys(native), ['getMetadata']);

  if (false) {
    // @ts-expect-error Methods beyond app metadata remain separately gated.
    native.getPackageId();
    // @ts-expect-error Methods beyond app metadata remain separately gated.
    native.addListener('metadata', () => undefined);
  }
});
