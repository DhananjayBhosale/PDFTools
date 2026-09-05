# Page Override

## Screen

- Name: Tool workflows (all `/tool-route` screens, with immersive editor
  exceptions defined by the shell)
- User goal: choose local files, understand the meaningful choices, complete
  one PDF task and recover the result comfortably on a phone

## Mobile task order

1. Source selection and its accepted file type or count.
2. Ordered inputs, page selection or other task-specific options.
3. One plainly named primary action.
4. Live progress, truthful cancellation boundary and recoverable failure.
5. Local result with Save first and Reader available for PDF output.

Keep this order in the DOM and the visual layout. A complex preview may scroll
inside its own bounded region, but the document must not gain horizontal scroll.
The final option and primary action must remain reachable above phone chrome.

Edit PDF is the exception for vertical preview scrolling: the current page grows
inside the route and uses the shell's single vertical scroll. Intentional zoom may
use a local horizontal pan, but never a second vertical viewport. The page number
is shown once in the toolbar, not repeated over the document. When a PDF has no
fillable fields, say nothing; when fields exist, show only the field count and the
Undo limitation.

The Edit PDF Text action creates plain text with no background, fill or permanent
box. Selection affordances appear only while the text is actively edited.

## Mobile Edit PDF workspace

Once a document is open, Edit PDF becomes an immersive canvas and releases the
app tab bar on Android and iOS and the mobile-web shell below 768px. Its slim top
bar owns Close, Undo, Redo and Save. Page navigation
and zoom sit immediately above the document. Text, Image, Shape and the current
shape type live in a one-handed bottom tool row; choosing Text or Shape arms the
tool, and the next page tap places it at that position. Keyboard and assistive
technology activation place it at a safe default position instead.

The selected object's properties appear only while it is selected, in one
compact horizontally scrollable inspector attached immediately above the bottom
tool row. It must not push the document or primary tools below the physical
viewport. Move and resize remain direct manipulation, with a large resize handle
so precision does not depend on a tiny glyph. Destructive actions stay in the
inspector instead of covering document content or intercepting a drag.
Selecting an added text annotation focuses a transparent inline text editor over
that annotation and selects its current content, so typing happens on the page
without a trip to the inspector. Caret, Backspace and Delete keys remain text
editing commands while that field has focus. One continuous focus session creates
one Undo checkpoint; the inspector remains the alternate editor for text and its
secondary properties.
The fixed bar's measured height, including the selected inspector and safe area,
is the scrolling content's bottom reservation; a guessed permanent spacer is not.
Android Back first asks the editor to close. Mobile-web Close, internal route navigation,
browser Back and page unload provide the equivalent unsaved-edits decision.
Saving establishes the current editor state as clean; a later edit arms the guard
again. At 768px and wider the website keeps the desktop toolbar and labelled
inspector instead of stretching the one-handed phone chrome across the page.

## Shared shell

Every non-immersive tool route renders inside `.chef-tool-surface`, which
`AppShell` sets once. The phone density of all 34 tools is that scope's rules in
`index.css` — 16px leading edge, the in-page title at the Heading step with no
top margin, 16px under the title block — not 34 sets of per-tool numbers. A tool
that needs to change its own phone density is describing a rule the shell is
missing.

`/view`, `/image-to-pdf`, `/pdf-to-jpg` and loaded compact `/edit` are immersive: the shell gives them no
chrome, so each carries `chef-safe-top` on its own header and owns its named way
out. A phone that reports a real top inset otherwise paints their header, and the
action inside it, underneath the status bar.

## Interaction rules

- Every practical touch target is at least 48px, the product's single floor. It
  is reached by extending the pressable region, never by growing the control:
  a segment stays 38px, a switch stays 51x31, a reader zoom control stays 36px
  tall. Reordering always has named Up/Down alternatives even when drag is
  available.
- Page tools expose the current selection, Select all/Clear when useful, and a
  recovery path such as restore or undo before export. They refuse impossible
  output, including deleting every page.
- Lossy or destructive modes state what will be removed before the action.
  Compress PDF keeps structure-preserving compression as the default and asks
  for explicit confirmation before rasterizing pages.
- Large browser jobs use a coarse, labelled estimate and explicit confirmation.
  The warning says that document complexity may require more memory.
- Cancellation is offered only when the processor can observe it between
  checkpoints. Copy names that boundary instead of promising an instant stop.
- Multi-file and batch tools keep input order visible, lock mutation while
  processing, and report partial failures separately from successful outputs.
- Passwords are opaque values. Preserve leading and trailing spaces through the
  fields, controller and processor; use trimming only to decide whether a value
  is entirely blank when the contract requires a non-blank password.

## Platform differences

- Browser workflows do not pretend to have Android-only camera scanning, ML Kit
  recognition, the Smart Forms model or native PDF viewer features.
- Browser compression may not predict an exact output size before processing.
  Unknown stays unknown, and a raster estimate is labelled as an estimate.
- Browser multi-output tools may deliver a ZIP where Android can save a folder
  or collection directly. The queue and filenames remain inspectable first.
- Office and OCR tools disclose their actual fidelity beside the action. Browser
  OCR is English-only unless the bundled language assets and processor change.

## Validation constraints

- Representative acceptance viewports are 320px and 390px wide.
- Check the dashboard, a destructive/lossy flow, a multi-file flow, a complex
  editor, a large conversion and Recent. No horizontal document overflow, no
  hidden required option, and no console error are permitted.
- Physical Android behavior, production deployment and telemetry are separate
  gates; browser screenshots do not prove them.
