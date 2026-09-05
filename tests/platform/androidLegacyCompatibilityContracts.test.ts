import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { ANDROID_LEGACY_READ_CAPABILITIES, parseAndroidLegacyHistoryEntry, parseAndroidLegacyHistorySnapshot, parseAndroidLegacyOpaqueRef, parseAndroidLegacySettingsSnapshot, toAndroidLegacyOpaqueRef } from '../../services/platform/android/legacyCompatibilityContracts.ts';

const fixture = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../fixtures/android-legacy/public/${name}`, import.meta.url), 'utf8'));
const boundaryFixture = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../fixtures/android-legacy/boundary-input/${name}`, import.meta.url), 'utf8'));
const RAW_KEYS = ['createdAtMillis', 'displayName', 'id', 'isDirectory', 'itemCount', 'mimeType', 'sizeBytes', 'storedFileName', 'toolName'];
const assertRawRecord = (value: unknown): void => {
  assert.equal(typeof value, 'object'); assert.ok(value !== null && !Array.isArray(value));
  const record = value as Record<string, unknown>;
  assert.deepEqual(Object.keys(record).sort(), RAW_KEYS);
  for (const key of ['id', 'sizeBytes', 'createdAtMillis', 'itemCount']) assert.ok(Number.isSafeInteger(record[key]));
  for (const key of ['displayName', 'toolName', 'storedFileName', 'mimeType']) assert.equal(typeof record[key], 'string');
  assert.equal(typeof record.isDirectory, 'boolean');
};

test('opaque refs accept only canonical positive safe base-10 ids', () => {
  assert.equal(toAndroidLegacyOpaqueRef(1), 'a1_1');
  for (const invalid of [0, -1, '0', '01', '+1', '1.0', 'temp', '../1', '9007199254740992']) assert.equal(toAndroidLegacyOpaqueRef(invalid), null);
  for (const invalid of ['a1_0', 'a1_01', 'a1_temp_1', 'a1_1/path', 'file:///a1_1']) assert.throws(() => parseAndroidLegacyOpaqueRef(invalid));
});

test('history caps only valid records and retains a 301-record source count', async () => {
  for (const count of [0, 1, 50, 300, 301]) {
    const parsed = parseAndroidLegacyHistorySnapshot(await fixture(`history-${String(count).padStart(3, '0')}.json`));
    assert.equal(parsed.sourceCount, count); assert.equal(parsed.invalidRecordCount, 0);
    assert.equal(parsed.returnedCount, Math.min(count, 300)); assert.equal(parsed.truncated, count > 300);
    if (count) assert.equal(parsed.entries[0]?.ref, `a1_${count}`);
  }
  const partial = parseAndroidLegacyHistorySnapshot(await fixture('history-partial-invalid.json'));
  assert.equal(partial.invalidRecordCount, 1); assert.equal(partial.returnedCount, 1); assert.equal(partial.truncated, false);
});

test('file and collection decoders are closed and collections cannot be coerced', async () => {
  const file = parseAndroidLegacyHistoryEntry(await fixture('valid-file.json'));
  const collection = parseAndroidLegacyHistoryEntry(await fixture('valid-collection.json'));
  assert.equal(file.kind, 'file'); assert.equal(collection.kind, 'collection');
  if (collection.kind === 'collection') assert.equal(collection.itemCount, 3);
  for (const name of ['reject-collection-mime.json', 'reject-collection-bytes.json', 'reject-collection-zero.json']) await assert.rejects(async () => parseAndroidLegacyHistoryEntry(await boundaryFixture(name)));
});

test('display/tool metadata is sanitized and unavailable/Unicode cases remain representable', async () => {
  const unavailable = parseAndroidLegacyHistoryEntry(await fixture('unavailable-file.json'));
  const unicode = parseAndroidLegacyHistoryEntry(await fixture('unicode-long-name.json'));
  assert.equal(unavailable.available, false); assert.ok((unicode.displayName?.length ?? 0) > 180);
  for (const name of ['reject-file-address.json', 'reject-file-stored-name.json']) await assert.rejects(async () => parseAndroidLegacyHistoryEntry(await boundaryFixture(name)));
});

test('five health states and invalid counts cannot collapse or abuse truncation', async () => {
  for (const health of ['missing', 'blank', 'corrupt'] as const) {
    const parsed = parseAndroidLegacyHistorySnapshot(await fixture(`history-${health}.json`));
    assert.equal(parsed.health, health); assert.equal(parsed.returnedCount, 0);
    assert.equal(parseAndroidLegacySettingsSnapshot(await fixture(`settings-${health}.json`)).health, health);
  }
  assert.equal(parseAndroidLegacyHistorySnapshot(await fixture('history-partial-invalid.json')).health, 'partial_invalid');
  assert.equal(parseAndroidLegacySettingsSnapshot(await fixture('settings-partial-invalid.json')).health, 'partial_invalid');
});

test('settings expose only the seven verified keys and scalar types', async () => {
  const source = await fixture('settings-ok.json') as { values: Record<string, unknown> };
  const parsed = parseAndroidLegacySettingsSnapshot(source);
  assert.deepEqual(Object.keys(parsed.values).sort(), ['app_font_option', 'last_privacy_line_index', 'onboarding_completed', 'savings_tally', 'theme_mode', 'tool_option_memory', 'tool_usage_memory']);
  for (const name of ['reject-settings-key.json', 'reject-settings-value.json']) await assert.rejects(async () => parseAndroidLegacySettingsSnapshot(await boundaryFixture(name)));
  assert.equal(parsed.values.theme_mode, 'DYNAMIC'); assert.equal(parsed.values.app_font_option, 'INTER');
  assert.deepEqual(JSON.parse(parsed.values.tool_usage_memory ?? ''), { runs: { COMPRESS: 3 }, followUps: { COMPRESS: { PROTECT: 2 } } });
  assert.match(parsed.values.tool_option_memory ?? '', /text=Internal \/ Draft; url=https:\/\/example\.invalid\/watermark\?id=1&lang=en/);
  for (const key of ['tool_usage_memory', 'savings_tally', 'tool_option_memory']) assert.equal(parsed.values[key as keyof typeof parsed.values], source.values[key], `${key} must be preserved byte-for-byte`);
  for (const name of ['reject-tool-usage-memory-shape.json', 'reject-savings-tally-shape.json', 'reject-tool-option-memory-shape.json']) await assert.rejects(async () => parseAndroidLegacySettingsSnapshot(await boundaryFixture(name)));
});

test('every valid raw index JSON uses exactly the authoritative fields and types', async () => {
  const directory = new URL('../fixtures/android-legacy/raw/valid/', import.meta.url);
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  assert.deepEqual(names, ['index-000.json', 'index-001.json', 'index-050.json', 'index-300.json', 'index-301.json', 'index-directory-output.json']);
  for (const name of names) {
    const records = JSON.parse(await readFile(new URL(name, directory), 'utf8')) as unknown[];
    assert.ok(Array.isArray(records));
    for (const record of records) assertRawRecord(record);
  }
  const directoryRecord = JSON.parse(await readFile(new URL('index-directory-output.json', directory), 'utf8'))[0] as Record<string, unknown>;
  assert.equal(directoryRecord.isDirectory, true); assert.equal(directoryRecord.itemCount, 3);
  assert.equal(directoryRecord.sizeBytes, 24000); assert.equal(directoryRecord.toolName, 'PDF to Images');
  const threeHundredOne = JSON.parse(await readFile(new URL('index-301.json', directory), 'utf8')) as unknown[];
  assert.equal(threeHundredOne.length, 301);
});

test('invented raw index fields are rejected and availability stays in a companion manifest', async () => {
  const invalidDirectory = new URL('../fixtures/android-legacy/raw/invalid/', import.meta.url);
  for (const name of ['index-invented-toolId.json', 'index-invented-outputKind.json', 'index-invented-outputExists.json']) {
    const record = JSON.parse(await readFile(new URL(name, invalidDirectory), 'utf8'))[0];
    assert.throws(() => assertRawRecord(record));
  }
  const manifest = JSON.parse(await readFile(new URL('../fixtures/android-legacy/raw/state/virtual-files-missing-output.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest, { files: { 'missing.pdf': false } });
});

test('interrupted committed and temp indexes are distinct valid synthetic snapshots', async () => {
  const directory = new URL('../fixtures/android-legacy/raw/interrupted/', import.meta.url);
  const committed = JSON.parse(await readFile(new URL('processed_index.json', directory), 'utf8')) as unknown[];
  const temporary = JSON.parse(await readFile(new URL('processed_index.json.tmp', directory), 'utf8')) as unknown[];
  assert.equal(committed.length, 1); assert.equal(temporary.length, 2); assert.notDeepEqual(committed, temporary);
  for (const record of [...committed, ...temporary]) assertRawRecord(record);
});

test('snapshot invariants reject impossible counts, truncation and nonempty unreadable sources', async () => {
  const valid = await fixture('history-001.json') as Record<string, unknown>;
  for (const invalid of [
    { ...valid, sourceCount: 0, invalidRecordCount: 1, entries: [], returnedCount: 0 },
    { ...valid, returnedCount: 0 },
    { ...valid, truncated: true },
    { ...valid, health: 'missing', sourceCount: 1 },
    { ...valid, health: 'blank', sourceCount: 1 },
    { ...valid, health: 'corrupt', sourceCount: 1 },
  ]) assert.throws(() => parseAndroidLegacyHistorySnapshot(invalid));
});

test('plain own objects are required and dangerous prototype fields are rejected', () => {
  const inherited = Object.create({ kind: 'file' }) as Record<string, unknown>;
  assert.throws(() => parseAndroidLegacyHistoryEntry(inherited));
  const dangerous = JSON.parse('{"kind":"collection","ref":"a1_1","displayName":"Batch","toolId":"merge","createdAt":1,"available":true,"itemCount":1,"__proto__":{}}');
  assert.throws(() => parseAndroidLegacyHistoryEntry(dangerous));
});

test('capabilities remain strictly read-only', () => {
  assert.deepEqual(ANDROID_LEGACY_READ_CAPABILITIES, { readOnly: true, history: true, settings: true, files: true, collections: true, maximumHistoryEntries: 300 });
  assert.equal(Object.keys(ANDROID_LEGACY_READ_CAPABILITIES).some(key => /write|delete|clear|repair|migrat|copy|prune/i.test(key)), false);
});
