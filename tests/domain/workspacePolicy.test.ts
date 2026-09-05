import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSpaceSaved,
  normalizeByteCount,
  toDurableDocumentRef,
  totalKnownSpaceSaved,
} from '../../services/domain/workspacePolicy.ts';

test('durable references accept opaque identifiers and reject locations', () => {
  assert.equal(toDurableDocumentRef('document-123'), 'document-123');
  assert.equal(toDurableDocumentRef('blob:temporary'), null);
  assert.equal(toDurableDocumentRef('file:///private/item.pdf'), null);
  assert.equal(toDurableDocumentRef('https://provider.example/item'), null);
  assert.equal(toDurableDocumentRef('/private/item.pdf'), null);
  assert.equal(toDurableDocumentRef('C:\\private\\item.pdf'), null);
  assert.equal(toDurableDocumentRef('folder/item'), null);
  assert.equal(toDurableDocumentRef('folder\\item'), null);
  assert.equal(toDurableDocumentRef('..'), null);
  assert.equal(toDurableDocumentRef('.'), null);
  assert.equal(toDurableDocumentRef('server/share'), null);
  assert.equal(toDurableDocumentRef('item?query'), null);
  assert.equal(toDurableDocumentRef('item#fragment'), null);
  assert.equal(toDurableDocumentRef('kind:item'), null);
  assert.equal(toDurableDocumentRef('opaque_ID-42'), 'opaque_ID-42');
  assert.equal(toDurableDocumentRef('57BEA606-5384-4EA8-BF37-541AA63C09C5'), '57BEA606-5384-4EA8-BF37-541AA63C09C5');
});

test('unknown and invalid byte counts remain null', () => {
  assert.equal(normalizeByteCount(undefined), null);
  assert.equal(normalizeByteCount('10'), null);
  assert.equal(normalizeByteCount(-1), null);
  assert.equal(normalizeByteCount(10.8), 10);
});

test('space saved stays unknown unless both sizes are known', () => {
  assert.equal(calculateSpaceSaved(null, 5), null);
  assert.equal(calculateSpaceSaved(10, null), null);
  assert.equal(calculateSpaceSaved(10, 4), 6);
  assert.equal(calculateSpaceSaved(4, 10), 0);
  assert.equal(totalKnownSpaceSaved([null, 6, 0]), 6);
});
