import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getVisualPageSize,
  normalizePageRotation,
  rotatePointAroundCenter,
  rotatedBoxOrigin,
  visualPointToPdf,
  visualRectangleToPdf,
} from '../../services/pdfEditorGeometry.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const closeTo = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${actual} to equal ${expected}`);

test('a rotated box origin keeps the box centre fixed', () => {
  const origin = rotatedBoxOrigin(20, 75, 20, 10, 90);
  closeTo(origin.x, 25);
  closeTo(origin.y, 65);
});

test('a text baseline point rotates with its containing box', () => {
  const origin = rotatePointAroundCenter(10, 70, 20, 75, 90);
  closeTo(origin.x, 25);
  closeTo(origin.y, 65);
});

test('zero rotation preserves the original draw origin', () => {
  assert.deepEqual(rotatedBoxOrigin(20, 75, 20, 10, 0), { x: 10, y: 70 });
  assert.deepEqual(rotatePointAroundCenter(10, 70, 20, 75, 0), { x: 10, y: 70 });
});

test('viewport coordinates map through crop offsets and page rotation', () => {
  const base = { cropX: 20, cropY: 30, cropWidth: 600, cropHeight: 800 };
  assert.deepEqual(visualPointToPdf({ ...base, rotation: 0 }, 10, 15), { x: 30, y: 815 });
  assert.deepEqual(visualPointToPdf({ ...base, rotation: 90 }, 10, 15), { x: 35, y: 40 });
  assert.deepEqual(visualPointToPdf({ ...base, rotation: 180 }, 10, 15), { x: 610, y: 45 });
  assert.deepEqual(visualPointToPdf({ ...base, rotation: 270 }, 10, 15), { x: 605, y: 820 });
  assert.deepEqual(getVisualPageSize({ ...base, rotation: 90 }), { width: 800, height: 600 });
  assert.equal(normalizePageRotation(-90), 270);
});

test('viewport rectangles become positive PDF-space bounds', () => {
  const rectangle = visualRectangleToPdf(
    { cropX: 20, cropY: 30, cropWidth: 600, cropHeight: 800, rotation: 90 },
    10,
    15,
    100,
    20,
  );
  assert.deepEqual(rectangle, { x: 35, y: 40, width: 20, height: 100 });
});

test('the annotation exporter uses centre-corrected origins without changing ellipse semantics', () => {
  const source = readFileSync(resolve(root, 'services/pdfDocument.ts'), 'utf8');
  const exporter = source.slice(source.indexOf('export const savePDFWithAnnotations'), source.indexOf('export interface SignaturePlacement'));

  assert.equal((exporter.match(/const origin = rotatedBoxOrigin\(/g) ?? []).length, 3);
  assert.match(exporter, /page\.drawRectangle\(\{\s*x: origin\.x,\s*y: origin\.y,/);
  assert.match(exporter, /page\.drawImage\(image, \{\s*x: origin\.x,\s*y: origin\.y,/);
  assert.match(exporter, /const origin = rotatePointAroundCenter\([\s\S]*page\.drawText\(line, \{\s*x: origin\.x,\s*y: origin\.y,/);
  assert.match(exporter, /page\.drawEllipse\(\{\s*x: center\.x,\s*y: center\.y,/);
  assert.match(exporter, /const start = visualPointToPdf\(geometry, visualX, visualY\)/);
  assert.match(exporter, /rotate: degrees\(geometry\.rotation \+ rotation\)/);
});

test('the annotation exporter limits backdrops to visual fallback and skips direct text overlays', () => {
  const source = readFileSync(resolve(root, 'services/pdfDocument.ts'), 'utf8');
  const exporter = source.slice(source.indexOf('export const savePDFWithAnnotations'), source.indexOf('export interface SignaturePlacement'));
  const patchLoop = exporter.indexOf("candidate.replacementSource?.saveMode !== 'native'");
  const annotationLoop = exporter.indexOf('for (const element of elements)');

  assert.ok(patchLoop >= 0, 'replacement backdrop loop is missing');
  assert.ok(annotationLoop > patchLoop, 'replacement backdrops must be painted before annotations');
  assert.match(exporter, /const source = element\.replacementSource!/);
  assert.match(exporter, /source\.backgroundMode === 'solid'/);
  assert.match(exporter, /if \(element\.replacementSource\?\.saveMode === 'native'\) continue/);
  assert.match(exporter, /color: hexToRgb\(source\.backgroundColor\)/);
  assert.match(exporter, /pdfDoc\.embedPng\(sourcePreview\.backgroundImage\)/);
  assert.match(exporter, /source\.nativePreview \?\? source/);
  assert.match(exporter, /element\.content \+ \(element\.replacementSource\.nativePreview\?\.suffix \?\? ''\)/);
  assert.match(exporter, /visualRectangleToPdf/);
  assert.match(exporter, /rotate: degrees\(geometry\.rotation \+ rotation\)/);
});
