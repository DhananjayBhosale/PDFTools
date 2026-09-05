import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DurableDocumentRef } from '../../domain/workspaceModels.ts';
import type { DocumentScannerService } from '../contracts.ts';

export interface AndroidDocumentScannerNativePlugin {
  scan(options: Readonly<Record<string, never>>): Promise<unknown>;
}

export interface AndroidScannedDocument {
  readonly kind: 'file';
  readonly ref: string;
  readonly displayName: string;
  readonly mimeType: 'application/pdf';
  readonly sizeBytes: number;
  readonly contentHash: string;
  readonly createdAt: number;
  readonly available: true;
  readonly pending: false;
}

export type AndroidDocumentScanResult = Readonly<
  | {
      status: 'completed';
      item: AndroidScannedDocument;
      pageCount: number;
      jpegPageCount: number;
    }
  | {
      status: 'cancelled';
      item: null;
      pageCount: 0;
      jpegPageCount: 0;
    }
>;

const AndroidDocumentScanner =
  registerPlugin<AndroidDocumentScannerNativePlugin>('AndroidDocumentScanner');

const RESULT_KEYS = ['item', 'jpegPageCount', 'pageCount', 'status'] as const;
const ITEM_KEYS = [
  'available',
  'contentHash',
  'createdAt',
  'displayName',
  'kind',
  'mimeType',
  'pending',
  'ref',
  'sizeBytes',
] as const;
const OWNED_REF = /^d1_[A-Za-z0-9_-]{22,64}$/;
const CONTENT_HASH = /^[0-9a-f]{64}$/;

const invalidResponse = (): TypeError =>
  new TypeError('Android document scanner response is invalid.');

const exactObject = (
  value: unknown,
  expected: readonly string[],
): Record<string, unknown> => {
  if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalidResponse();
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')
      || keys.length !== expected.length
      || !(keys as string[]).sort().every((key, index) => key === expected[index])) {
    throw invalidResponse();
  }
  return value as Record<string, unknown>;
};

const isSafeInteger = (value: unknown, minimum: number): value is number =>
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= minimum;

const isSafeDisplayName = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && value.length <= 180
  && !value.includes('\0')
  && !value.includes('/')
  && !value.includes('\\');

const parseItem = (value: unknown): AndroidScannedDocument => {
  const item = exactObject(value, ITEM_KEYS);
  if (item.kind !== 'file'
      || typeof item.ref !== 'string'
      || !OWNED_REF.test(item.ref)
      || !isSafeDisplayName(item.displayName)
      || item.mimeType !== 'application/pdf'
      || !isSafeInteger(item.sizeBytes, 1)
      || typeof item.contentHash !== 'string'
      || !CONTENT_HASH.test(item.contentHash)
      || !isSafeInteger(item.createdAt, 0)
      || item.available !== true
      || item.pending !== false) {
    throw invalidResponse();
  }
  return Object.freeze(item as unknown as AndroidScannedDocument);
};

const parseResult = (value: unknown): AndroidDocumentScanResult => {
  const result = exactObject(value, RESULT_KEYS);
  if (result.status === 'cancelled') {
    if (result.item !== null || result.pageCount !== 0 || result.jpegPageCount !== 0) {
      throw invalidResponse();
    }
    return Object.freeze({
      status: 'cancelled',
      item: null,
      pageCount: 0,
      jpegPageCount: 0,
    });
  }
  if (result.status !== 'completed'
      || !isSafeInteger(result.pageCount, 1)
      || !isSafeInteger(result.jpegPageCount, 1)
      || result.jpegPageCount !== result.pageCount) {
    throw invalidResponse();
  }
  return Object.freeze({
    status: 'completed',
    item: parseItem(result.item),
    pageCount: result.pageCount,
    jpegPageCount: result.jpegPageCount,
  });
};

export const isAndroidDocumentScannerAvailable = (): boolean =>
  Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('AndroidDocumentScanner');

export class AndroidDocumentScannerClient {
  private readonly native: AndroidDocumentScannerNativePlugin;

  /** Runtime callers use the registered proxy; injection exists only for contract tests. */
  constructor(native: AndroidDocumentScannerNativePlugin = AndroidDocumentScanner) {
    this.native = native;
  }

  async scan(): Promise<AndroidDocumentScanResult> {
    return parseResult(await this.native.scan({}));
  }
}

export const createAndroidDocumentScannerService = (
  client: AndroidDocumentScannerClient = new AndroidDocumentScannerClient(),
): DocumentScannerService => ({
  async scan() {
    const result = await client.scan();
    if (result.status === 'cancelled') return Object.freeze({ status: 'cancelled' as const });
    return Object.freeze({
      status: 'completed' as const,
      document: Object.freeze({
        ref: result.item.ref as DurableDocumentRef,
        name: result.item.displayName,
        mimeType: result.item.mimeType,
        sizeBytes: result.item.sizeBytes,
        contentHash: result.item.contentHash,
        retainedAt: result.item.createdAt,
      }),
      pageCount: result.pageCount,
    });
  },
});
