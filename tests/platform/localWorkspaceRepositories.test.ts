import assert from 'node:assert/strict';
import test from 'node:test';
import type { DurableDocumentRef, RecentEntry } from '../../services/domain/workspaceModels.ts';
import {
  LocalRecentRepository,
  LocalSettingsRepository,
  WORKSPACE_RECENT_KEY,
  WORKSPACE_SETTINGS_KEY,
  type LocalStringStorage,
} from '../../services/platform/local/localWorkspaceRepositories.ts';

class MemoryStorage implements LocalStringStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const entry = (id: string, ref = `DOC-${id}` as DurableDocumentRef): RecentEntry => ({
  id,
  documentRef: ref,
  name: `${id}.pdf`,
  mimeType: 'application/pdf',
  toolId: 'compress-pdf',
  createdAt: 100,
  inputSizeBytes: 20,
  outputSizeBytes: 10,
  spaceSavedBytes: 10,
});

test('settings round-trip JSON data and fail closed on corrupted payloads', async () => {
  const storage = new MemoryStorage();
  const repository = new LocalSettingsRepository(storage);
  await repository.save({ schemaVersion: 1, values: { theme: 'system', offline: true } });
  assert.deepEqual(await repository.load(), {
    schemaVersion: 1,
    values: { theme: 'system', offline: true },
  });

  storage.values.set(WORKSPACE_SETTINGS_KEY, '{broken');
  assert.equal(await repository.load(), null);
  await repository.clear();
  assert.equal(storage.getItem(WORKSPACE_SETTINGS_KEY), null);
});

test('recent repository persists newest first and supports get, delete and clear', async () => {
  const storage = new MemoryStorage();
  const repository = new LocalRecentRepository(storage);
  await repository.save(entry('one'));
  await repository.save(entry('two'));
  assert.deepEqual((await repository.list()).map(value => value.id), ['two', 'one']);
  assert.equal((await repository.get('one'))?.name, 'one.pdf');

  await repository.delete('two');
  assert.deepEqual((await repository.list()).map(value => value.id), ['one']);
  await repository.clear();
  assert.deepEqual(await repository.list(), []);
});

test('save and delete preserve unknown or newer-schema records', async () => {
  const storage = new MemoryStorage();
  const unknown = { schemaVersion: 99, id: 'future', encryptedPayload: 'opaque' };
  storage.setItem(WORKSPACE_RECENT_KEY, JSON.stringify([unknown, entry('old')]));
  const repository = new LocalRecentRepository(storage);

  await repository.save(entry('new'));
  await repository.delete('old');

  const raw = JSON.parse(storage.getItem(WORKSPACE_RECENT_KEY)!) as unknown[];
  assert.deepEqual(raw, [entry('new'), unknown]);
  assert.deepEqual((await repository.list()).map(value => value.id), ['new']);
});

test('invalid entries cannot overwrite durable local history', async () => {
  const storage = new MemoryStorage();
  const repository = new LocalRecentRepository(storage);
  await repository.save(entry('kept'));
  const before = storage.getItem(WORKSPACE_RECENT_KEY);

  await assert.rejects(
    repository.save({ ...entry('bad'), documentRef: '../private' as DurableDocumentRef }),
    /persistence contract/,
  );
  assert.equal(storage.getItem(WORKSPACE_RECENT_KEY), before);
});
