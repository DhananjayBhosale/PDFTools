import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTextReplacementDraft,
  selectableTextSourceRunId,
  replacementTextBoxWidth,
  selectableTextLineId,
} from '../../services/pdfEditorTextReplacement.ts';

const line = {
  text: 'This is a PDF file',
  left: 72,
  top: 120,
  width: 144,
  height: 14,
};

test('selectable text line IDs are stable and page-specific', () => {
  const first = selectableTextLineId(0, line);
  assert.equal(first, selectableTextLineId(0, { ...line }));
  assert.notEqual(first, selectableTextLineId(1, line));
  assert.match(first, /^pdf-text-0-[a-z0-9]+$/);
});

test('all word targets from one PDF source run share one stable run ID', () => {
  const sourceRun = {
    text: 'This is a PDF file',
    left: 72,
    top: 120,
    width: 144,
    height: 14,
    pdfRect: [72, 658, 216, 672] as [number, number, number, number],
  };
  const firstWord = { ...line, text: 'This', width: 28, sourceRun: { ...sourceRun, start: 0, end: 4 } };
  const secondWord = { ...line, text: 'PDF', left: 144, width: 24, sourceRun: { ...sourceRun, start: 10, end: 13 } };

  assert.equal(selectableTextSourceRunId(0, firstWord), selectableTextSourceRunId(0, secondWord));
  assert.notEqual(selectableTextSourceRunId(0, firstWord), selectableTextSourceRunId(1, firstWord));
});

test('replacement drafts preserve exact immutable source bounds', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 0,
    pageWidth: 612,
    pageHeight: 792,
    line,
    backgroundImage: 'data:image/png;base64,backdrop',
  });

  assert.equal(draft.type, 'text');
  assert.equal(draft.content, line.text);
  assert.equal(draft.fontFamily, 'Helvetica');
  assert.equal(draft.color, '#000000');
  assert.equal(draft.replacementSource.text, line.text);
  assert.equal(draft.replacementSource.backgroundMode, 'automatic');
  assert.equal(draft.replacementSource.backgroundImage, 'data:image/png;base64,backdrop');
  assert.equal(draft.replacementSource.backgroundColor, '#ffffff');
  assert.equal(draft.replacementSource.saveMode, 'visual');
  assert.equal(draft.replacementSource.nativeEligible, false);
  assert.equal(draft.replacementSource.pageWidth, 612);
  assert.equal(draft.x, line.left / 612);
  assert.equal(draft.y, line.top / 792);
  assert.equal(draft.width, line.width / 612);
  assert.equal(draft.height, line.height / 792);
  assert.deepEqual(
    { x: draft.x, y: draft.y, width: draft.width, height: draft.height },
    {
      x: draft.replacementSource.x,
      y: draft.replacementSource.y,
      width: draft.replacementSource.width,
      height: draft.replacementSource.height,
    },
  );
});

test('native-capable replacement drafts default to direct PDF text editing', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 0,
    pageWidth: 612,
    pageHeight: 792,
    line: {
      text: 'PDF',
      left: 144,
      top: 120,
      width: 24,
      height: 14,
      pdfRect: [144, 658, 168, 672],
      sourceRun: {
        text: 'This is a PDF file',
        start: 10,
        end: 13,
        left: 72,
        top: 120,
        width: 144,
        height: 14,
      },
    },
    backgroundImage: 'data:image/png;base64,run-mask',
    nativeCapability: { supported: true },
  });

  assert.equal(draft.replacementSource.saveMode, 'native');
  assert.equal(draft.replacementSource.nativeEligible, true);
  assert.deepEqual(draft.replacementSource.pdfRect, [144, 658, 168, 672]);
  assert.equal(draft.replacementSource.nativePreview?.backgroundImage, 'data:image/png;base64,run-mask');
  assert.equal(draft.replacementSource.backgroundImage, draft.replacementSource.nativePreview?.backgroundImage);
  assert.equal(draft.replacementSource.nativePreview?.suffix, ' file');
  assert.equal(draft.replacementSource.nativePreview?.x, 144 / 612);
  assert.equal(draft.replacementSource.nativePreview?.width, 72 / 612);
  assert.equal(draft.replacementSource.nativePreview?.y, 119 / 792);
  assert.ok(Math.abs((draft.replacementSource.nativePreview?.height ?? 0) - 19.48 / 792) < 1e-12);
});

test('visual fallback drafts preserve the remaining source run for collision-free redraw', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 0,
    pageWidth: 612,
    pageHeight: 792,
    line: {
      text: 'PDF',
      left: 144,
      top: 120,
      width: 24,
      height: 14,
      sourceRun: {
        text: 'This is a PDF file',
        start: 10,
        end: 13,
        left: 72,
        top: 120,
        width: 144,
        height: 14,
      },
    },
    backgroundImage: 'data:image/png;base64,run-mask',
    nativeCapability: {
      supported: false,
      reason: 'Unsupported PDF text operator.',
    },
  });

  assert.equal(draft.replacementSource.saveMode, 'visual');
  assert.equal(draft.replacementSource.nativeEligible, false);
  assert.equal(draft.replacementSource.nativePreview?.backgroundImage, 'data:image/png;base64,run-mask');
  assert.equal(draft.replacementSource.backgroundImage, draft.replacementSource.nativePreview?.backgroundImage);
  assert.equal(draft.replacementSource.nativePreview?.suffix, ' file');
  assert.equal(draft.replacementSource.nativePreview?.x, 144 / 612);
  assert.equal(draft.replacementSource.nativePreview?.width, 72 / 612);
  assert.equal(draft.fontSize, 14);
  assert.equal(draft.replacementSource.nativePreview?.y, 119 / 792);
  assert.ok(Math.abs((draft.replacementSource.nativePreview?.height ?? 0) - 19.48 / 792) < 1e-12);
});

test('visual fallback preserves small source text instead of snapping it to the manual annotation range', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 0,
    pageWidth: 612,
    pageHeight: 792,
    line: {
      text: 'Fine',
      left: 72,
      top: 120,
      width: 18,
      height: 6,
    },
    backgroundImage: 'data:image/png;base64,fine-print-mask',
  });

  assert.equal(draft.fontSize, 6);
});

test('large source text receives discriminating top and descender guard bands', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 0,
    pageWidth: 612,
    pageHeight: 792,
    line: {
      text: 'Large',
      left: 72,
      top: 120,
      width: 160,
      height: 80,
    },
    backgroundImage: 'data:image/png;base64,large-mask',
  });

  assert.equal(draft.fontSize, 80);
  assert.equal(draft.replacementSource.nativePreview?.y, 116 / 792);
  assert.equal(draft.replacementSource.nativePreview?.height, 109.6 / 792);
});

test('replacement boxes expand to show longer text and stay on the page', () => {
  assert.equal(replacementTextBoxWidth({ measuredTextWidth: 300, pageWidth: 600, sourceWidth: 0.2, x: 0.1 }), 0.52);
  assert.equal(replacementTextBoxWidth({ measuredTextWidth: 10, pageWidth: 600, sourceWidth: 0.2, x: 0.1 }), 0.2);
  assert.ok(Math.abs(replacementTextBoxWidth({ measuredTextWidth: 600, pageWidth: 600, sourceWidth: 0.2, x: 0.7 }) - 0.3) < 1e-9);
});

test('replacement geometry is clamped to the page', () => {
  const draft = createTextReplacementDraft({
    pageIndex: 2,
    pageWidth: 100,
    pageHeight: 100,
    line: { text: 'Edge', left: 0, top: 0, width: 100, height: 12 },
    backgroundImage: 'data:image/png;base64,edge',
  });

  assert.equal(draft.x, 0);
  assert.equal(draft.y, 0);
  assert.equal(draft.width, 1);
  assert.ok(draft.height > 0 && draft.height <= 1);
});


test('Visual fallback requires exact word boundaries, upright source text, and a safe patch', () => {
  const pdfRect: [number, number, number, number] = [72, 658, 216, 672];
  const sourceRun = { ...line, start: 0, end: line.text.length, pdfRect, isHorizontal: true };
  const options = {
    pageIndex: 0, pageWidth: 612, pageHeight: 792,
    line: { ...line, pdfRect, sourceRun },
    backgroundImage: 'data:image/png;base64,patch',
    nativeCapability: { supported: true, match: { pdfRect, sourceRun } },
  };
  assert.equal(createTextReplacementDraft(options).replacementSource.visualEligible, true);
  for (const overrides of [
    { nativeCapability: { supported: false } },
    { line: { ...options.line, sourceRun: { ...sourceRun, isHorizontal: false } } },
    { backgroundImage: undefined },
  ]) {
    const source = createTextReplacementDraft({ ...options, ...overrides }).replacementSource;
    assert.equal(source.visualEligible, false);
    assert.match(source.visualUnavailableReason!, /Visual fallback is unavailable/);
  }
});
