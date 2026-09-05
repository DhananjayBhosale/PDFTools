# T908 Android legacy theme continuity acceptance

## Verdict

ACCEPTED as the end-to-end activation of the strict legacy Android theme reader/writer through the shared Appearance provider and existing Settings Theme row. The shared local theme is authoritative once valid; otherwise one read-only legacy import is allowed. Explicit Android choices use one crash-reconcilable transaction and cannot be reported as saved before native and local persistence agree.

## Accepted behavior

- With no valid shared local theme, `LIGHT` and `DARK` import exactly. `SYSTEM` and legacy `DYNAMIC` paint through shared System; importing `DYNAMIC` never rewrites it.
- A valid shared local theme wins on later launches and prevents a stale legacy read from replacing it.
- Explicit choices write only `SYSTEM`, `LIGHT`, or `DARK` through the accepted serialized Android client.
- The bounded strict local marker is published before the native write. If marker publication fails, native is not called and the last confirmed theme is restored.
- A native refusal, local-storage refusal, interrupted transaction, rapid choices, and unmount all have fixed coherent outcomes. Native messages, paths, modes, and implementation details never reach the UI.
- `saving`, `saved`, `imported`, `failed`, and `unsaved` feedback stays in the Theme row, uses the existing status primitive, keeps the segmented control enabled, and is announced politely.

## Verification

- Focused appearance plus accepted Android settings tests: PASS 32/32.
- `npm run lint`: PASS (`tsc --noEmit`).
- Dedicated Android Settings appearance verifier: PASS.
- Focused Android instrumentation compilation: PASS.
- `npm run build`: PASS with Vite 8.2.2, 2,580 modules, 194 offline assets, cache `ccb4c509f324`.
- `npx cap copy android`: PASS; Android packaged entry, service worker, main JS, Settings chunk, and CSS align with `dist`.
- `:app:assembleDebug :app:assembleDebugAndroidTest`: PASS. A focused Android-test-only rebuild passed after correcting an overstrict test oracle from exact protobuf bytes to the accepted wire-preservation contract.
- Disposable API 36.1 normal-phone instrumentation: PASS 1/1. It proved read-only DARK import, explicit LIGHT native write, marker release, and valid-local precedence after relaunch.
- Exact Claude Code Opus 5 High session `52a8e67f-7cdb-4011-96ad-da5f32c96901`: `UI_VERDICT: PASS`, `SOURCE_CHANGED: NO`, `REMAINING_VISUAL_GATES: NONE` against the current 1080x2400 framebuffer capture.
- Chrome was not opened. No WebView debugging forward was created. Disposable emulator-5566 was closed; emulator-5554 remained untouched.

## Exact hashes

- `hooks/useAppearance.tsx`: `77f768977c9e0981a505db1f8dec0ec953ac66596d77370a3519e00873af791f`
- `components/Pages/SettingsPage.tsx`: `8b4c38778b1f87d9c96eb02f0e6f4aad243715ccde0665ac81761771d0188981`
- `services/platform/android/androidSettings.ts`: `fffadadfc5f165eae111ee3e38c3a7a429a855f983bfaffbcec574aed684b4dc`
- `tests/platform/androidSettings.test.ts`: `68a4ccaa5ab0c945a9dcc91f1059e0f0c11620cbe1f5db0050a392b74c31df8b`
- `tests/ui/androidSettingsAppearance.test.ts`: `1e2c52ce78723a184b9e1f2a342872dde7fd2d3b60cd30ee9dda0a17cb080649`
- `scripts/verify-android-settings-appearance.mjs`: `82ca5e7faff02c68ce6d85775e020d4133e022fe98f3c04c449723f9975b665a`
- `design-system/MASTER.md`: `cba6629986d61f645ab82cc36d8f3a0e412d72c9773a6654894d550c4c3be3c5`
- `AndroidLegacySettingsWriterInstrumentedTest.java`: `9d82b56d0c0065808d63a34372719c7ab595d13b630e150479d27d7866634373`
- `dist/index.html`: `108b16e88d76019d4c013ac5436ae4228b0278318f71cd6da8279de29a741f58`
- `dist/sw.js`: `454160c1e91da9c001417c419b613594c9e2797d55dd700baff51f7c0615566e`
- `dist/assets/index-rIu3_lb0.js`: `32634e4954069f10e053cf9368d7cde201a4aab688ee57220d1c164e6b93b196`
- `dist/assets/SettingsPage-DBUSSAUv.js`: `d60fc2c72f78f18cfdf757e1a5067090400f6fc255a7e3eac3cef51017c5fef3`
- `dist/assets/index-DOfgCbVQ.css`: `c7f112e8ba2fad5b7d899944ba001de4606efec02fe9a506cf7645148dac1a35`
- Debug APK: `ef982eab58d8b9531a9b606a0ae707bafb570b5f61eae457aa3ea2cad7316d56`
- Android-test APK: `90137182801c010714cbfa1db1b8c9753e7a24736601bae61a008fed2cf33a23`
- Final normal-phone feedback capture: `ef41e466d4a322266483a30713d5996215c0ad34d5abfb6247fc419fb3c977ee`

## Boundaries

Text-scale native persistence, generic legacy repair/reset, independent clear semantics, final versionCode/update eligibility, paired performance, iOS package reconciliation, physical OnePlus, signing, Play, telemetry, and production release remain outside this tranche. `full_outcome_complete: false`; `production_release_ready: NO`.
