import assert from 'node:assert/strict';
import test from 'node:test';
import { Capacitor } from '@capacitor/core';
import {
  AndroidDocumentScannerClient,
  isAndroidDocumentScannerAvailable,
  type AndroidDocumentScannerNativePlugin,
} from '../../services/platform/android/androidDocumentScanner.ts';

const ownedItem = {
  kind: 'file',
  ref: `d1_${'A'.repeat(22)}`,
  displayName: 'Scanned document.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 25,
  contentHash: 'a'.repeat(64),
  createdAt: 1,
  available: true,
  pending: false,
} as const;

test('client sends the exact empty request and freezes a completed durable result', async () => {
  const calls: unknown[] = [];
  const native: AndroidDocumentScannerNativePlugin = {
    scan: async options => {
      calls.push(options);
      return { status: 'completed', item: ownedItem, pageCount: 2, jpegPageCount: 2 };
    },
  };
  const result = await new AndroidDocumentScannerClient(native).scan();
  assert.deepEqual(calls, [{}]);
  assert.equal(result.status, 'completed');
  if (result.status === 'completed') {
    assert.equal(result.item.ref, ownedItem.ref);
    assert.equal(result.item.mimeType, 'application/pdf');
    assert.equal(Object.isFrozen(result.item), true);
  }
  assert.equal(Object.isFrozen(result), true);
});

test('cancellation is a successful distinct result', async () => {
  const native: AndroidDocumentScannerNativePlugin = {
    scan: async () => ({
      status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0,
    }),
  };
  assert.deepEqual(await new AndroidDocumentScannerClient(native).scan(), {
    status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0,
  });
});

test('result requires an exact plain four-field envelope', async () => {
  const inherited = Object.assign(
    Object.create({ uri: 'content://private' }),
    { status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0 },
  );
  const hidden = { status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0 };
  Object.defineProperty(hidden, 'path', { value: '/private/scan.pdf' });
  const symbol = Object.assign(
    { status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0 },
    { [Symbol('private')]: true },
  );
  const invalid: unknown[] = [
    null,
    [],
    'cancelled',
    Object.create(null),
    { status: 'cancelled', item: null, pageCount: 0 },
    { status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 0, uri: 'content://private' },
    inherited,
    hidden,
    symbol,
  ];
  for (const value of invalid) {
    const native: AndroidDocumentScannerNativePlugin = { scan: async () => value };
    await assert.rejects(new AndroidDocumentScannerClient(native).scan(), TypeError);
  }
});

test('cancelled shape cannot carry item or page data', async () => {
  for (const value of [
    { status: 'cancelled', item: ownedItem, pageCount: 0, jpegPageCount: 0 },
    { status: 'cancelled', item: null, pageCount: 1, jpegPageCount: 0 },
    { status: 'cancelled', item: null, pageCount: 0, jpegPageCount: 1 },
  ]) {
    const native: AndroidDocumentScannerNativePlugin = { scan: async () => value };
    await assert.rejects(new AndroidDocumentScannerClient(native).scan(), TypeError);
  }
});

test('completed result strictly validates page counts and owned item metadata', async () => {
  const invalidItems: unknown[] = [
    { ...ownedItem, ref: 'a1_1' },
    { ...ownedItem, ref: 'file:///private/scan.pdf' },
    { ...ownedItem, displayName: 'bad/name.pdf' },
    { ...ownedItem, mimeType: 'image/jpeg' },
    { ...ownedItem, sizeBytes: 0 },
    { ...ownedItem, sizeBytes: Number.MAX_SAFE_INTEGER + 1 },
    { ...ownedItem, contentHash: 'A'.repeat(64) },
    { ...ownedItem, createdAt: -1 },
    { ...ownedItem, available: false },
    { ...ownedItem, pending: true },
    { ...ownedItem, path: '/private/scan.pdf' },
  ];
  for (const item of invalidItems) {
    const native: AndroidDocumentScannerNativePlugin = {
      scan: async () => ({ status: 'completed', item, pageCount: 1, jpegPageCount: 1 }),
    };
    await assert.rejects(new AndroidDocumentScannerClient(native).scan(), TypeError);
  }
  for (const counts of [
    { pageCount: 0, jpegPageCount: 0 },
    { pageCount: 1.5, jpegPageCount: 1.5 },
    { pageCount: 1, jpegPageCount: 2 },
    { pageCount: Number.MAX_SAFE_INTEGER + 1, jpegPageCount: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const native: AndroidDocumentScannerNativePlugin = {
      scan: async () => ({ status: 'completed', item: ownedItem, ...counts }),
    };
    await assert.rejects(new AndroidDocumentScannerClient(native).scan(), TypeError);
  }
});

test('native rejection identity is preserved', async () => {
  const nativeError = Object.assign(new Error('unavailable'), { code: 'SCANNER_UNAVAILABLE' });
  const native: AndroidDocumentScannerNativePlugin = {
    scan: async () => { throw nativeError; },
  };
  await assert.rejects(
    new AndroidDocumentScannerClient(native).scan(),
    error => error === nativeError,
  );
});

test('availability requires Android plus exact native discovery', () => {
  const capacitor = Capacitor as unknown as {
    getPlatform(): string;
    isPluginAvailable(name: string): boolean;
  };
  const getPlatform = capacitor.getPlatform;
  const isPluginAvailable = capacitor.isPluginAvailable;
  const queriedNames: string[] = [];
  try {
    capacitor.getPlatform = () => 'android';
    capacitor.isPluginAvailable = name => {
      queriedNames.push(name);
      return name === 'AndroidDocumentScanner';
    };
    assert.equal(isAndroidDocumentScannerAvailable(), true);
    capacitor.isPluginAvailable = name => {
      queriedNames.push(name);
      return false;
    };
    assert.equal(isAndroidDocumentScannerAvailable(), false);
    capacitor.getPlatform = () => 'ios';
    capacitor.isPluginAvailable = name => {
      queriedNames.push(name);
      return true;
    };
    assert.equal(isAndroidDocumentScannerAvailable(), false);
    assert.deepEqual(queriedNames, ['AndroidDocumentScanner', 'AndroidDocumentScanner']);
  } finally {
    capacitor.getPlatform = getPlatform;
    capacitor.isPluginAvailable = isPluginAvailable;
  }
});
