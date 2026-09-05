# Selectable PDF Text Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let users visually replace selectable PDF text directly in Edit PDF without adding OCR.

**Architecture:** Reuse PDF.js positioned text extraction to create accessible edit targets. Store the original source rectangle with the normal annotation element, cover that immutable rectangle during preview/export, and draw the editable replacement through the existing history and save pipeline.

**Tech Stack:** React 18, TypeScript, PDF.js 6, pdf-lib 1.17, Node test runner, Playwright, Vite, Capacitor.

---

### Backdrop revision, 2026-09-01

- [x] Replace padded white source patches with exact source bounds and a PDF.js text-free backdrop render.
- [x] Keep solid background as an unchecked option, with its colour control visible only when enabled.
- [x] Export automatic PNG backdrops correctly through CropBox offsets and 0/90/180/270-degree rotation.
- [x] Verify mobile, desktop, coloured-page preview, optional solid fill, and rotated export behavior.

---

### Task 1: Replacement geometry contract

**Files:**
- Create: `services/pdfEditorTextReplacement.ts`
- Create: `tests/services/pdfEditorTextReplacement.test.ts`
- Modify: `services/pdfDocument.ts`

- [x] Write failing tests for stable source IDs, normalized padded bounds, and replacement defaults.
- [x] Run `node --test tests/services/pdfEditorTextReplacement.test.ts` and confirm failure.
- [x] Implement the pure geometry factory and replacement metadata.
- [x] Run the focused test and confirm pass.

### Task 2: Selectable-line interaction

**Files:**
- Modify: `components/Tools/EditPDF.tsx`
- Modify: `tests/ui/editPdfMobileContract.test.ts`

- [x] Add failing source-contract checks for PDF.js line loading, accessible line targets, duplicate suppression, immediate inline focus, and the visual-replacement disclosure.
- [x] Run the focused contract and confirm failure.
- [x] Load selectable lines per visible page and render transparent click/keyboard targets below form controls and annotations.
- [x] Convert an activated line into a selected replacement using the existing commit/history path.
- [x] Render immutable background patches separately from movable replacement text.
- [x] Add replacement background-colour controls to mobile and desktop inspectors.
- [x] Run the focused contracts and confirm pass.

### Task 3: Export ordering

**Files:**
- Modify: `services/pdfDocument.ts`
- Modify: `tests/services/pdfEditorGeometry.test.ts`

- [x] Add a failing exporter contract proving replacement patches are drawn before annotations.
- [x] Paint every immutable source rectangle with its replacement background colour before the annotation loop.
- [x] Run geometry/export contracts and confirm pass.

### Task 4: Browser acceptance

**Files:**
- Modify: `scripts/verify-edit-pdf-mobile.mjs`
- Modify: `scripts/verify-edit-pdf-desktop.mjs`

- [x] Extend the desktop flow to activate a detected source line, edit it, Undo/Redo it, delete it, and verify the original target returns.
- [x] Extend the mobile flow to activate and edit a detected source line without using the inspector.
- [x] Save screenshots and assert no console errors or horizontal overflow.
- [x] Run `npm run test:browser:edit-pdf` against the exact production preview.

### Task 5: Candidate verification and review

**Files:**
- Modify: `design-system/pages/edit-pdf.md`
- Modify: `.planning/STATE.md`
- Generated sync: `dist`, `android/app/src/main/assets/public`, `ios/App/App/public`

- [x] Run focused tests, all source tests, `npm run lint`, `npm run test:catalog`, and `npm run build`.
- [x] Synchronize and verify identical Android/iOS packaged web assets.
- [x] Build Android debug and the unsigned iOS Simulator target.
- [x] Run Gemini 3.7 Flash at its maximum available thinking level over the completed diff/evidence.
- [x] Run Claude Code Opus 5 High over the completed diff/evidence.
- [x] Reconcile actionable findings, implement accepted corrections, and repeat affected verification.
- [x] Record exact artifact identities and remaining production/device boundaries.
