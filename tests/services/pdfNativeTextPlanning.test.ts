import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planNativePdfTextEdits,
  resolveNativePdfTextTarget,
  type NativePdfTextTarget,
  type PdfTextObjectSnapshot,
} from '../../services/pdfNativeTextPlanning.ts';

const createObject = (text: string, objectIndex = 3, left = 72): PdfTextObjectSnapshot => {
  let cursor = left;
  let textOffset = 0;
  const characters = Array.from(text).map((character, pageCharacterIndex) => {
    const width = character === 'W' ? 18 : character === 'i' ? 4 : character === ' ' ? 5 : 10;
    const start = textOffset;
    const end = start + character.length;
    const snapshot = {
      pageCharacterIndex,
      text: character,
      start,
      end,
      bounds: [cursor, 690, cursor + width, 708] as [number, number, number, number],
    };
    cursor += width;
    textOffset = end;
    return snapshot;
  });
  return {
    objectIndex,
    text,
    bounds: [left, 690, cursor, 708],
    characters,
  };
};

const lineObject = createObject('This is a PDF file');

const targetFor = (
  object: PdfTextObjectSnapshot,
  sourceText: string,
  start = object.text.indexOf(sourceText),
): NativePdfTextTarget => {
  const end = start + sourceText.length;
  const selected = object.characters.filter((character) => character.start >= start && character.end <= end);
  return {
    sourceText,
    pdfRect: [
      Math.min(...selected.map((character) => character.bounds[0])),
      690,
      Math.max(...selected.map((character) => character.bounds[2])),
      708,
    ],
    sourceRun: {
      text: object.text,
      start,
      end,
      pdfRect: object.bounds,
    },
  };
};

test('geometry resolves one word inside a larger PDF text object', () => {
  const result = resolveNativePdfTextTarget([lineObject], targetFor(lineObject, 'PDF'));

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.target.objectIndex, 3);
  assert.equal(lineObject.text.slice(result.target.start, result.target.end), 'PDF');
});

test('repeated words use the clicked geometry instead of text alone', () => {
  const object = createObject('PDF before PDF', 3, 50);
  const result = resolveNativePdfTextTarget([object], targetFor(object, 'PDF', 11));

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.target.start, 11);
});

test('ambiguous overlapping PDF text objects fail closed', () => {
  const result = resolveNativePdfTextTarget([
    lineObject,
    { ...lineObject, objectIndex: 4 },
  ], targetFor(lineObject, 'PDF'));

  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.match(result.reason, /more than one PDF text object/);
});

test('overlapping identical text objects remain ambiguous without a hit-score shortcut', () => {
  const twin = {
    ...lineObject,
    objectIndex: 4,
    characters: lineObject.characters.map((character) => ({
      ...character,
      pageCharacterIndex: character.pageCharacterIndex + 100,
    })),
  };
  const selected = targetFor(lineObject, 'PDF');
  const result = resolveNativePdfTextTarget([lineObject, twin], selected);

  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.match(result.reason, /more than one PDF text object/);
});

test('multiple words in one object are replaced without discarding their neighbours', () => {
  const result = planNativePdfTextEdits([lineObject], [
    { ...targetFor(lineObject, 'This'), replacementText: 'That' },
    { ...targetFor(lineObject, 'PDF'), replacementText: 'DOC' },
  ]);

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.deepEqual(result.changes, [{
    objectIndex: 3,
    originalText: 'This is a PDF file',
    replacementText: 'That is a DOC file',
  }]);
});

test('overlapping edits inside one object are rejected', () => {
  const result = planNativePdfTextEdits([lineObject], [
    { ...targetFor(lineObject, 'PDF'), replacementText: 'A' },
    { ...targetFor(lineObject, 'PDF file'), replacementText: 'B' },
  ]);

  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.match(result.reason, /overlap/);
});

test('a source item must agree exactly with the PDFium text object', () => {
  const target = targetFor(lineObject, 'PDF');
  const result = resolveNativePdfTextTarget([lineObject], {
    ...target,
    sourceRun: { ...target.sourceRun!, text: 'This is a PDF split file' },
  });

  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.match(result.reason, /could not be mapped/);
});

test('real character boxes beat proportional word-width guesses', () => {
  const object = createObject('WWW iii target', 3, 50);
  const target = targetFor(object, 'target');
  const result = resolveNativePdfTextTarget([object], {
    ...target,
    pdfRect: [100, 690, 145, 708],
  });

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.deepEqual(result.target.pdfRect, target.pdfRect);
});

test('direct word deletion consumes one separator without joining neighbours', () => {
  const result = planNativePdfTextEdits([lineObject], [
    { ...targetFor(lineObject, 'PDF'), replacementText: '' },
  ]);

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.changes[0].replacementText, 'This is a file');
});

test('adjacent direct deletions compose without a double space or joined words', () => {
  const result = planNativePdfTextEdits([lineObject], [
    { ...targetFor(lineObject, 'is', 5), replacementText: '' },
    { ...targetFor(lineObject, 'a'), replacementText: '' },
  ]);

  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.changes[0].replacementText, 'This PDF file');
});
