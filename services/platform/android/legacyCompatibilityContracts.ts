import type { DurableDocumentRef } from '../../domain/workspaceModels.ts';

export type AndroidLegacyStoreHealth = 'ok' | 'missing' | 'blank' | 'corrupt' | 'partial_invalid';
export type AndroidLegacyOpaqueRef = DurableDocumentRef & { readonly __androidLegacyOpaqueRef: unique symbol };

interface EntryBase { readonly ref: AndroidLegacyOpaqueRef; readonly displayName: string | null; readonly toolId: string | null; readonly createdAt: number | null; readonly available: boolean }
export interface AndroidLegacyFileHistoryEntry extends EntryBase { readonly kind: 'file'; readonly mimeType: string | null; readonly sizeBytes: number | null }
export interface AndroidLegacyCollectionHistoryEntry extends EntryBase { readonly kind: 'collection'; readonly itemCount: number }
export type AndroidLegacyHistoryEntry = AndroidLegacyFileHistoryEntry | AndroidLegacyCollectionHistoryEntry;

export interface AndroidLegacyHistorySnapshot {
  readonly health: AndroidLegacyStoreHealth; readonly sourceCount: number; readonly invalidRecordCount: number;
  readonly returnedCount: number; readonly truncated: boolean; readonly entries: readonly AndroidLegacyHistoryEntry[];
}
export interface AndroidLegacySettingsValues {
  readonly theme_mode?: string; readonly app_font_option?: string; readonly onboarding_completed?: boolean;
  readonly tool_usage_memory?: string; readonly savings_tally?: string; readonly tool_option_memory?: string;
  readonly last_privacy_line_index?: number;
}
export interface AndroidLegacySettingsSnapshot { readonly health: AndroidLegacyStoreHealth; readonly invalidValueCount: number; readonly values: Readonly<AndroidLegacySettingsValues> }
export interface AndroidLegacyReadCapabilities { readonly readOnly: true; readonly history: true; readonly settings: true; readonly files: true; readonly collections: true; readonly maximumHistoryEntries: 300 }
export const ANDROID_LEGACY_READ_CAPABILITIES: AndroidLegacyReadCapabilities = Object.freeze({ readOnly: true, history: true, settings: true, files: true, collections: true, maximumHistoryEntries: 300 });

const HEALTH = new Set<AndroidLegacyStoreHealth>(['ok', 'missing', 'blank', 'corrupt', 'partial_invalid']);
const BASE_KEYS = ['available', 'createdAt', 'displayName', 'kind', 'ref', 'toolId'] as const;
const FILE_KEYS = [...BASE_KEYS, 'mimeType', 'sizeBytes'] as const;
const COLLECTION_KEYS = [...BASE_KEYS, 'itemCount'] as const;
const HISTORY_KEYS = ['entries', 'health', 'invalidRecordCount', 'returnedCount', 'sourceCount', 'truncated'] as const;
const SETTINGS_KEYS = ['health', 'invalidValueCount', 'values'] as const;
const SETTING_TYPES = Object.freeze({ theme_mode: 'string', app_font_option: 'string', onboarding_completed: 'boolean', tool_usage_memory: 'string', savings_tally: 'string', tool_option_memory: 'string', last_privacy_line_index: 'number' } as const);
const FORBIDDEN_KEYS = /^(?:__proto__|prototype|constructor|storedFileName|fileName|filename|path|absolutePath|uri|url|providerAddress|bookmark|preferenceBytes|documentBytes|bytes|data|stream|items|children)$/i;
const ADDRESS_VALUE = /(?:\0|[\\/]|^[A-Za-z][A-Za-z0-9+.-]*:|\.\.)/;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const assertExactKeys = (value: Record<string, unknown>, allowed: readonly string[], label: string): void => {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new TypeError(`${label} contains forbidden field: ${key}`);
    if (!allowed.includes(key)) throw new TypeError(`${label} contains unsupported field: ${key}`);
  }
  for (const key of allowed) if (!Object.hasOwn(value, key)) throw new TypeError(`${label} is missing field: ${key}`);
};
const safeNullableString = (value: unknown, label: string): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string or null`);
  if (ADDRESS_VALUE.test(value)) throw new TypeError(`${label} contains an address-like value`);
  return value;
};
const nullableString = (value: unknown, label: string): string | null => {
  if (value === null) return null;
  if (typeof value !== 'string' || value.includes('\0')) throw new TypeError(`${label} must be a safe string or null`);
  return value;
};
const nullableNonNegativeInteger = (value: unknown, label: string): number | null => {
  if (value === null) return null;
  if (Number.isSafeInteger(value) && (value as number) >= 0) return value as number;
  throw new TypeError(`${label} must be a non-negative safe integer or null`);
};
const nonNegativeInteger = (value: unknown, label: string): number => { const parsed = nullableNonNegativeInteger(value, label); if (parsed === null) throw new TypeError(`${label} must not be null`); return parsed; };
const positiveInteger = (value: unknown, label: string): number => { const parsed = nonNegativeInteger(value, label); if (parsed === 0) throw new TypeError(`${label} must be positive`); return parsed; };
const parseEncodedObject = (value: string, label: string): Record<string, unknown> => {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new TypeError(`${label} must contain valid JSON`); }
  if (!isPlainObject(parsed)) throw new TypeError(`${label} must encode a plain object`);
  return parsed;
};
const validateCountMap = (value: unknown, label: string): void => {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object`);
  for (const [key, count] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key) || !/^[A-Z][A-Z0-9_]*$/.test(key)) throw new TypeError(`${label} contains an invalid tool key`);
    positiveInteger(count, `${label}.${key}`);
  }
};
const validateFollowUpMap = (value: unknown, label: string): void => {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object`);
  for (const [previousTool, nextTools] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(previousTool) || !/^[A-Z][A-Z0-9_]*$/.test(previousTool)) throw new TypeError(`${label} contains an invalid previous tool key`);
    validateCountMap(nextTools, `${label}.${previousTool}`);
  }
};
const validateEncodedSetting = (key: string, value: string): void => {
  const parsed = parseEncodedObject(value, key);
  if (key === 'tool_usage_memory') {
    assertExactKeys(parsed, ['followUps', 'runs'], key);
    validateCountMap(parsed.runs, `${key}.runs`);
    validateFollowUpMap(parsed.followUps, `${key}.followUps`);
  } else if (key === 'savings_tally') {
    assertExactKeys(parsed, ['bytesSaved', 'filesReduced'], key);
    nonNegativeInteger(parsed.bytesSaved, `${key}.bytesSaved`);
    nonNegativeInteger(parsed.filesReduced, `${key}.filesReduced`);
  } else if (key === 'tool_option_memory') {
    for (const [tool, option] of Object.entries(parsed)) {
      if (FORBIDDEN_KEYS.test(tool) || !/^[A-Z][A-Z0-9_]*$/.test(tool)) throw new TypeError(`${key} contains an invalid tool key`);
      if (typeof option !== 'string' || option.includes('\0')) throw new TypeError(`${key}.${tool} must be a NUL-free string`);
    }
  }
};

export const toAndroidLegacyOpaqueRef = (legacyId: number | string): AndroidLegacyOpaqueRef | null => {
  const text = typeof legacyId === 'number' ? String(legacyId) : legacyId;
  if (!/^[1-9][0-9]*$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && String(number) === text ? `a1_${text}` as AndroidLegacyOpaqueRef : null;
};
export const parseAndroidLegacyOpaqueRef = (value: unknown): AndroidLegacyOpaqueRef => {
  if (typeof value !== 'string' || !/^a1_[1-9][0-9]*$/.test(value) || toAndroidLegacyOpaqueRef(value.slice(3)) !== value) throw new TypeError('legacy ref must match a1_<canonical positive safe base-10 id>');
  return value as AndroidLegacyOpaqueRef;
};
const parseHealth = (value: unknown): AndroidLegacyStoreHealth => {
  if (typeof value !== 'string' || !HEALTH.has(value as AndroidLegacyStoreHealth)) throw new TypeError('unknown legacy store health');
  return value as AndroidLegacyStoreHealth;
};

export const parseAndroidLegacyHistoryEntry = (value: unknown): AndroidLegacyHistoryEntry => {
  if (!isPlainObject(value)) throw new TypeError('history entry must be an own plain object');
  if (!Object.hasOwn(value, 'kind')) throw new TypeError('history entry is missing kind');
  const common = () => {
    if (typeof value.available !== 'boolean') throw new TypeError('history entry available must be boolean');
    return { ref: parseAndroidLegacyOpaqueRef(value.ref), displayName: safeNullableString(value.displayName, 'history entry displayName'), toolId: safeNullableString(value.toolId, 'history entry toolId'), createdAt: nullableNonNegativeInteger(value.createdAt, 'history entry createdAt'), available: value.available };
  };
  if (value.kind === 'file') {
    assertExactKeys(value, FILE_KEYS, 'file history entry');
    return Object.freeze({ kind: 'file', ...common(), mimeType: nullableString(value.mimeType, 'file mimeType'), sizeBytes: nullableNonNegativeInteger(value.sizeBytes, 'file sizeBytes') });
  }
  if (value.kind === 'collection') {
    assertExactKeys(value, COLLECTION_KEYS, 'collection history entry');
    return Object.freeze({ kind: 'collection', ...common(), itemCount: positiveInteger(value.itemCount, 'collection itemCount') });
  }
  throw new TypeError('history entry kind must be file or collection');
};

export const parseAndroidLegacyHistorySnapshot = (value: unknown): AndroidLegacyHistorySnapshot => {
  if (!isPlainObject(value)) throw new TypeError('history snapshot must be an own plain object');
  assertExactKeys(value, HISTORY_KEYS, 'history snapshot');
  if (!Array.isArray(value.entries) || typeof value.truncated !== 'boolean') throw new TypeError('history entries/truncated are invalid');
  const health = parseHealth(value.health);
  const sourceCount = nonNegativeInteger(value.sourceCount, 'history sourceCount');
  const invalidRecordCount = nonNegativeInteger(value.invalidRecordCount, 'history invalidRecordCount');
  const returnedCount = nonNegativeInteger(value.returnedCount, 'history returnedCount');
  if (invalidRecordCount > sourceCount) throw new TypeError('history invalid count exceeds source count');
  const validSourceCount = sourceCount - invalidRecordCount;
  const entries = Object.freeze(value.entries.map(parseAndroidLegacyHistoryEntry));
  if (returnedCount !== entries.length || returnedCount !== Math.min(validSourceCount, 300)) throw new TypeError('history counts are inconsistent');
  if (value.truncated !== (validSourceCount > returnedCount)) throw new TypeError('history truncation is inconsistent');
  if (health === 'ok' && invalidRecordCount !== 0) throw new TypeError('ok history cannot contain invalid records');
  if (health === 'partial_invalid' && invalidRecordCount === 0) throw new TypeError('partial history requires invalid records');
  if (health !== 'ok' && health !== 'partial_invalid' && (sourceCount !== 0 || invalidRecordCount !== 0 || returnedCount !== 0)) throw new TypeError(`${health} history must have an empty source and return no entries`);
  return Object.freeze({ health, sourceCount, invalidRecordCount, returnedCount, truncated: value.truncated, entries });
};

export const parseAndroidLegacySettingsSnapshot = (value: unknown): AndroidLegacySettingsSnapshot => {
  if (!isPlainObject(value)) throw new TypeError('settings snapshot must be an own plain object');
  assertExactKeys(value, SETTINGS_KEYS, 'settings snapshot');
  if (!isPlainObject(value.values)) throw new TypeError('settings values must be an own plain object');
  const health = parseHealth(value.health);
  const invalidValueCount = nonNegativeInteger(value.invalidValueCount, 'settings invalidValueCount');
  const values: Record<string, boolean | number | string> = {};
  for (const [key, setting] of Object.entries(value.values)) {
    if (FORBIDDEN_KEYS.test(key) || !Object.hasOwn(SETTING_TYPES, key)) throw new TypeError(`settings contains unsupported key: ${key}`);
    const expected = SETTING_TYPES[key as keyof typeof SETTING_TYPES];
    if (typeof setting !== expected) throw new TypeError(`settings value ${key} must be ${expected}`);
    if (typeof setting === 'string' && setting.includes('\0')) throw new TypeError(`settings value ${key} contains NUL`);
    if (key === 'theme_mode' && !['SYSTEM', 'DYNAMIC', 'LIGHT', 'DARK'].includes(setting as string)) throw new TypeError('theme_mode is unknown');
    if (key === 'app_font_option' && !/^[A-Z][A-Z0-9_]*$/.test(setting as string)) throw new TypeError('app_font_option is not a strict identifier');
    if (['tool_usage_memory', 'savings_tally', 'tool_option_memory'].includes(key)) validateEncodedSetting(key, setting as string);
    if (key === 'last_privacy_line_index' && (!Number.isSafeInteger(setting) || (setting as number) < 0)) throw new TypeError(`${key} must be a non-negative safe integer`);
    values[key] = setting as boolean | number | string;
  }
  if (health === 'ok' && invalidValueCount !== 0) throw new TypeError('ok settings cannot contain invalid values');
  if (health === 'partial_invalid' && invalidValueCount === 0) throw new TypeError('partial settings require invalid values');
  if (health !== 'ok' && health !== 'partial_invalid' && (invalidValueCount !== 0 || Object.keys(values).length !== 0)) throw new TypeError(`${health} settings must return no values`);
  return Object.freeze({ health, invalidValueCount, values: Object.freeze(values) });
};
