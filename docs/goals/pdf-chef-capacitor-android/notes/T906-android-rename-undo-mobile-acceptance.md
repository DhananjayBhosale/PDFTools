# T906 Android durable rename and undo mobile acceptance

## Verdict

ACCEPTED as the normal-phone Android activation of the accepted T904 durable rename and T905 durable delete/undo backends. This is not a production-release acceptance.

Exact Claude Code Opus 5 High owned the visible interaction, copy, layout, motion, and final screenshot verdict:

- `UI_VERDICT: PASS`
- `MODEL: claude-opus-5`
- `SESSION: 52a8e67f-7cdb-4011-96ad-da5f32c96901`
- `EFFORT: high`
- `SOURCE_CHANGED: NO` during the final screenshot-only verdict
- `REMAINING_VISUAL_GATES: NONE`

## Accepted behavior

- Canonical available durable `d1_` rows expose persistent rename and reversible deletion. Legacy `a1_`, missing, and browser-session rows retain explicit ineligible reasons.
- Rename uses the accepted native `renameItem` seam and refreshes the same durable ref.
- Single and selected durable deletion use opaque `u1_` receipts, skip an unnecessary permanent-delete confirmation, and offer one in-context Undo transaction until expiry.
- Later eligible deletions merge into the live offer without withdrawing older receipts. Partial restore keeps only failed receipts retryable on the original expiry and changes the action label to `Try undo again`.
- Permanent or mixed deletion keeps honest destructive confirmation copy. Clear actions are not routed through Undo.
- The deletion message and Undo action are one anchored status panel. The action spans the panel, retains the 48 px touch floor, and uses existing restrained and reduced-motion behavior.

## Verification bound to the accepted bytes

- Focused TypeScript platform and UI contracts: PASS, 38/38.
- `npm run lint`: PASS (`tsc --noEmit`).
- `npm run build`: PASS with Vite 8.2.2, 2,577 modules, and 194 offline assets in cache `51d7f0a9ded5`.
- `npx cap copy android`: PASS; Android packaged `index.html`, service worker, main JS, CSS, and Recent chunk are byte-identical to `dist`.
- `./gradlew :app:assembleDebug`: PASS, 72 tasks, 3 executed and 69 up-to-date.
- Undo, rename, AndroidDocuments, plugin catalogue, tool catalogue, and release-security verifiers: PASS.
- Disposable API 36.1 normal-phone emulator: PASS at 411 x 838 CSS px for durable rename, single delete/Undo, selected two-item delete/Undo, and refreshed records.
- Stable multi-delete DOM checkpoint: `Deleted 2 results.` plus `Undo delete`, with the action at 345.9 x 48 CSS px.
- Final evidence: `output/t906-android-final/03-deleted-undo-offered.png` and native framebuffer `output/t906-android-final/05-selected-deleted-native.png`, with surrounding flow screenshots `01`, `02`, `04`, and `06`.
- No desktop QA was run. Chrome was not opened. The WebView forward was removed, disposable emulator-5566 was closed, and the unrelated emulator-5554 remained untouched.

## Exact hashes

- `services/platform/contracts.ts`: `89451c66e8e877e38610487495d9811de0d8bf4d266fad318132114ab8e2457f`
- `services/platform/android/androidWorkspacePlatform.ts`: `8f904e078cde977b9ccdbc96909d77fa02a9f3bd205ce0b1fd74eeab1a81fd92`
- `hooks/useWorkspaceRuntime.tsx`: `e0f6efd37785f78913c5ac678a5ea9bc68936a087dd3623ef9dc2d382e450807`
- `components/Pages/RecentPage.tsx`: `ced30798fc358ae49b0d26089c75aa65b7144485879e927f03a20c38232ac274`
- `design-system/MASTER.md`: `13f45e3d1e6392167bb7f8de8bf43d95e140d52257511cda326d88b3ad04b5ed`
- `tests/platform/androidWorkspacePlatform.test.ts`: `94246fea671834797426dc3a6648a49ac7902c5ca1c5dca59371cd7c7b2dfc78`
- `tests/ui/recentDeleteUndo.test.ts`: `754ff6c98b1a542711fce4fc169d11988d07c4b31ee091de85801d58dc3ac033`
- `tests/ui/run-t906-emulator-qa.mjs`: `f04a1ac881d63e3f23f24bcf7e3a9c167205c915bc21a76b2688a2b499466635`
- `scripts/verify-android-document-undo.mjs`: `c606a856389f128677b46141753ed563eb1101e9ca135a0864ce7398ad84704f`
- `scripts/verify-android-document-rename.mjs`: `b6c6ff9fc7364597c7f934b34a07d655116037e578406f1a9f33ccbb00ff1070`
- `dist/index.html`: `70a42d2bc138ec6c9ad0b2ae1dbb813ac6656a338c7c522c6b3c4ec40142238e`
- `dist/sw.js`: `eb87fe2c9e3aa1be07ce303c8eef7f239586eaa506036ed78d8d2738d737c207`
- `dist/assets/index-B7IE4XJQ.js`: `a50be4b2559de909e5cc1995e64e6c815d7617b2cbe98b954b9b31397c1f10cc`
- `dist/assets/index-DOfgCbVQ.css`: `c7f112e8ba2fad5b7d899944ba001de4606efec02fe9a506cf7645148dac1a35`
- `dist/assets/RecentPage-Cp2VW5N1.js`: `bd04cbf016b3b7ed4ad480a66b20e07927e1a0256864104b7752408ebf2be735`
- `android/app/build/outputs/apk/debug/app-debug.apk`: `a8d0c06d24558d32e3cd02f3291b1400609bafa706d18543327a694a374b6e91`

The T905 backend hashes remained unchanged: writer `7f431eeb...`, coordinator `107ca030...`, plugin `f3964cdc...`, and AndroidDocuments client `f2ce7d52...`.

## Boundaries

The shared `dist` and Android packaged web bundle intentionally moved to the T906 bytes. iOS packaged assets were not synchronized or rebuilt in this Android tranche and now require an explicit later shared-source reconciliation. Physical OnePlus, signing, real predecessor update, Play internal upgrade, Play state, production telemetry, and production release remain NOT CHECKED. `full_outcome_complete: false`; `production_release_ready: NO`.
