# Selectable PDF Text Replacement Design

## Scope

PDF Chef will let a user click a selectable text line in Edit PDF, edit that line in place, and save a visually replaced result. Image-only and scanned text is deliberately ignored; OCR is out of scope.

## Interaction

- PDF.js extracts positioned text lines from each visible page.
- A transparent, keyboard-focusable hit target is placed over each detected line.
- Activating a line creates one selected text replacement prefilled with the detected content and immediately focuses its inline editor.
- The original line is visually covered by a text-free rendering of its existing page backdrop, while the replacement can use the existing text colour, font, size, move, resize, Undo, and Redo controls.
- A solid background is optional and off by default. When enabled, its colour remains configurable from the mobile and desktop inspectors.
- Deleting the replacement restores the original page appearance.
- Lines that already have a replacement are not offered again.
- Longer replacement text expands its on-canvas box to keep the complete exported line visible; the box stays within the page.
- Replacements stay single-line. Enter commits editing, and pasted line breaks become spaces.
- While mobile Text or Shape placement mode is active, existing-text targets are removed from pointer and keyboard interaction.
- The editor explains that this is visual replacement, not redaction or paragraph reflow.

## Saved PDF

Each replacement records exact immutable source bounds separately from the editable replacement bounds. PDF.js renders that source region while omitting text-painting operators, producing a local backdrop that retains page colour and graphics without a visible white box. Export draws that backdrop, or the optional solid fill, before all annotations and replacement text. CropBox offsets and 0/90/180/270-degree page rotation are applied when preview coordinates are mapped into PDF user space.

The original PDF content stream is not rewritten. The covered text may remain recoverable by copy, search, accessibility, or forensic tools, so the feature must never be described as deletion, sanitisation, or redaction.

## Architecture

- `services/pdfBrowser.ts` remains the selectable-text detection authority.
- `services/pdfBrowser.ts` reconstructs the selected line’s page backdrop without text-painting operations.
- `services/pdfEditorTextReplacement.ts` converts detected PDF.js line geometry into normalized replacement metadata.
- `components/Tools/EditPDF.tsx` renders line hit targets and uses the existing annotation selection/history model.
- `services/pdfDocument.ts` paints automatic backdrops or optional solid fills before annotation text.
- The shared React build is synchronized unchanged into the Android and iOS Capacitor packages.

## Failure Handling

- A page with no selectable text renders no edit targets and otherwise behaves normally.
- Text extraction failure on one page does not prevent page rendering or annotation editing.
- Unsupported fonts and colours fall back to the existing Helvetica/black controls.
- Save failure retains all edits and the dirty-state guard.

## Acceptance

- Clicking or keyboard-activating detected text focuses a prefilled inline editor.
- One typing session produces one Undo entry.
- The original line is visually hidden in preview and saved output.
- Long replacement text is fully visible before export.
- Cropped and rotated-page exports preserve the preview position.
- A replacement can be deleted to restore the original preview.
- Coloured page regions retain their existing backdrop by default without a visible white rectangle.
- Solid background is off by default, can be enabled explicitly, and exposes its colour only while enabled.
- Scanned/image-only pages receive no detected-text controls.
- Focused unit, contract, mobile browser, desktop browser, build, Android packaging, and iOS packaging checks pass.
