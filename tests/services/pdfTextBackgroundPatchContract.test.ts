import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('text-free patch filtering stays coupled to the reviewed PDF.js optimizer', () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const installedPdfJs = JSON.parse(
    readFileSync(resolve(root, 'node_modules/pdfjs-dist/package.json'), 'utf8'),
  );
  const browser = readFileSync(resolve(root, 'services/pdfBrowser.ts'), 'utf8');

  assert.equal(packageJson.dependencies['pdfjs-dist'], '6.3.289');
  assert.equal(packageLock.packages[''].dependencies['pdfjs-dist'], '6.3.289');
  assert.equal(packageLock.packages['node_modules/pdfjs-dist'].version, '6.3.289');
  assert.equal(installedPdfJs.version, '6.3.289');
  assert.match(browser, /maximumObservedOperationIndex \+ 1 !== operatorList\.fnArray\.length/);
  assert.match(browser, /Revisit this invariant whenever PDF\.js changes its optimiser registrations/);
});
