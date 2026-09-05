# Page Override

## Screen

- Name: Edit PDF (`/edit`)
- User goal: place and edit annotations directly on the document, review the page, and save a PDF that matches the canvas

## Deviations From Master

- Selecting a text annotation focuses its on-canvas editor and selects its content. The inspector remains available for precise property editing, but it is never required to edit the text.
- One continuous typing session creates one Undo entry, whether text is changed on the canvas or through the inspector.
- Rectangle, image, and text rotation is previewed and exported around the same visual centre. Ellipses already use a centre origin; lines and arrows use endpoints instead of rotation.
- Canvas and exported multiline text share a `1.2` line-height contract.
- Selectable PDF.js text exposes keyboard-focusable word targets. Activating one word creates a directly focused replacement prefilled with only that word, so typing does not replace an unrelated sentence or table row.
- An existing-text replacement is position locked and has no drag or resize affordance. It edits like text, not like an added annotation. Deliberately added text, images, and shapes remain movable and resizable.
- A safe, uniquely matched word defaults to Direct text. The complete PDF.js source item must match one visible PDFium text object, and the word must occupy one contiguous range of PDFium character boxes. The source word is rewritten inside that object at save time, preserving extractable text, the original PDF font, and the object transform. Direct output contains no backdrop image or solid rectangle.
- Direct and Visual fallback previews mask the source run from the edited word through its unchanged suffix, then display the new word and suffix as one continuous, non-wrapping line. This prevents doubled or overlapping old text while keeping the editable value scoped to one word.
- The text-free source patch includes a small vertical guard band around the PDF.js line box. It removes residual ascender and descender pixels without adding a coloured or white fill; surrounding artwork is reconstructed from the original page.
- Automatic reconstruction verifies that the unoptimised PDF.js operator list still aligns with the display list used by the render filter. If PDF.js merges operations, that patch is discarded. A Direct-eligible word may use a disclosed preview-only solid mask because its saved PDF never consumes the preview; Visual fallback stays unavailable so an unsafe patch cannot be exported.
- After one word is replaced, sibling word targets from the same underlying PDF text run are withheld until that replacement is deleted. This prevents a second edit from using stale character coordinates or redrawing the same suffix twice.
- Existing-text selection uses a dedicated thin underline below the source bounds plus the text caret, not a border through the glyphs or a draggable rectangular box. Keyboard focus retains a visible focus indicator.
- The browser preview uses the selected CSS font's measured ascent/descent to align its baseline with the PDF source baseline and exported `top + fontSize` baseline. The selection underline follows the measured replacement-text width, not the padded editor width.
- A word whose page geometry is missing, ambiguous, or unsupported defaults to a clearly named Visual fallback. Its backdrop is reconstructed from the page with text rendering omitted, so coloured and designed pages do not receive a forced white rectangle. Deleting the replacement restores the original preview and target.
- Replacement fields expand to reveal longer single-line text while staying within the page. Both save modes place the unchanged suffix immediately after the measured replacement text, independent of the editor box width. Visual fallback clears the affected source run and redraws that suffix in the export; an explicit solid background remains optional.
- Visual fallback preserves the source font size, including fine print below the ordinary 8-point annotation range. Its inspector permits 1–512 points so touching the control does not silently snap a preserved small source size to 8 points.
- Existing-text replacements remain single-line: Enter commits inline editing and pasted line breaks are normalized to spaces.
- Existing-text replacements use a padding-free inline surface and a presentation-only minimum height equal to the shared `1.2` line height. This prevents clipped text and carets without changing the source or export coordinates; ordinary added text keeps its standard padding.
- Existing-text targets yield to mobile Text/Shape insert mode, so a placement tap cannot accidentally create a replacement.
- Replacement backdrops, text, shapes, and images use the visible CropBox and page rotation when mapping preview coordinates into the saved PDF.
- Direct text is the default only after a PDFium dry-run match. A Save mode control exposes Direct text and Visual fallback. “Solid background” is an explicit unchecked option only in Visual fallback; its colour control appears only when enabled.
- Pinch zoom is attached to the document viewport and updates the same persistent zoom state as the toolbar. Two-finger touch and Mac trackpad pinch work on mobile and desktop; one-finger page scrolling, annotation dragging, and the visible zoom controls remain unchanged.
- The PDF box owns horizontal and vertical scrolling at every zoom level, so the surrounding app page stays stable while inspecting a zoomed document. Above 100%, ordinary vertical trackpad scrolling advances to the adjacent page only after reaching the PDF box boundary. Forward navigation lands at the next page top; backward navigation lands at the previous page bottom. Pinch events remain reserved for zoom.
- Editable PDF text is targeted one detected word at a time. PDF.js text-matrix geometry follows horizontal, rotated, or skewed run direction; the provisional hit is then replaced by PDFium's exact character-box geometry. Text-only matching is never sufficient when the same word occurs more than once.

## Constraints

- Mobile uses the immersive editor below 768px; desktop retains its toolbar and labelled inspector.
- Selection, editing, moving, resizing, Undo, and Redo remain keyboard accessible.
- Save fidelity is part of the review-first beta promise; the warning does not excuse a known preview/export mismatch.
- Direct mode is real PDF text-object mutation, not OCR, secure redaction, or paragraph reflow. The saved bytes are reopened and checked for the requested object text plus stable unrelated page-object structure and text geometry. It fails atomically when mapping, font coverage, regeneration, or serialized read-back is unsafe. Visual fallback remains an overlay whose original source text can be recoverable. Image-only pages receive no text targets.
- “Pixel-perfect” is a bounded fidelity goal: outside the edited word-and-suffix strip, the adversarial render gate permits a maximum two-channel pixel delta and currently measures zero changed pixels, including the untouched prefix inside the same text line. A replacement's glyph advances can legitimately move the suffix as a whole, but relative character geometry inside that untouched suffix must remain stable. The inline browser preview uses the closest CSS font class; the original embedded PDF font is authoritative on save.
- A direct save fails closed if serialized regeneration moves an unchanged prefix or changes relative character geometry inside an unchanged suffix. This protects stable `TJ` positioning and kerning on either side of the edit without pretending the pinned PDFium runtime can preserve every custom text-position array.
- One ambiguity remains by design: a custom spacing adjustment exactly between the edited range and the first suffix character looks identical to the legitimate whole-suffix movement caused by a wider or narrower replacement. Direct mode cannot reject that boundary-only shift without unreliable font-width reconstruction; internal suffix spacing is still verified.
- Direct inspection is limited to 64 MB and abandons the mode when target analysis exceeds the interactive latency budget. The one-time PDFium document open is outside that target-analysis timer because it is cached for later word taps and cannot be aborted after completion. The cached document is explicitly released when a file changes, the editor closes, or the route unmounts.
- Rotated-page geometry is covered, and PDF.js can hit-test rotated or skewed source runs. Replacement-preview and Visual-fallback rendering for a text run whose own matrix is rotated or skewed is not yet certified; rotated-page proof must not be presented as rotated-run fidelity.
- Editing document content can invalidate an existing digital signature and the interface says so.
- Replacement-specific status follows the selected replacement and clears when the user selects an ordinary added annotation, so a stale Direct/Visual message is never presented as the mode of unrelated text or shapes.
