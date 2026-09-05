import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupPositionedTextItems,
  positionedTextItemsToWordTargets,
  type PositionedPdfTextItem,
} from '../../services/pdfTextLineGrouping.ts';

const item = (text: string, left: number, width: number, top = 20, height = 10): PositionedPdfTextItem => ({
  text,
  left,
  top,
  right: left + width,
  bottom: top + height,
  height,
  centerY: top + height / 2,
});

test('nearby PDF text items remain one editable phrase', () => {
  const lines = groupPositionedTextItems([
    item('This is', 10, 30),
    item('a PDF file', 44, 44),
  ]);

  assert.deepEqual(lines, [{ text: 'This is a PDF file', left: 10, top: 20, width: 78, height: 10 }]);
});

test('distant columns become independent editable targets', () => {
  const lines = groupPositionedTextItems([
    item('DHANANJAY BHOSALE', 10, 90),
    item('Credit Card Number', 260, 85),
  ]);

  assert.deepEqual(lines, [
    { text: 'DHANANJAY BHOSALE', left: 10, top: 20, width: 90, height: 10 },
    { text: 'Credit Card Number', left: 260, top: 20, width: 85, height: 10 },
  ]);
});

test('vertical rows remain separate while each row can split into columns', () => {
  const lines = groupPositionedTextItems([
    item('Label A', 10, 35),
    item('Value A', 180, 35),
    item('Label B', 10, 35, 50),
    item('Value B', 180, 35, 50),
  ]);

  assert.deepEqual(lines.map((line) => line.text), ['Label A', 'Value A', 'Label B', 'Value B']);
});

test('selectable PDF text becomes position-specific word targets', () => {
  const targets = positionedTextItemsToWordTargets([
    item('This is a PDF file', 10, 90),
    item('Second column', 180, 65),
  ]);

  assert.deepEqual(targets.map((target) => target.text), [
    'This',
    'is',
    'a',
    'PDF',
    'file',
    'Second',
    'column',
  ]);
  assert.deepEqual(
    targets.map((target) => [Number(target.left.toFixed(2)), Number(target.width.toFixed(2))]),
    [
      [10, 20],
      [35, 10],
      [50, 5],
      [60, 15],
      [80, 20],
      [180, 30],
      [215, 30],
    ],
  );
  assert.ok(targets.every((target) => !/\s/.test(target.text)));
  assert.deepEqual(targets[3]?.sourceRun, {
    text: 'This is a PDF file',
    start: 10,
    end: 13,
    left: 10,
    top: 20,
    width: 90,
    height: 10,
    isHorizontal: false,
  });
});

test('rotated source runs split words along their text-matrix advance', () => {
  const targets = positionedTextItemsToWordTargets([{
    text: 'Rotate target safely',
    left: 50,
    top: 20,
    right: 60,
    bottom: 120,
    height: 100,
    centerY: 70,
    quad: {
      x: 50,
      y: 20,
      advanceX: 0,
      advanceY: 100,
      riseX: 10,
      riseY: 0,
    },
    sourcePdfRect: [72, 700, 240, 718],
  }]);

  assert.deepEqual(targets.map(({ text, left, top, width, height }) => ({
    text,
    left: Number(left.toFixed(2)),
    top: Number(top.toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  })), [
    { text: 'Rotate', left: 50, top: 20, width: 10, height: 30 },
    { text: 'target', left: 50, top: 55, width: 10, height: 30 },
    { text: 'safely', left: 50, top: 90, width: 10, height: 30 },
  ]);
  assert.deepEqual(targets[1]?.sourceRun?.pdfRect, [72, 700, 240, 718]);
});


test('Visual orientation eligibility uses the displayed text quad and rejects skew or mirroring', () => {
  const quad = { x: 10, y: 30, advanceX: 90, advanceY: 0, riseX: 0, riseY: -10 };
  for (const [changes, expected] of [
    [{}, true],
    [{ advanceY: 8 }, false],
    [{ riseX: 2 }, false],
    [{ advanceX: -90 }, false],
    [{ riseY: 10 }, false],
    [{ advanceX: 0, advanceY: 90, riseX: 10, riseY: 0 }, false],
  ] as const) {
    const targets = positionedTextItemsToWordTargets([{ ...item('Word target', 10, 90), quad: { ...quad, ...changes } }]);
    assert.equal(targets[0].sourceRun?.isHorizontal, expected);
  }
});
