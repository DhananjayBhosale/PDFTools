import assert from 'node:assert/strict';
import test from 'node:test';

import { migrateWorkspace } from '../../services/domain/workspaceMigration.ts';

const legacy = {
  settings: { retainedPreference: true },
  outputs: [{
    id: 'legacy-1',
    filename: 'result.pdf',
    mimeType: 'application/pdf',
    size: 40,
    toolPath: '/compress',
    createdAt: 123,
  }],
};

test('migration journals unresolved blobs without guessing metadata or deleting legacy input', () => {
  const snapshot = structuredClone(legacy);
  const migrated = migrateWorkspace(legacy);

  assert.deepEqual(legacy, snapshot);
  assert.deepEqual(migrated.storedDocuments, []);
  assert.deepEqual(migrated.recentEntries, []);
  assert.deepEqual(migrated.migrationJournal, [{
    legacyId: 'legacy-1',
    status: 'pending',
    documentRef: null,
  }]);
});

test('resolved migration separates retained documents from recent entries and preserves unknown sizes', () => {
  const migrated = migrateWorkspace(legacy, undefined, { 'legacy-1': 'retained-1' });

  assert.equal(migrated.storedDocuments.length, 1);
  assert.equal(migrated.recentEntries.length, 1);
  assert.notStrictEqual(migrated.storedDocuments[0], migrated.recentEntries[0]);
  assert.equal(migrated.storedDocuments[0].sizeBytes, 40);
  assert.equal(migrated.recentEntries[0].inputSizeBytes, null);
  assert.equal(migrated.recentEntries[0].spaceSavedBytes, null);
  assert.equal(migrated.migrationJournal[0].status, 'complete');
});

test('migration is idempotent when rerun with completed state', () => {
  const once = migrateWorkspace(legacy, undefined, { 'legacy-1': 'retained-1' });
  const twice = migrateWorkspace(legacy, once, { 'legacy-1': 'retained-1' });

  assert.deepEqual(twice, once);
});

test('pending migration can resume after a durable reference becomes available', () => {
  const pending = migrateWorkspace(legacy);
  const completed = migrateWorkspace(legacy, pending, { 'legacy-1': 'retained-1' });

  assert.equal(completed.storedDocuments.length, 1);
  assert.equal(completed.recentEntries.length, 1);
  assert.equal(completed.migrationJournal[0].status, 'complete');
});

test('unknown legacy display metadata remains explicitly null', () => {
  const migrated = migrateWorkspace({ outputs: [{ id: 'unknowns' }] }, undefined, { unknowns: 'retained-2' });

  assert.deepEqual(migrated.storedDocuments[0], {
    ref: 'retained-2',
    name: null,
    mimeType: null,
    sizeBytes: null,
    contentHash: null,
    retainedAt: null,
  });
  assert.equal(migrated.recentEntries[0].toolId, null);
  assert.equal(migrated.recentEntries[0].createdAt, null);
});

test('completed journal repairs a missing retained document on rerun', () => {
  const complete = migrateWorkspace(legacy, undefined, { 'legacy-1': 'retained-1' });
  const partial = { ...complete, storedDocuments: [] };
  const repaired = migrateWorkspace(legacy, partial);

  assert.equal(repaired.storedDocuments.length, 1);
  assert.deepEqual(repaired.migrationJournal, complete.migrationJournal);
});

test('completed journal repairs a missing recent entry on rerun', () => {
  const complete = migrateWorkspace(legacy, undefined, { 'legacy-1': 'retained-1' });
  const partial = { ...complete, recentEntries: [] };
  const repaired = migrateWorkspace(legacy, partial);

  assert.equal(repaired.recentEntries.length, 1);
  assert.deepEqual(repaired.migrationJournal, complete.migrationJournal);
});
