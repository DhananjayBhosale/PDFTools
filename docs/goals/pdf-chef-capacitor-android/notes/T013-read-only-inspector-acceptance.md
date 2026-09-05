# T013 Read-Only Inspector Acceptance

## Verdict

`ACCEPTED`. The AndroidLegacyInspector native slice is complete as a strictly read-only source and debug-artifact implementation. This does not establish runtime bridge discovery, installed-user preservation, release readiness, signing compatibility, device behavior, performance, or Play readiness.

## Accepted behavior

- `AndroidLegacyInspector` is registered exactly once before `BridgeActivity.onCreate` and exposes only `readHistory` and `readSettings`.
- History and settings readers emit the accepted T012 wire shapes without exposing paths, stored filenames, preference bytes, or document bytes.
- Missing, corrupt, and partial-invalid states remain distinct. Dangling index, settings-file, and datastore-ancestor symlinks are classified as corrupt before absence checks.
- History parsing is bounded, strict, stable, no-follow, and record-local for invalid data. Settings parsing reads `PreferencesProto` directly, recognizes exactly seven keys, and does not synthesize defaults.
- Full-tree preservation tests perform two reads and compare no-follow manifests including hashes, size, timestamps, and symlink targets.
- Production inspector code contains no write, migration, repair, cleanup, prune, copy, preference-edit, or error-detail logging path.

## Fresh verification

- Full Gradle gate: `BUILD SUCCESSFUL`; 140 of 140 tasks executed for Java compile, androidTest compile, JVM tests, lint, and debug APK assembly.
- JUnit XML: history 14, settings 8, contract 2, host identity 1; zero failures, errors, or skipped tests.
- Static inspector verifier: PASS, 24 focused tests. Frozen T012, T016, and fixture hashes matched.
- APK application ID: `com.dhananjaytech.pdfchef.debug`.
- APK SHA-256: `34a14b1db389573dbb5e977b8fcafcd73258dd0553e0a72a7ef22586828f83d4`.
- APK dex contains the plugin and both inspectors.
- Lint: 17 warnings, zero errors.

## Accepted hashes

- `android/app/build.gradle`: `c29d6ac4e99fc7790dce48f28f4ae9fdc5ced803e83981fef379f1e832d734ee`
- `MainActivity.java`: `dfbd55dfda7d32cb658990ce43158e56a6d9759f71e6c0e361dcf17b0e039136`
- `AndroidLegacyInspectorPlugin.java`: `17fbddb776a620f88fba33ca8ca95248d83e74420ad22fb3e34067db5b141691`
- `LegacyHistoryInspector.java`: `b0a26dba3f0fd8ef8a74ce9f9bc56b437c9297534fa38658ff42919863775f66`
- `LegacySettingsInspector.java`: `bf4acfb0efd1e5199a6b540b43e7b99a55bbbf96b256ae49301998431d304827`
- `LegacyHistoryInspectorTest.java`: `fba7a37f6fb660ed73dd2a406a446fb9f2be4a1ffed0687d8389cc40c29a2870`
- `LegacySettingsInspectorTest.java`: `8ec324de893bfc6e11130e76a327cf4f0700b0b5bee263a4e78d0018d197f69d`
- `AndroidLegacyInspectorContractTest.java`: `16d01015acf7198291d13589daeb11a59b85b81db2c2518021d8cf9a7081b75c`
- `scripts/verify-android-legacy-inspector.mjs`: `fa592b0213402d34ff1125f725eb74083a311f2329b07891b32fbd95c0e527cc`

## Open gates

- `RUNTIME_PLUGIN_DISCOVERY: NOT_CHECKED`
- `RUNTIME_HISTORY_READ: NOT_CHECKED`
- `RUNTIME_SETTINGS_READ: NOT_CHECKED`
- `RUNTIME_NO_MUTATION: NOT_CHECKED`
- `REAL_INSTALLED_USER_DATA: NOT_CHECKED`
- Physical device, performance, signing/update compatibility, Play, and production: `NOT_CHECKED`
- `dist/index.html` and the packaged Android index are currently byte-different. This is external React/UI-owner drift, not a T013 native mutation. The current APK therefore cannot represent the complete current workspace.

## Next gate

T021 must run on a fresh disposable emulator after frontend asset parity is restored and a fresh debug APK is assembled. It must prove positive Capacitor discovery and both JavaScript-to-native reads against synthetic debug-only data, with an unchanged no-follow tree after two calls to each method. T014 remains blocked until T021 passes.
