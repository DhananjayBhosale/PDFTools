# Smooth Sliders Design

**Date:** 2026-04-13

## Goal

Replace the site's current chunky custom sliders with a smooth, native-feeling slider that tracks continuously while dragging and visually matches the approved minimal reference direction.

## Current Problem

The shared `ChefSlider` component is implemented as a custom pointer-driven `div` with step snapping applied on every drag update. That produces visibly discrete movement and makes heavy live-preview tools feel rough.

## Design

### Shared Slider Architecture

Replace `ChefSlider`'s custom pointer logic with a thin React wrapper around `input[type="range"]`.

- Preserve the current public API:
  - `value`
  - `min`
  - `max`
  - `step`
  - `onChange`
  - `onChangeEnd`
  - `ariaLabel`
  - `disabled`
  - `className`
- Use browser-native range behavior for pointer capture, keyboard support, touch behavior, and continuous drag updates.
- Keep percent-based CSS variables so the track/fill/thumb styling stays centralized.

### Visual Direction

Apply the approved `C` style across the site:

- Slim neutral track
- Blue active fill
- White thumb with blue ring
- Light shadow
- Clean, utility-style appearance
- Consistent dark-mode treatment

### Smooth Live Updates

Dragging should update the slider value continuously instead of jumping in chunks.

- `onChange` fires on native `input` events for continuous updates.
- `onChangeEnd` fires on release-oriented events (`change`, pointer release fallback if needed) for finalization behavior.
- Tools with live previews should keep updating while dragging.
- Expensive preview refresh logic should be allowed to render at the browser’s paint cadence rather than tying slider motion to heavy work.

### Rollout Scope

Use the shared component so the visual and interaction improvement applies everywhere it is used, including:

- `WatermarkPDF`
- `PageNumbersPDF`
- `SignPDF`
- `PDFToImage`
- `ReadabilityPreview`
- Any other `ChefSlider` usage

## Validation

- Run the production build to catch type errors and integration regressions.
- Perform targeted browser checks on slider-heavy tools to confirm:
  - smooth continuous dragging
  - live value updates while dragging
  - preview responsiveness remains acceptable
