import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBoundedPageRange } from '../../services/pageRange.ts';

test('parses, deduplicates, and orders pages as zero-based indexes', () => {
  assert.deepEqual(parseBoundedPageRange('5, 2-4, 3', 8), [1, 2, 3, 4]);
});

test('rejects an out-of-bounds range before expanding it', () => {
  const started = performance.now();
  assert.throws(
    () => parseBoundedPageRange('1-999999999', 20),
    /outside this PDF/,
  );
  assert.ok(performance.now() - started < 50, 'rejection should not depend on the requested range size');
});

test('rejects reversed, zero, malformed, and excessively fragmented input', () => {
  assert.throws(() => parseBoundedPageRange('8-3', 10), /low to high/);
  assert.throws(() => parseBoundedPageRange('0', 10), /outside this PDF/);
  assert.throws(() => parseBoundedPageRange('2,wat', 10), /not a valid page or range/);
  assert.throws(() => parseBoundedPageRange(Array.from({ length: 257 }, () => '1').join(','), 10), /too (?:long|many groups)/);
});
