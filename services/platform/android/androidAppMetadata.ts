import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ApplicationMetadata } from '../../domain/workspaceModels.ts';

export interface AndroidAppMetadataNativePlugin {
  getMetadata(): Promise<unknown>;
}

const AndroidAppMetadataNative =
  registerPlugin<AndroidAppMetadataNativePlugin>('AndroidAppMetadata');

export const isAndroidAppMetadataAvailable = (): boolean =>
  Capacitor.getPlatform() === 'android'
  && Capacitor.isPluginAvailable('AndroidAppMetadata');

const OUTPUT_KEYS = ['build', 'name', 'version'] as const;

const invalidResponse = (): TypeError => new TypeError('Android application metadata response is invalid.');

const isPublicText = (value: unknown): value is string =>
  typeof value === 'string' && !value.includes('\0') && !/^\s*$/u.test(value);

const isNullablePublicText = (value: unknown): value is string | null =>
  value === null || isPublicText(value);

const parseMetadata = (value: unknown): ApplicationMetadata => {
  if (value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalidResponse();
  }

  const record = value as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(record);
  if (ownKeys.some(key => typeof key !== 'string')) throw invalidResponse();
  const keys = (ownKeys as string[]).sort();
  if (keys.length !== OUTPUT_KEYS.length
      || keys.some((key, index) => key !== OUTPUT_KEYS[index])) {
    throw invalidResponse();
  }
  if (!isPublicText(record.name)
      || !isPublicText(record.version)
      || !isNullablePublicText(record.build)) {
    throw invalidResponse();
  }

  return Object.freeze({
    name: record.name,
    version: record.version,
    build: record.build,
  });
};

export class AndroidAppMetadataClient {
  private readonly native: AndroidAppMetadataNativePlugin;

  /** Runtime callers use the registered proxy; injection exists only for isolated contract tests. */
  constructor(native: AndroidAppMetadataNativePlugin = AndroidAppMetadataNative) {
    this.native = native;
  }

  async getMetadata(): Promise<ApplicationMetadata> {
    return parseMetadata(await this.native.getMetadata());
  }
}
