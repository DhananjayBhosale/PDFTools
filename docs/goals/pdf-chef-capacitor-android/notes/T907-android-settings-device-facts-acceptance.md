# T907 Android Settings device facts acceptance

## Verdict

ACCEPTED as the end-to-end activation of the previously accepted Android application-metadata and owned-storage-stat contracts through the existing Settings surfaces. No Settings UI, copy, layout, CSS, theme behavior, permission, manifest, or dependency changed.

## Accepted behavior

- `MainActivity` registers `AndroidAppMetadata` and `AndroidStorageStats` once, in the fixed pre-bridge plugin order.
- The Android workspace advertises `applicationMetadata` and `storageInformation` independently only when each exact native plugin is available.
- The adapter translates only method names: `getMetadata()` to `getApplicationMetadata()` and `getStorageStats()` to `getStorageInformation()`.
- Native rejection and strict DTO failure propagate to the existing Settings error states. The activation does not substitute null, zero, a hard-coded version, or false-success data.
- Retained storage remains the flat, direct, regular no-follow payload total under `filesDir/pdfchef_documents/owned`; legacy files, records, sessions, operations, cache, reader/share staging, names, paths, and URIs are excluded.

## Verification

- Focused TypeScript client/platform tests: PASS 27/27.
- `npm run lint`: PASS (`tsc --noEmit`).
- Focused metadata/storage JVM tests: PASS; `:app:testDebugUnitTest` BUILD SUCCESSFUL, 50 tasks, 4 executed and 46 up-to-date.
- Dedicated device-facts verifier, updated plugin-catalogue verifier, and release-security verifier: PASS.
- `npm run build`: PASS with Vite 8.2.2, 2,579 modules, 194 offline assets, cache `69e5eaf01bc2`.
- `npx cap copy android`: PASS; Android packaged entry/service worker/main JS/CSS/Settings chunk are byte-identical to `dist`.
- `:app:assembleDebug :app:assembleDebugAndroidTest`: PASS; final Android-test rebuild also passed after the focused assertion correction.
- Disposable API 36.1 normal-phone instrumentation: PASS 1/1. It proved plugin handles and runtime discovery, exact non-leaking DTOs, invalid-argument rejection, the existing Settings page showing the real debug version/build and `0 bytes used`, no loading/error fallback, and a 360..430 by 720..900 CSS viewport.
- Chrome was not opened. No WebView forward was created. Disposable emulator-5566 was closed; emulator-5554 remained untouched.

## Exact hashes

- `MainActivity.java`: `dad26a1976de6f7dd395b68b8d6a46a0582f07e4458846bf2e7d6431039ac81a`
- `androidWorkspacePlatform.ts`: `0230b5ed860132af4d732ebbdb9e8502085f0092e06b5459346f911d2b33c3ef`
- `androidWorkspacePlatform.test.ts`: `09dc4f40e67f162699578c6a7b49ad7ec457b5dd7a4d897b6b6907ed2cb623db`
- `verify-android-plugin-catalogue.mjs`: `8eee15359370a2c2f8568291cbca5598a85a27791457536fcb065b24aaa14a78`
- `verify-android-settings-device-facts.mjs`: `2e0f7076b9e0dcc7e48c4d99017479f9781dd6ea3deefd319682011986013a7d`
- `AndroidSettingsDeviceFactsInstrumentedTest.java`: `9d9b87c3c3449923c489afd5706dda58115bedfcace925e774e5fbee85b3fb4c`
- `dist/index.html`: `113eecb9028965633b9e18814c74d5523724ea9dd80afe9616d01a78c37f3d77`
- `dist/sw.js`: `b948c6237012149eea0c40e0255cf03f6e5708d3b5a10ca7f2628eea57569d6d`
- `dist/assets/index-Bj5-4vWt.js`: `3dafaabaa8842b28df8d24a6f7632581e0758d096a296d619f86e85b6db996ae`
- `dist/assets/index-DOfgCbVQ.css`: `c7f112e8ba2fad5b7d899944ba001de4606efec02fe9a506cf7645148dac1a35`
- `dist/assets/SettingsPage-esJzE7KA.js`: `214e73bd56d209a22d48f464229cf0a0b553074262e76cacfc649cafacacc3fd`
- Debug APK: `ff42bae4e46a1b5d7f5d1957719d87c1e5c27bc565961edc8b111fbedf9dc2c8`
- Android-test APK: `207ff1439092d35110615231315c28ddd599fd299d09a2e3e4e700544b5e90aa`

Accepted T042 source stayed unchanged: metadata client `cea98dfc...`, storage client `a0785154...`, metadata plugin `029ed1c4...`, storage plugin `a663d811...`, and calculator `09233a88...`.

## Boundaries

Android legacy theme import/write activation, text scale, independent clear semantics, versionCode/update eligibility, iOS package reconciliation, physical OnePlus, signing, Play, telemetry, and production release remain outside this tranche. `full_outcome_complete: false`; `production_release_ready: NO`.
