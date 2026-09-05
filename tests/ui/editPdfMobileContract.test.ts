import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const app = read('App.tsx');
const editor = read('components/Tools/EditPDF.tsx');
const nativeTextEditor = read('services/pdfNativeTextEditor.ts');

test('Edit PDF runs inside the data router required by the navigation blocker', () => {
  assert.match(app, /createBrowserRouter/);
  assert.match(app, /<RouterProvider router=\{router\}/);
  assert.match(editor, /const navigationBlocker = useBlocker\(hasUnsavedEdits\)/);
});

test('compact browser and iOS viewports share the immersive editor', () => {
  assert.match(editor, /matchMedia\('\(max-width: 767px\)'\)/);
  assert.match(editor, /const isCompactViewportEditor = Boolean\(file\) && compactViewport/);
  assert.match(editor, /const isImmersiveEditor = isNativeAndroidEditor \|\| isCompactViewportEditor/);
  assert.doesNotMatch(editor, /!Capacitor\.isNativePlatform\(\) && compactViewport/);
});

test('dirty edits block routes and unload, while load and save establish clean baselines', () => {
  assert.match(editor, /const hasUnsavedEdits = Boolean\(file\) && currentSnapshot !== savedSnapshot/);
  assert.match(editor, /window\.addEventListener\('beforeunload', handleBeforeUnload\)/);
  assert.match(editor, /setSavedSnapshot\(serializeEditorState\(\[\], nextFormValues\)\)/);
  assert.match(editor, /setSavedSnapshot\(currentSnapshot\)/);
  assert.match(editor, /navigationBlocker\.proceed\(\)/);
  assert.match(editor, /navigationBlocker\.reset\(\)/);
  const save = editor.slice(editor.indexOf('const handleSave'), editor.indexOf('if (isImmersiveEditor)'));
  assert.match(save, /await deliverBlob\([\s\S]*setSavedSnapshot\(currentSnapshot\)/);
  assert.match(save, /error\.name === 'AbortError'/);
});

test('selection-only pointer presses preserve Redo and history writes stay outside state updaters', () => {
  const pointerStarts = editor.slice(editor.indexOf('const handleStart'), editor.indexOf('const handleKeyDown'));
  assert.doesNotMatch(pointerStarts, /onBeginChange\(\)/);
  assert.match(editor, /if \(!gestureChanged\.current\) \{\s*onBeginChange\(\);\s*gestureChanged\.current = true;/);

  const commit = editor.slice(editor.indexOf('const commitElements'), editor.indexOf('const undo ='));
  assert.match(commit, /const next = updater\(elementsRef\.current\)/);
  assert.match(commit, /undoStack\.current = [\s\S]*replaceElements\(next\)/);
  assert.doesNotMatch(commit, /setElements\(\(current\) =>/);
});

test('added elements support movement and resizing while source-text replacements stay position locked', () => {
  assert.match(editor, /\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'\]\.includes\(event\.key\)/);
  assert.match(editor, /const step = event\.shiftKey \? 0\.05 : 0\.01/);
  assert.match(editor, /if \(nextX === element\.x && nextY === element\.y\) return/);
  assert.match(editor, /if \(clampedWidth === width && clampedHeight === height\) return/);
  assert.equal((editor.match(/if \(!event\.repeat\) onBeginChange\(\)/g) ?? []).length, 2);
  assert.match(editor, /onKeyDown=\{handleResizeKeyDown\}/);
  assert.match(editor, /aria-label="Resize selected element with arrow keys"/);
  assert.match(editor, /use arrow keys to move/);
  assert.match(editor, /const isSourceTextReplacement = Boolean\(element\.replacementSource\)/);
  assert.match(editor, /if \(isSourceTextReplacement\) return;/);
  assert.match(editor, /isSelected && !isSourceTextReplacement/);
  assert.match(editor, /Direct edits preserve searchable PDF text and export no patch\./);
});

test('selected text annotations edit directly on the page with one history snapshot per focus session', () => {
  assert.match(editor, /const inlineTextEditorRef = useRef<HTMLTextAreaElement>\(null\)/);
  assert.match(editor, /inlineTextEditor\.setSelectionRange\(0, inlineTextEditor\.value\.length\)/);
  assert.match(editor, /aria-label=\{`Edit text on page \$\{element\.pageIndex \+ 1\}`\}/);
  assert.match(editor, /if \(!inlineTextChanged\.current\) \{\s*onBeginChange\(\);\s*inlineTextChanged\.current = true;/);
  assert.match(editor, /onUpdate\(element\.id, \{[\s\S]*content: element\.replacementSource[\s\S]*event\.currentTarget\.value/);
  assert.match(editor, /onBlur=\{\(event\) => \{\s*inlineTextChanged\.current = false;\s*event\.currentTarget\.scrollLeft = 0;\s*event\.currentTarget\.scrollTop = 0;/);
  assert.match(editor, /onKeyDown=\{\(event\) => \{\s*event\.stopPropagation\(\);/);
  assert.equal((editor.match(/lineHeight: 1\.2/g) ?? []).length, 3);
});

test('mobile and desktop inspector text fields group typing into one undo snapshot', () => {
  assert.match(editor, /const inspectorTextChanged = useRef\(false\)/);
  assert.match(editor, /if \(!inspectorTextChanged\.current\) \{\s*rememberSnapshot\(\);\s*inspectorTextChanged\.current = true;/);
  assert.equal(
    (editor.match(/onChange=\{\(event\) => updateInspectorText\(selectedElement\.id, event\.currentTarget\.value\)\}/g) ?? []).length,
    2,
  );
  assert.equal((editor.match(/onBlur=\{finishInspectorTextChange\}/g) ?? []).length, 2);
  assert.doesNotMatch(editor, /Text<input[^>]*onChange=\{\(event\) => commitElementUpdate/);
});

test('selectable PDF words become accessible direct-edit targets without OCR', () => {
  assert.match(editor, /getPageSelectableTextLines/);
  assert.match(editor, /aria-label=\{`Edit existing PDF word: \$\{line\.text\}`\}/);
  assert.match(editor, /title="Click a word to edit it"/);
  assert.match(editor, /onReplaceTextLine\(line, \{ width: dims\.w, height: dims\.h \}\)/);
  assert.match(editor, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(editor, /replacementSource\.id/);
  assert.match(editor, /existingSourceIds\.has\(lineId\)/);
  assert.match(editor, /existingSourceRunIds\.has\(sourceRunId\)/);
  assert.match(editor, /data-source-run-id=\{sourceRunId\}/);
  assert.match(editor, /insertMode \? 'pointer-events-none'/);
  assert.match(editor, /tabIndex=\{insertMode \? -1 : 0\}/);
  assert.match(editor, /replacementTextBoxWidth/);
  assert.match(editor, /replacementPreviewSuffix/);
  assert.match(editor, /getReplacementPreviewMetrics/);
  assert.match(editor, /baselineOffset: fontSize - cssBaseline/);
  assert.equal(
    (editor.match(/translateY\(\$\{replacementPreviewMetrics\.baselineOffset\}px\)/g) ?? []).length,
    3,
  );
  assert.match(editor, /data-testid="replacement-preview-content-measure"/);
  assert.match(editor, /data-testid=\{element\.replacementSource \? 'replacement-text-preview' : undefined\}/);
  assert.match(editor, /data-testid="existing-pdf-selection-underline"/);
  assert.match(editor, /getTextReplacementPreviewLine/);
  assert.match(editor, /getPageTextBackgroundPatch/);
  assert.match(editor, /event\.key === 'Enter' && element\.replacementSource/);
  assert.match(editor, /event\.currentTarget\.value\.replace\(\/\\s\*\\r\?\\n\\s\*\/g, ' '\)/);
  assert.match(editor, /resizeReplacementForText\(replacementDraft, \{ content: replacementDraft\.content \}\)/);
  assert.match(editor, /Direct text edits stay searchable and use no patch/);
  assert.doesNotMatch(editor, /OCR.*existing PDF text/i);
});

test('replacement source backdrops stay fixed and solid fill is optional', () => {
  assert.match(editor, /replacementSourceBackdrops/);
  assert.match(editor, /Original PDF font on save · No patch/);
  assert.match(editor, /'data-testid': 'replacement-source-backdrop'/);
  assert.match(editor, /source\.backgroundMode === 'solid'/);
  assert.match(editor, /checked=\{selectedElement\.replacementSource\.backgroundMode === 'solid'\}/);
  assert.match(editor, />Solid background</);
  assert.match(editor, />Direct text</);
  assert.match(editor, />Visual fallback</);
  assert.match(editor, /source\.saveMode === 'visual' && source\.backgroundMode === 'solid'/);
  assert.match(editor, /const sourcePreview = source\.nativePreview \?\? source/);
  assert.match(editor, /createTextReplacementDraft/);
  assert.match(editor, /commitElements\(\(current\) => current\.some[\s\S]*: \[\.\.\.current, replacement\]\)/);
  assert.match(editor, /setSelectedId\(replacement\.id\)/);
  assert.match(editor, /hasReplacementStatus/);
  assert.match(editor, /replacementSource \? replacementSaveModeMessage\(replacementSource\) : ''/);
  assert.match(editor, /Visual fallback is active/);
  assert.match(editor, /disabled=\{!selectedElement\.replacementSource\.visualEligible\}/);
});

test('native text analysis budget starts only after the reusable PDFium document is open', () => {
  const open = nativeTextEditor.indexOf('const cached = await openInspectionDocument(engine, file);');
  const started = nativeTextEditor.indexOf('const startedAt = performance.now();', open);
  const inspected = nativeTextEditor.indexOf('const result = inspectTarget(', started);
  assert.ok(open >= 0 && started > open && inspected > started);
});

test('existing-text replacements fit their source line without padding clipping', () => {
  assert.match(editor, /const replacementLineHeight = element\.replacementSource/);
  assert.match(editor, /Math\.max\(1, \(element\.fontSize \|\| 16\) \* 1\.2\)/);
  assert.equal(
    (editor.match(/element\.replacementSource \? 'p-0' : 'px-1\.5 py-1'/g) ?? []).length,
    2,
  );
  assert.equal(
    (editor.match(/minHeight: replacementLineHeight \? `\$\{replacementLineHeight\}px` : undefined/g) ?? []).length,
    2,
  );
  assert.match(editor, /whiteSpace: element\.replacementSource \? 'pre' : 'pre-wrap'/);
});

test('immersive content reserves the measured bottom bar height', () => {
  assert.match(editor, /const immersiveBottomBarRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(editor, /const observer = new ResizeObserver\(updateHeight\)/);
  assert.match(editor, /ref=\{immersiveBottomBarRef\}/);
  assert.match(editor, /paddingBottom: `calc\(\$\{immersiveBottomBarHeight\}px \+ var\(--chef-keyboard-inset, 0px\)\)`/);
  assert.doesNotMatch(editor, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom/);
});
