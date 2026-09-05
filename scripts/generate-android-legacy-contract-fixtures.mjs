import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(root, 'tests/fixtures/android-legacy');
const check = process.argv.includes('--check');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const file = (id, overrides = {}) => ({ kind: 'file', ref: `a1_${id}`, displayName: `Synthetic ${String(id).padStart(3, '0')}.pdf`, toolId: ['compress', 'merge', 'split', 'protect'][id % 4], createdAt: 1_700_000_000_000 + id, available: true, mimeType: 'application/pdf', sizeBytes: 8_000 + id, ...overrides });
const collection = (id, overrides = {}) => ({ kind: 'collection', ref: `a1_${id}`, displayName: `Synthetic batch ${id}`, toolId: 'images-to-pdf', createdAt: 1_700_000_000_000 + id, available: true, itemCount: 3, ...overrides });
const history = (count, overrides = {}) => ({ health: 'ok', sourceCount: count, invalidRecordCount: 0, returnedCount: Math.min(count, 300), truncated: count > 300, entries: Array.from({ length: count }, (_, index) => file(count - index)).slice(0, 300), ...overrides });
const settings = (health, invalidValueCount = 0, values = {}) => ({ health, invalidValueCount, values });
const rawRecord = (id, overrides = {}) => ({ id, displayName: `Synthetic ${id}.pdf`, toolName: ['Compress PDF', 'Merge PDF', 'Split PDF'][id % 3], sizeBytes: 8_000 + id, createdAtMillis: 1_700_000_000_000 + id, storedFileName: `synthetic-${id}.pdf`, mimeType: 'application/pdf', isDirectory: false, itemCount: 1, ...overrides });
const rawIndex = count => Array.from({ length: count }, (_, index) => rawRecord(index + 1));

const cases = new Map();
for (const count of [0, 1, 50, 300, 301]) {
  const suffix = String(count).padStart(3, '0');
  cases.set(`public/history-${suffix}.json`, json(history(count)));
  cases.set(`raw/valid/index-${suffix}.json`, json(rawIndex(count)));
}
cases.set('public/valid-file.json', json(file(1)));
cases.set('public/valid-collection.json', json(collection(2)));
cases.set('public/unavailable-file.json', json(file(3, { available: false })));
cases.set('public/unicode-long-name.json', json(file(4, { displayName: `रिपोर्ट-你好-${'A'.repeat(180)}.pdf` })));
cases.set('public/history-partial-invalid.json', json(history(2, { health: 'partial_invalid', invalidRecordCount: 1, returnedCount: 1, truncated: false, entries: [file(2)] })));
for (const health of ['missing', 'blank', 'corrupt']) cases.set(`public/history-${health}.json`, json(history(0, { health })));
cases.set('public/settings-ok.json', json(settings('ok', 0, { theme_mode: 'DYNAMIC', app_font_option: 'INTER', onboarding_completed: true, tool_usage_memory: JSON.stringify({ runs: { COMPRESS: 3 }, followUps: { COMPRESS: { PROTECT: 2 } } }), savings_tally: JSON.stringify({ bytesSaved: 3250, filesReduced: 2 }), tool_option_memory: JSON.stringify({ COMPRESS: 'quality=75; mode=balanced', WATERMARK: 'text=Internal / Draft; url=https://example.invalid/watermark?id=1&lang=en' }), last_privacy_line_index: 2 })));
cases.set('public/settings-partial-invalid.json', json(settings('partial_invalid', 1, { theme_mode: 'DARK' })));
for (const health of ['missing', 'blank', 'corrupt']) cases.set(`public/settings-${health}.json`, json(settings(health)));
cases.set('boundary-input/reject-file-address.json', json(file(5, { displayName: '../private.pdf' })));
cases.set('boundary-input/reject-file-stored-name.json', json({ ...file(5), storedFileName: 'private.pdf' }));
cases.set('boundary-input/reject-collection-mime.json', json({ ...collection(6), mimeType: 'application/zip' }));
cases.set('boundary-input/reject-collection-bytes.json', json({ ...collection(6), bytes: 'AA==' }));
cases.set('boundary-input/reject-collection-zero.json', json(collection(6, { itemCount: 0 })));
cases.set('boundary-input/reject-settings-key.json', json(settings('ok', 0, { storedFileName: 'private.pdf' })));
cases.set('boundary-input/reject-settings-value.json', json(settings('ok', 0, { tool_usage_memory: 'valid text\u0000hidden' })));
cases.set('boundary-input/reject-tool-usage-memory-shape.json', json(settings('ok', 0, { tool_usage_memory: JSON.stringify({ runs: { COMPRESS: 3 }, followUps: { COMPRESS: 2 } }) })));
cases.set('boundary-input/reject-savings-tally-shape.json', json(settings('ok', 0, { savings_tally: JSON.stringify({ inputBytes: 12500, outputBytes: 9250 }) })));
cases.set('boundary-input/reject-tool-option-memory-shape.json', json(settings('ok', 0, { tool_option_memory: JSON.stringify({ compress: { quality: 75 }, watermark: { text: 'A/B' } }) })));
cases.set('raw/valid/index-directory-output.json', json([rawRecord(1, { displayName: 'Synthetic images', storedFileName: 'synthetic-images', toolName: 'PDF to Images', sizeBytes: 24000, mimeType: '', isDirectory: true, itemCount: 3 })]));
cases.set('raw/invalid/index-traversal-name.json', json([rawRecord(1, { storedFileName: '../escape.pdf' })]));
cases.set('raw/invalid/index-invented-toolId.json', json([{ ...rawRecord(1), toolId: 'compress' }]));
cases.set('raw/invalid/index-invented-outputKind.json', json([{ ...rawRecord(1), outputKind: 'directory' }]));
cases.set('raw/invalid/index-invented-outputExists.json', json([{ ...rawRecord(1), outputExists: false }]));
cases.set('raw/state/virtual-files-missing-output.json', json({ files: { 'missing.pdf': false } }));
cases.set('raw/state/index-corrupt-bytes.bin', '\u0000\u0001not-json\u00ff');
cases.set('raw/state/index-truncated-json.txt', '[{"id":1,"storedFileName":"cut.pdf"}');
cases.set('raw/state/index-blank.txt', '');
cases.set('raw/state/index-missing.marker', 'SYNTHETIC_MISSING\n');
cases.set('raw/interrupted/processed_index.json', json(rawIndex(1)));
cases.set('raw/interrupted/processed_index.json.tmp', json(rawIndex(2)));

const listFiles = async (directory, prefix = '') => {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) result.push(...await listFiles(join(directory, item.name), name)); else result.push(name);
  }
  return result.sort();
};

if (check) {
  let names;
  try { names = await listFiles(fixtureRoot); } catch { throw new Error('Android legacy fixtures are missing'); }
  const expected = [...cases.keys()].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error('Android legacy fixture file set is stale');
  for (const [name, content] of cases) if (await readFile(join(fixtureRoot, name), 'utf8') !== content) throw new Error(`${relative(root, join(fixtureRoot, name))} is stale`);
  console.log(`PASS: ${cases.size} deterministic Android legacy fixtures are current`);
} else {
  await rm(fixtureRoot, { recursive: true, force: true });
  for (const [name, content] of cases) { const target = join(fixtureRoot, name); await mkdir(dirname(target), { recursive: true }); await writeFile(target, content); }
  console.log(`Wrote ${cases.size} deterministic Android legacy fixtures`);
}
