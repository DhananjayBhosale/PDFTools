import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('shared PDF gesture hook handles trackpad, touchscreen, and Safari pinch events', () => {
  const hook = read('hooks/usePdfPinchZoom.ts');
  assert.match(hook, /event\.ctrlKey/);
  assert.match(hook, /touches\.length !== 2/);
  assert.match(hook, /gesturestart/);
  assert.match(hook, /gesturechange/);
  assert.match(hook, /passive: false/);
  assert.match(hook, /suppressPostPinchClick/);
});

test('reader, signer, and editor use the same pinch zoom viewport contract', () => {
  for (const path of [
    'components/Tools/ViewPDF.tsx',
    'components/Tools/SignPDF.tsx',
    'components/Tools/EditPDF.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /usePdfPinchZoom/);
    assert.match(source, /data-testid="pdf-zoom-viewport"/);
    assert.match(source, /chef-pdf-zoom-viewport/);
  }
});

test('Edit PDF keeps zoomed scrolling inside the PDF box and changes pages at its boundaries', () => {
  const editor = read('components/Tools/EditPDF.tsx');
  assert.match(editor, /pdfPageFromScrollBoundary/);
  assert.match(editor, /event\.ctrlKey \|\| changingPage/);
  assert.match(editor, /viewport\.addEventListener\('wheel', handlePageBoundaryWheel, \{ passive: false \}\)/);
  assert.match(editor, /nextPage > targetPageIndex/);
  assert.match(editor, /viewport\.scrollTop <= 2/);
  assert.match(editor, /viewport\.scrollTop \+ viewport\.clientHeight >= viewport\.scrollHeight - 2/);
  assert.match(editor, /nextViewport\.scrollTop = movingForward/);
  assert.equal((editor.match(/overflow-x-auto overflow-y-auto/g) || []).length, 2);
  assert.doesNotMatch(editor, /overflow-y-clip/);
  assert.doesNotMatch(editor, /window\.scrollTo/);
});
