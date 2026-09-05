import assert from 'node:assert/strict';
import test from 'node:test';
import { boundsFitWithinCropBox } from '../../services/pdfTextEditSafety.ts';

test('text must fit every edge of an offset CropBox', () => {
  const cropBox = [20, 10, 592, 782];
  assert.equal(boundsFitWithinCropBox([20, 10, 592, 782], cropBox), true);
  for (const bounds of [
    [19, 50, 100, 100],
    [50, 9, 100, 100],
    [50, 50, 593, 100],
    [50, 50, 100, 783],
  ]) {
    assert.equal(boundsFitWithinCropBox(bounds, cropBox), false);
  }
});

test('only the configured rounding tolerance may cross a page edge', () => {
  const cropBox = [0, 0, 612, 792];
  assert.equal(boundsFitWithinCropBox([-0.25, -0.25, 612.25, 792.25], cropBox), true);
  assert.equal(boundsFitWithinCropBox([0, 0, 612.251, 792], cropBox), false);
  assert.equal(boundsFitWithinCropBox([-0.01, 0, 612, 792], cropBox, 0), false);
});

test('reversed rectangle coordinates normalize without losing offset bounds', () => {
  assert.equal(boundsFitWithinCropBox([100, 100, 50, 50], [592, 782, 20, 10]), true);
  assert.equal(boundsFitWithinCropBox([700, 100, 50, 50], [592, 782, 20, 10]), false);
});

test('invalid geometry and invalid tolerances fail closed', () => {
  const cropBox = [0, 0, 612, 792];
  for (const bounds of [[0, 0, 1], [0, 0, 1, 1, 2], [0, NaN, 1, 1], [0, 0, Infinity, 1]]) {
    assert.equal(boundsFitWithinCropBox(bounds, cropBox), false);
  }
  for (const invalidCropBox of [[0, 0, 0, 792], [0, 0, 612, 0], [0, 0, NaN, 792], [0, 0, 612]]) {
    assert.equal(boundsFitWithinCropBox([0, 0, 1, 1], invalidCropBox), false);
  }
  for (const tolerance of [-1, NaN, Infinity]) {
    assert.equal(boundsFitWithinCropBox([0, 0, 1, 1], cropBox, tolerance), false);
  }
});
