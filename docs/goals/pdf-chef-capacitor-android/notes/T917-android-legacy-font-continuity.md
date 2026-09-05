# T917 Android legacy font continuity

## Result

ACCEPTED for the bounded local normal-phone repair. A supported legacy `app_font_option` now imports once through the existing pre-render continuity seam only when no explicit shared `interfaceFont` authority exists. The legacy DataStore remains read-only.

## Behavior proved

- Exact mappings only: `DEFAULT -> system`, `INTER -> inter`, `MANROPE -> manrope`.
- A valid explicit shared font wins; a default materialized by another settings patch is not mistaken for explicit font authority.
- Readable missing, blank, valid, or unsupported legacy state converges after one inspection. Corrupt/unavailable state remains retryable.
- A result arriving after the pre-render timeout cannot change the font or completion marker.
- An ordinary exact-v21 to exact-v22 `adb install -r` preserved the real legacy PDF, index, onboarding completion, Dark theme, and Manrope on first launch and cold relaunch.
- Selecting Inter visibly in the candidate remained Dark + Inter after another cold relaunch; the legacy PDF/index/DataStore hashes stayed byte-identical.

## Focused evidence

- Continuity tests: PASS 18/18.
- Static continuity verifier: PASS.
- TypeScript: PASS.
- Production Vite build and Capacitor Android copy: PASS.
- JDK 21 Android debug assembly: PASS.
- Packaged web parity: PASS, 197 byte-identical files plus two documented empty extras.
- Package-PID logs: no fatal, ANR, or security match.
- Exact Claude Opus 5 High review: `UI_VERDICT: PASS`, `SOURCE_CHANGED: NO`, `REMAINING_VISUAL_GATES: None`, `CONSENSUS_STATUS: READY`; wrapper session `4a66e0e4-720d-4bcd-85f9-ad2f60cf2021`.
- Disposable emulator 5566 was closed. Chrome was not opened. The connected physical OnePlus was not targeted.

Machine-readable evidence: `output/t917-android-legacy-font-continuity/evidence.json`.

## Boundary

This closes the T916 legacy-Manrope defect and the bounded local settings/history continuity gate. It does not prove production signing compatibility, a Play internal upgrade, physical-device behavior, production performance, or production release readiness.

`full_outcome_complete: false`

