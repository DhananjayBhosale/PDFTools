# Smooth Sliders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current chunky slider behavior with a smooth native range implementation across every slider on the site.

**Architecture:** Keep the existing `ChefSlider` API but swap its internals to a native `input[type="range"]` with centralized styling in `index.css`. Verify all existing call sites still receive continuous updates, then validate the slider-heavy screens in the browser.

**Tech Stack:** React 18, TypeScript, Vite, CSS, Playwright

---

### Task 1: Document the approved approach

**Files:**
- Create: `docs/superpowers/specs/2026-04-13-smooth-sliders-design.md`
- Create: `docs/superpowers/plans/2026-04-13-smooth-sliders.md`

- [ ] Step 1: Save the approved slider design.
- [ ] Step 2: Save the implementation plan.

### Task 2: Replace the shared slider internals

**Files:**
- Modify: `components/UI/ChefSlider.tsx`
- Modify: `index.css`

- [ ] Step 1: Replace custom pointer math with native range input behavior.
- [ ] Step 2: Preserve the existing component props and value normalization.
- [ ] Step 3: Restyle the slider to the approved minimal `C` direction.
- [ ] Step 4: Keep keyboard, disabled, and dark-mode support intact.

### Task 3: Audit live slider consumers

**Files:**
- Check: `components/Tools/WatermarkPDF.tsx`
- Check: `components/Tools/PageNumbersPDF.tsx`
- Check: `components/Tools/SignPDF.tsx`
- Check: `components/Tools/PDFToImage.tsx`
- Check: `components/Tools/ReadabilityPreview.tsx`

- [ ] Step 1: Confirm all existing consumers work with continuous slider updates.
- [ ] Step 2: Patch any call site that needs explicit end-of-drag handling or smoother preview scheduling.

### Task 4: Verify behavior

**Files:**
- Check: `package.json`
- Check: `components/UI/ChefSlider.tsx`

- [ ] Step 1: Run `npm run build`.
- [ ] Step 2: Run targeted browser verification on slider-heavy screens.
- [ ] Step 3: Confirm smooth drag behavior and continuous preview updates.
