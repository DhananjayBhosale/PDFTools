# T919 Android release minification

## Result

ACCEPTED as an unsigned build/configuration milestone. The Android release variant now enables R8 code shrinking/optimization and resource shrinking using the current optimized default rule set. AGP 8.13's integrated resource-shrinking pipeline is enabled.

## Exact changes

- `android/app/build.gradle`: `minifyEnabled true`, `shrinkResources true`, and `proguard-android-optimize.txt` for release.
- `android/gradle.properties`: `android.r8.optimizedResourceShrinking=true`.
- Added a focused verifier for release flags, merged R8 outputs, narrow-rule policy, preserved manifest/reflection entry-point names, retained native-reader resources, and required offline web assets.
- Updated the existing release-security verifier to require the new release optimization invariants.
- No dependency, AGP, Gradle, Capacitor, application identity, frontend, iOS, native API, or existing ProGuard-rule byte changed. No broad keep or warning-suppression rule was added.

## Evidence

- JDK 21 `:app:assembleRelease`: PASS, 113 tasks, no missing-rule output.
- R8 outputs are non-empty: merged configuration, mapping, seeds, usage, and resources.
- Critical names remain unrenamed: `MainActivity`, `PdfReaderActivity`, `AndroidDocumentScannerPlugin`, `AndroidDocumentsPlugin`, and ML Kit `CommonComponentRegistrar`.
- Required native-reader layouts/styles/icons remain reachable in the shrunk-resource report.
- Release security verifier: PASS.
- Android packaged web parity: PASS, 197 byte-identical files plus two documented empty extras.
- Unsigned APK identity remains `com.dhananjaytech.pdfchef`, version `22 / 2.2.4`.
- APK size changed from 33,561,956 unminified bytes to 20,130,375 bytes: 13,431,581 bytes / 40.0% smaller.
- Unsigned production-format AAB generation passed: 20,005,047 bytes, SHA-256 `ca6540459dac74bba2e5ca7d589084704ebfd9715e24ddce46c7dc97349070d8`, with base manifest, dex, `index.html`, and `sw.js` present.

Machine receipt: `output/t919-android-release-minification/evidence.json`.

## Honest boundary

The output is unsigned. This proves R8 configuration and build-time preservation evidence only. It does not prove a shrunk runtime, production signing compatibility, Play internal upgrade, physical-device behavior, production performance, or release readiness. Those gates remain explicit and separate.

No Chrome or emulator was opened, the connected OnePlus was not targeted, no signing credentials were accessed, and Play state was unchanged.

`full_outcome_complete: false`
